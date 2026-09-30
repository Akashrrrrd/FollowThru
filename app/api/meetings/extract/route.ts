import { NextRequest, NextResponse } from 'next/server';

import { createServerClient, getUserFromRequest } from '@/lib/supabase-server';

import { callGroqForExtraction } from '@/lib/groq';

import { resolveDateExpression, isDependencyExpression } from '@/lib/date-resolver';

import { linkCommitmentsToPrevious, saveContinuityEvents } from '@/lib/commitment-linker';

import { validatePipeline, StageContext, formatPipelineReport } from '@/lib/pipeline-validator';

import { logRejections, getErrorMetrics } from '@/lib/pipeline-error-handler';

import type { ExtractedCommitment } from '@/lib/types';

export const dynamic = 'force-dynamic';

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

      return NextResponse.json(

        { error: 'Meeting title is required.' },

        { status: 400 },

      );

    }

    if (!transcript || !transcript.trim()) {

      return NextResponse.json(

        { error: 'Transcript is required.' },

        { status: 400 },

      );

    }

    const supabase = createServerClient();

    const { data: meeting, error: meetingError } = await supabase

      .from('meetings')

      .insert({

        title: title.trim(),

        transcript: transcript.trim(),

        user_id: user.userId,

      })

      .select()

      .single();

    if (meetingError || !meeting) {

      return NextResponse.json(

        { error: 'Failed to create meeting record.' },

        { status: 500 },

      );

    }

    let commitments: ExtractedCommitment[] = [];

    let extractionError: string | null = null;

    // Use the meeting's created_at date for date calculations
    const meetingDate = new Date(meeting.created_at);
    const meetingDateStr = meeting.created_at.split('T')[0];

    try {

      commitments = await callGroqForExtraction(transcript.trim(), meetingDate);

    } catch (firstErr) {

      console.error('First extraction attempt failed:', firstErr);

      // Wait 2 seconds before retry to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 2000));

      try {

        commitments = await callGroqForExtraction(transcript.trim(), meetingDate);

      } catch (retryErr) {

        console.error('Retry extraction also failed:', retryErr);

        extractionError =

          retryErr instanceof Error && retryErr.message.includes('rate_limit')
            ? 'Rate limit reached. Please wait a moment and try again.'
            : 'Could not parse commitments from the transcript. The meeting was saved but no tasks were extracted.';

      }

    }

    // PIPELINE VALIDATION: Validate extraction output before processing
    const pipelineContext: StageContext = {
      meeting_id: meeting.id,
      user_id: user.userId,
      transcript: transcript.trim(),
      meeting_date: meetingDateStr,
      extraction_response: { commitments },
    };

    const pipelineValidation = validatePipeline(pipelineContext);

    // Log any validation errors
    for (const stage of pipelineValidation.stages) {
      if (stage.errors.length > 0) {
        logRejections(
          meeting.id,
          user.userId,
          stage.stage,
          stage.errors,
          pipelineContext
        );
      }
    }

    // If pipeline failed, report error
    if (!pipelineValidation.overall_passed) {
      const firstError = pipelineValidation.stages
        .flatMap(s => s.errors)
        .find(e => !e.recoverable);

      const errorMsg = firstError
        ? `Pipeline validation failed: ${firstError.message}`
        : 'Pipeline validation encountered recoverable issues. Processing may be incomplete.';

      extractionError = extractionError || errorMsg;

      console.warn('[PIPELINE VALIDATION]', formatPipelineReport(pipelineValidation));
    }

    let tasks: ExtractedCommitment[] = pipelineContext.parsed_commitments || [];

    if (commitments.length > 0) {
      // Use validated commitments from pipeline
      const parsedCommitments = pipelineContext.parsed_commitments || [];
      
      if (parsedCommitments.length === 0) {
        // No commitments passed validation
        extractionError = extractionError || 'No commitments passed validation';
      } else {
        // Post-process commitments to resolve relative date expressions
        const processedCommitments = parsedCommitments.map((c) => {
          let resolvedDate = c.due_date;
          
          // If AI returned a relative expression instead of a date, resolve it now
          if (c.due_date_expression && !/^\d{4}-\d{2}-\d{2}$/.test(c.due_date_expression)) {
            // Check if it's a dependency expression (should remain null)
            if (isDependencyExpression(c.due_date_expression)) {
              resolvedDate = null;
            } else {
              // Try to resolve the relative date expression
              const resolved = resolveDateExpression(c.due_date_expression, meetingDate);
              resolvedDate = resolved || null; // Use resolved date or null if unresolvable
            }
          }
          
          return {
            ...c,
            due_date: resolvedDate,
          };
        });
        
        // Get current user's profile to match owners
        const { data: userProfile } = await supabase
          .from('user_profiles')
          .select('display_name, full_name')
          .eq('id', user.userId)
          .single();

        // Use provided name or fallback to display_name
        const displayName = your_name || userProfile?.display_name || userProfile?.full_name || '';
        
        const taskRows = processedCommitments.map((c) => {
          // Determine if this commitment is owned by the current user
          // by comparing the extracted owner name to the provided name or display_name
          let ownerUserId: string | null = null;
          if (displayName && c.owner.toLowerCase().includes(displayName.toLowerCase())) {
            ownerUserId = user.userId;
          }

          return {
            meeting_id: meeting.id,
            user_id: user.userId,
            description: c.description,
            owner: c.owner,
            owner_user_id: ownerUserId,
            due_date: c.due_date,
            source_quote: c.source_quote,
            confidence: c.confidence || 'medium',
            dependency: c.dependency,
            commitment_type: c.commitment_type || 'explicit',
            // Mark low-confidence commitments for review
            needs_review: c.confidence === 'low',
            // Auto-approve high and medium confidence commitments
            approved: c.confidence !== 'low',
          };
        });

        const { data: insertedTasks, error: tasksError } = await supabase

          .from('tasks')

          .insert(taskRows)

          .select();

        if (tasksError) {

          console.error('Failed to insert tasks:', tasksError.message);

          extractionError =

            'Commitments were extracted but could not be saved to the database.';

        } else if (insertedTasks) {

          // Phase 4: Link commitments with previous commitments
          const linkResult = await linkCommitmentsToPrevious(
            insertedTasks as any,
            meeting.id,
            user.userId,
            meetingDateStr,
          );

          // Update NEW tasks with parent_commitment_id if any were linked
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

            // Save continuity events
            await saveContinuityEvents(linkResult.continuityEvents);
            console.log(
              `[CONTINUITY] Saved ${linkResult.continuityEvents.length} continuity events`,
            );
          }

          // Log original tasks that were updated
          if (linkResult.originalTasksUpdated.length > 0) {
            console.log(
              `[CONTINUITY] Updated ${linkResult.originalTasksUpdated.length} original commitments: ` +
              linkResult.originalTasksUpdated.map((t) => `${t.task_id} (${t.event_type})`).join(', '),
            );
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
          
          // Create history entries for new commitments
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
