import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUserFromRequest } from '@/lib/supabase-server';
import { getUserOrganizationContext } from '@/lib/organization-context';
import { callGroqForExtraction } from '@/lib/groq';
import { resolveDateExpression, isDependencyExpression } from '@/lib/date-resolver';
import { linkCommitmentsToPrevious, saveContinuityEvents } from '@/lib/commitment-linker';
import { validatePipeline, StageContext, formatPipelineReport } from '@/lib/pipeline-validator';
import { logRejections } from '@/lib/pipeline-error-handler';
import { HallucinationDetector } from '@/lib/hallucination-detector';
import { resolveOwnerToUser } from '@/lib/owner-resolution';
import { resolveUserToTeam } from '@/lib/team-resolution';
import { getTeamLeadResolution } from '@/lib/team-lead-resolution';
import type { ExtractedCommitment } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Turns a raw extraction error into a message the user can understand.
function friendlyExtractionError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);

  // Specific error patterns with user-friendly messages
  if (/decommission/i.test(msg)) {
    return 'The AI model is currently unavailable. Your meeting was saved. Please try again in a moment.';
  }
  if (/rate_limit|429|quota/i.test(msg)) {
    return 'API rate limit reached. Please wait a few moments and try again.';
  }
  if (/timeout|timed out|ETIMEDOUT/i.test(msg)) {
    return 'The AI service took too long to respond. Please try again with a shorter transcript or try again in a moment.';
  }
  if (/authentication|api.*key|401|403/i.test(msg)) {
    return 'The AI service authentication failed. Please contact support.';
  }
  if (/no.*response|empty.*response/i.test(msg)) {
    return 'The AI service returned no results. Your meeting was saved. Please try again.';
  }
  if (/malformed|invalid.*json|parse/i.test(msg)) {
    return 'The AI service returned unexpected data. Your meeting was saved. Please try again.';
  }

  // Generic fallback
  return 'Could not extract commitments from this transcript. Your meeting was saved. Please review the transcript and try again, or extract manually from the meeting detail page.';
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: 'You must be signed in to process a meeting.' },
        { status: 401 },
      );
    }

    const body = await req.json();
    const { title, transcript, your_name } = body as {
      title?: string;
      transcript?: string;
      your_name?: string;
    };

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Meeting title is required.' }, { status: 400 });
    }

    // Validate transcript presence and minimum length
    if (!transcript || !transcript.trim()) {
      return NextResponse.json(
        { error: 'Transcript is required. Please paste a meeting transcript to extract commitments from.' },
        { status: 400 },
      );
    }

    const trimmedTranscript = transcript.trim();

    // Check for extremely short transcripts (less meaningful for extraction)
    if (trimmedTranscript.length < 50) {
      return NextResponse.json(
        {
          error:
            'Transcript is too short. Please provide a more detailed transcript with at least a few exchanges between participants (e.g., "Person A: ... Person B: ...").',
        },
        { status: 400 },
      );
    }

    // Check for transcript that might be mostly noise/non-meaningful
    const wordCount = trimmedTranscript.split(/\s+/).length;
    if (wordCount < 20) {
      return NextResponse.json(
        { error: 'Transcript is too brief. Please provide a transcript with more content (at least 20 words).' },
        { status: 400 },
      );
    }

    const supabase = createServerClient();

    // Get user's organization (required for org-scoped data)
    const orgContext = await getUserOrganizationContext(supabase, user.userId);
    if (!orgContext) {
      return NextResponse.json(
        { error: 'User has no organization membership' },
        { status: 403 },
      );
    }

    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .insert({
        title: title.trim(),
        transcript: trimmedTranscript,
        user_id: user.userId,
        organization_id: orgContext.organizationId,
      })
      .select()
      .single();

    if (meetingError || !meeting) {
      return NextResponse.json({ error: 'Failed to create meeting record.' }, { status: 500 });
    }

    let commitments: ExtractedCommitment[] = [];
    let extractionError: string | null = null;

    // Use the meeting's created_at date for date calculations
    const meetingDate = new Date(meeting.created_at);
    const meetingDateStr = meeting.created_at.split('T')[0];

    // callGroqForExtraction already retries once on temporary errors,
    // and never retries permanent ones (for example a decommissioned model).
    try {
      commitments = await callGroqForExtraction(trimmedTranscript, meetingDate);
    } catch (err) {
      console.error('Extraction failed:', err);
      extractionError = friendlyExtractionError(err);
    }

    // PIPELINE VALIDATION: a bug in validation or logging must never kill extraction.
    const pipelineContext: StageContext = {
      meeting_id: meeting.id,
      user_id: user.userId,
      transcript: trimmedTranscript,
      meeting_date: meetingDateStr,
      extraction_response: { commitments },
    };

    if (commitments.length > 0) {
      try {
        const pipelineValidation = validatePipeline(pipelineContext);

        for (const stage of pipelineValidation.stages) {
          if (stage.errors.length > 0) {
            logRejections(meeting.id, user.userId, stage.stage, stage.errors, pipelineContext);
          }
        }

        if (!pipelineValidation.overall_passed) {
          const firstError = pipelineValidation.stages
            .flatMap((s) => s.errors)
            .find((e) => !e.recoverable);

          const errorMsg = firstError
            ? `Pipeline validation failed: ${firstError.message}`
            : 'Pipeline validation encountered recoverable issues. Processing may be incomplete.';

          extractionError = extractionError || errorMsg;
          console.warn('[PIPELINE VALIDATION]', formatPipelineReport(pipelineValidation));
        }
      } catch (validationErr) {
        // Fall back to the commitments that groq.ts already checked and de-duplicated.
        console.error('[PIPELINE VALIDATION] Validator crashed, using unvalidated commitments:', validationErr);
        pipelineContext.parsed_commitments = commitments;
      }
    }

    let tasks: ExtractedCommitment[] = pipelineContext.parsed_commitments || [];

    if (commitments.length > 0) {
      const parsedCommitments = pipelineContext.parsed_commitments || [];

      if (parsedCommitments.length === 0) {
        extractionError = extractionError || 'No commitments passed validation';
      } else {
        // Resolve spoken date phrases ("by Friday") into real dates
        const processedCommitments = parsedCommitments.map((c) => {
          let resolvedDate = c.due_date;

          if (c.due_date && !/^\d{4}-\d{2}-\d{2}$/.test(c.due_date)) {
            if (isDependencyExpression(c.due_date)) {
              resolvedDate = null;
            } else {
              const resolved = resolveDateExpression(c.due_date, meetingDate);
              resolvedDate = resolved || null;
            }
          }

          return { ...c, due_date: resolvedDate };
        });

        const { data: userProfile } = await supabase
          .from('user_profiles')
          .select('display_name, full_name')
          .eq('id', user.userId)
          .single();

        const displayName = your_name || userProfile?.display_name || userProfile?.full_name || '';

        const taskRows = processedCommitments.map((c) => {
          let ownerUserId: string | null = null;
          if (displayName && c.owner.toLowerCase().includes(displayName.toLowerCase())) {
            ownerUserId = user.userId;
          }

          return {
            meeting_id: meeting.id,
            user_id: user.userId,
            organization_id: orgContext.organizationId,
            description: c.description,
            owner: c.owner,
            owner_user_id: ownerUserId,
            due_date: c.due_date,
            source_quote: c.source_quote,
            confidence: c.confidence || 'medium',
            dependency: c.dependency,
            commitment_type: c.commitment_type || 'explicit',
            needs_review: c.confidence === 'low',
            approved: c.confidence !== 'low',
          };
        });

        const { data: insertedTasks, error: tasksError } = await supabase
          .from('tasks')
          .insert(taskRows)
          .select();

        if (tasksError) {
          console.error('Failed to insert tasks:', tasksError.message);
          extractionError = 'Commitments were extracted but could not be saved to the database.';
        } else if (insertedTasks) {
          // Hallucination Detection: Check each inserted task against the transcript
          const hallucinationDetector = new HallucinationDetector(supabase);
          
          for (const task of insertedTasks) {
            try {
              const checkResult = await hallucinationDetector.checkExtraction(
                trimmedTranscript,
                task.description,
                task.owner,
                task.due_date || 'No deadline'
              );

              if (checkResult.isHallucination) {
                // Flag for review and set grace period
                await hallucinationDetector.flagHallucination(
                  meeting.id,
                  task.id,
                  checkResult.reason,
                  checkResult.confidence
                );
                console.log(`[HALLUCINATION] Flagged task ${task.id} for review: ${checkResult.reason}`);
              }
            } catch (err) {
              console.error(`Error checking hallucination for task ${task.id}:`, err);
              // Non-blocking: continue processing other tasks
            }
          }

          // Continuity: link commitments with earlier ones
          const linkResult = await linkCommitmentsToPrevious(
            insertedTasks as any,
            meeting.id,
            user.userId,
            meetingDateStr,
          );

          if (linkResult.continuityEvents.length > 0) {
            for (const event of linkResult.continuityEvents) {
              await supabase
                .from('tasks')
                .update({
                  parent_commitment_id: event.parent_task_id,
                  continuity_status: 'continued',
                  continuity_confidence: event.confidence,
                })
                .eq('id', event.child_task_id);
            }

            await saveContinuityEvents(linkResult.continuityEvents);
            console.log(`[CONTINUITY] Saved ${linkResult.continuityEvents.length} continuity events`);
          }

          if (linkResult.originalTasksUpdated.length > 0) {
            console.log(
              `[CONTINUITY] Updated ${linkResult.originalTasksUpdated.length} original commitments: ` +
                linkResult.originalTasksUpdated.map((t) => `${t.task_id} (${t.event_type})`).join(', '),
            );
          }

          // Phase 3: Owner → Team → Team Lead Resolution
          // For each inserted task, resolve: extracted owner name → user ID → team → team lead
          for (const task of insertedTasks) {
            try {
              let assignedToUserId: string | null = null;
              let assignedTeamId: string | null = task.team_id || null;
              let assignedTeamLeadId: string | null = null;
              let needsReview = false;
              let ambiguityData: Record<string, unknown> | null = null;

              // Step 1: Resolve owner name to user (conservative matching)
              const ownerResolution = await resolveOwnerToUser(
                supabase,
                task.owner,
                orgContext.organizationId,
              );

              if (ownerResolution.status === 'resolved' && ownerResolution.userId) {
                assignedToUserId = ownerResolution.userId;
                console.log(
                  `[RESOLUTION] Task ${task.id}: Owner "${task.owner}" → User ${assignedToUserId} (${ownerResolution.reason})`,
                );
              } else if (ownerResolution.status === 'ambiguous' && ownerResolution.candidates) {
                // Owner name matches multiple people; require human review
                needsReview = true;
                ambiguityData = {
                  ambiguity_type: 'owner_ambiguous',
                  candidates: ownerResolution.candidates.map((c) => ({
                    userId: c.userId,
                    displayName: c.displayName,
                    fullName: c.fullName,
                    matchConfidence: c.matchConfidence,
                    matchReason: c.matchReason,
                  })),
                  reason: ownerResolution.reason,
                };
                console.log(
                  `[RESOLUTION] Task ${task.id}: Owner "${task.owner}" is ambiguous (${ownerResolution.candidates.length} candidates); flagged for review`,
                );
              } else {
                // Owner unresolved: no matching user in org
                console.log(
                  `[RESOLUTION] Task ${task.id}: Owner "${task.owner}" unresolved (${ownerResolution.reason})`,
                );
              }

              // Step 2: If owner resolved, determine team
              if (assignedToUserId && !assignedTeamId) {
                const teamResolution = await resolveUserToTeam(
                  supabase,
                  assignedToUserId,
                  orgContext.organizationId,
                  meeting.team_id, // Prefer meeting's team if user is member
                );

                if (teamResolution.status === 'resolved' && teamResolution.teamId) {
                  assignedTeamId = teamResolution.teamId;
                  console.log(
                    `[RESOLUTION] Task ${task.id}: User ${assignedToUserId} → Team ${assignedTeamId} (${teamResolution.reason})`,
                  );
                } else if (teamResolution.status === 'multiple_teams' && teamResolution.candidates) {
                  // User in multiple teams; require human selection
                  needsReview = true;
                  ambiguityData = {
                    ...ambiguityData,
                    ambiguity_type: 'team_ambiguous',
                    candidates: teamResolution.candidates.map((c) => ({
                      teamId: c.teamId,
                      teamName: c.teamName,
                      memberCount: c.memberCount,
                    })),
                    reason: teamResolution.reason,
                  };
                  console.log(
                    `[RESOLUTION] Task ${task.id}: User ${assignedToUserId} in multiple teams; flagged for review`,
                  );
                } else {
                  console.log(
                    `[RESOLUTION] Task ${task.id}: User ${assignedToUserId} has no team (${teamResolution.reason})`,
                  );
                }
              }

              // Step 3: If team resolved, determine team lead
              if (assignedTeamId) {
                const leadResolution = await getTeamLeadResolution(supabase, assignedTeamId);

                if (leadResolution.status === 'resolved' && leadResolution.userId) {
                  assignedTeamLeadId = leadResolution.userId;
                  console.log(
                    `[RESOLUTION] Task ${task.id}: Team ${assignedTeamId} → Lead ${assignedTeamLeadId} (${leadResolution.reason})`,
                  );
                } else if (leadResolution.status === 'multiple_leads' && leadResolution.candidates) {
                  // Multiple team leads (unusual); flag for review
                  needsReview = true;
                  ambiguityData = {
                    ...ambiguityData,
                    ambiguity_type: 'lead_ambiguous',
                    candidates: leadResolution.candidates.map((c) => ({
                      userId: c.userId,
                      displayName: c.displayName,
                      fullName: c.fullName,
                    })),
                    reason: leadResolution.reason,
                  };
                  console.log(
                    `[RESOLUTION] Task ${task.id}: Team has multiple leads; flagged for review`,
                  );
                } else {
                  console.log(
                    `[RESOLUTION] Task ${task.id}: Team has no lead (${leadResolution.reason})`,
                  );
                }
              }

              // Step 4: Update task with resolved values
              const updatePayload: Record<string, any> = {
                needs_assignment_review: needsReview,
              };

              if (assignedToUserId) {
                updatePayload.assigned_to_user_id = assignedToUserId;
              }

              if (assignedTeamId) {
                updatePayload.team_id = assignedTeamId;
              }

              if (assignedTeamLeadId) {
                updatePayload.team_lead_id = assignedTeamLeadId;
              }

              if (ambiguityData) {
                updatePayload.assignment_ambiguity_data = ambiguityData;
              }

              const { error: updateError } = await supabase
                .from('tasks')
                .update(updatePayload)
                .eq('id', task.id);

              if (updateError) {
                console.error(`[RESOLUTION] Error updating task ${task.id}:`, updateError);
              }
            } catch (err) {
              console.error(`[RESOLUTION] Unexpected error resolving task ${task.id}:`, err);
              // Non-blocking: continue with next task
            }
          }

          tasks = insertedTasks.map((t) => ({
            owner: t.owner,
            description: t.description,
            due_date: t.due_date,
            source_quote: t.source_quote,
            confidence: t.confidence,
            dependency: t.dependency,
            commitment_type: t.commitment_type,
          }));

          const historyEntries = insertedTasks.map((t) => ({
            task_id: t.id,
            user_id: user.userId,
            change_type: 'created',
            new_value: t.status,
            notes: `Commitment extracted from meeting: ${meeting.title}`,
          }));

          await supabase.from('commitment_history').insert(historyEntries);
        }
      }
    }

    return NextResponse.json({
      meeting,
      tasks,
      warning: extractionError,
    });
  } catch (err) {
    console.error('Extract route error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}