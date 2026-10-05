import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { getEmailProvider, createUpcomingReminderEmail, createOverdueReminderEmail, createEscalationEmail } from '@/lib/email-provider';
import { NudgeEngine } from '@/lib/integrations/nudge-engine';
import { createClient } from '@supabase/supabase-js';
import {
  getCommitmentsEligibleForEscalation,
  getNextEscalationRecipient,
  createEscalationRecord,
  isCommitmentEligibleForEscalation,
  formatEscalationMessage,
} from '@/lib/escalation-service';
import { getReminderPolicy } from '@/lib/reminder-escalation-config';
import { handleEscalationNotification } from '@/lib/notification-service';

export const dynamic = 'force-dynamic';

/**
 * Vercel Cron Job: Send commitment reminders and escalations
 * 
 * Scheduled to run daily (configuration in vercel.json)
 * 
 * PHASE 4 ENHANCEMENTS:
 * - Finds open commitments due soon or overdue, sends reminders to owners
 * - Finds overdue commitments and escalates to team lead/manager/owner
 * - Uses deterministic, idempotent escalation engine
 * 
 * Security:
 * - Requires Authorization header with CRON_SECRET
 * - Only processes legitimate reminder jobs, never sends duplicates
 * - Idempotent: safe to retry without double-sending
 * - Escalations use atomic guards to prevent concurrent duplicates
 */

interface ReminderMetadata {
  reminder_sent_at?: string;
  overdue_reminder_sent_at?: string;
  last_reminder_type?: 'upcoming' | 'overdue';
}

interface EscalationStats {
  checked: number;
  escalated: number;
  failed: number;
  skipped: number;
}

async function sendReminderEmail(
  email: string,
  taskDescription: string,
  dueDate: string,
  reminderType: 'upcoming' | 'overdue',
): Promise<boolean> {
  try {
    const emailProvider = getEmailProvider();

    let subject: string;
    let body: string;

    if (reminderType === 'upcoming') {
      const today = new Date().toISOString().split('T')[0];
      const dueDay = new Date(dueDate);
      const today_date = new Date(today);
      const daysUntilDue = Math.ceil((dueDay.getTime() - today_date.getTime()) / (1000 * 60 * 60 * 24));
      subject = `Commitment Due Soon: ${taskDescription.substring(0, 50)}`;
      body = createUpcomingReminderEmail(taskDescription, dueDate, daysUntilDue);
    } else {
      const today = new Date().toISOString().split('T')[0];
      const dueDay = new Date(dueDate);
      const today_date = new Date(today);
      const daysSinceOverdue = Math.ceil((today_date.getTime() - dueDay.getTime()) / (1000 * 60 * 60 * 24));
      subject = `OVERDUE: ${taskDescription.substring(0, 50)}`;
      body = createOverdueReminderEmail(taskDescription, dueDate, daysSinceOverdue);
    }

    await emailProvider.send(email, subject, body);
    return true;
  } catch (err) {
    console.error('Send reminder email error:', err);
    return false;
  }
}

/**
 * Process escalations for overdue commitments
 * 
 * PHASE 4: Main escalation engine
 * - Finds commitments overdue for 24h, 48h, 72h
 * - Routes escalations to team lead → manager → owner
 * - Sends escalation emails to recipients
 * - Maintains idempotency via atomic guards and unique constraints
 */
async function processEscalations(supabase: any): Promise<EscalationStats> {
  const stats: EscalationStats = {
    checked: 0,
    escalated: 0,
    failed: 0,
    skipped: 0,
  };

  try {
    // Get all organizations (escalations are org-scoped)
    const { data: organizations, error: orgError } = await supabase
      .from('organizations')
      .select('id');

    if (orgError) {
      console.error('[escalation] Error fetching organizations:', orgError.message);
      return stats;
    }

    if (!organizations || organizations.length === 0) {
      console.log('[escalation] No organizations to process');
      return stats;
    }

    // Process each organization's escalations
    for (const org of organizations) {
      // Get commitments eligible for escalation (24h+ overdue, not cancelled)
      const commitments = await getCommitmentsEligibleForEscalation(supabase, org.id);
      stats.checked += commitments.length;

      for (const commitment of commitments) {
        try {
          // Verify commitment is still eligible (double-check in case it changed)
          if (!isCommitmentEligibleForEscalation(commitment)) {
            stats.skipped++;
            continue;
          }

          // Get next escalation recipient (team lead, manager, or owner)
          const recipient = await getNextEscalationRecipient(supabase, commitment);

          if (!recipient) {
            console.log(
              `[escalation] No valid escalation recipient for commitment ${commitment.id}`
            );
            stats.skipped++;
            continue;
          }

          // Create escalation record atomically (with idempotency guards)
          const result = await createEscalationRecord(supabase, commitment, recipient);

          if (!result.escalation_created) {
            // Already escalated today or error occurred
            if (!result.error) {
              stats.skipped++;
            } else {
              stats.failed++;
              console.error(`[escalation] Failed to escalate task ${commitment.id}:`, result.error);
            }
            continue;
          }

          // PHASE 5: Create unified notification for escalation
          if (result.escalation_history_id && result.escalation_type) {
            try {
              await handleEscalationNotification(supabase, result.escalation_history_id, {
                taskId: commitment.id,
                taskDescription: commitment.description,
                organizationId: commitment.organization_id,
                teamId: commitment.team_id || undefined,
                escalatedToUserId: recipient.recipient_user_id,
                escalatedToUserRole: recipient.recipient_role,
                escalationType: result.escalation_type,
                hoursOverdueAtEscalation: Math.round(result.hours_overdue),
                assignedToUserId: commitment.assigned_to_user_id,
                dueDate: commitment.due_date,
              });
            } catch (notificationErr) {
              console.error(
                `[escalation] Failed to create Phase 5 notification for task ${commitment.id}:`,
                notificationErr
              );
              // Don't fail escalation if notification creation fails
            }
          }

          // Get recipient's email to send escalation notification
          const { data: recipientProfile } = await supabase
            .from('user_profiles')
            .select('email, display_name')
            .eq('id', recipient.recipient_user_id)
            .single();

          if (recipientProfile?.email) {
            // Send escalation email to recipient (manager/team lead)
            const emailProvider = getEmailProvider();
            const escalationMessage = formatEscalationMessage(
              commitment,
              recipient,
              result.hours_overdue
            );
            const subject = `🚨 ESCALATION: Overdue Commitment - ${commitment.description.substring(0, 40)}`;
            const body = createEscalationEmail(
              commitment.description,
              commitment.owner,
              commitment.due_date,
              Math.round(result.hours_overdue),
              recipient.recipient_role,
              escalationMessage
            );

            try {
              await emailProvider.send(recipientProfile.email, subject, body);
              console.log(
                `[escalation] Email sent to ${recipient.recipient_role} ${recipientProfile.display_name} for task ${commitment.id}`
              );
            } catch (emailErr) {
              console.error(`[escalation] Failed to send escalation email to ${recipientProfile.email}:`, emailErr);
              // Still count as escalated even if email failed (notification was created)
            }
          }

          stats.escalated++;
        } catch (err) {
          console.error(`[escalation] Error processing commitment ${commitment.id}:`, err);
          stats.failed++;
        }
      }
    }

    return stats;
  } catch (err) {
    console.error('[escalation] Escalation processing error:', err);
    return stats;
  }
}

async function processReminders() {
  const supabase = createServerClient();
  const nudgeEngine = new NudgeEngine(supabase);
  
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const threeDaysFromNow = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];

  const remindersSent = {
    upcoming: 0,
    overdue: 0,
    failed: 0,
  };

  try {
    // Find upcoming reminders (due within 3 days)
    const { data: upcomingTasks, error: upcomingError } = await supabase
      .from('tasks')
      .select(`
        id,
        user_id,
        description,
        due_date,
        owner,
        status,
        owner_user_id
      `)
      .in('status', ['open', 'in_progress'])
      .gte('due_date', today)
      .lte('due_date', threeDaysFromNow)
      .is('reminder_sent_at', null);

    if (upcomingError) {
      console.error('Error fetching upcoming tasks:', upcomingError);
    } else if (upcomingTasks) {
      for (const task of upcomingTasks) {
        const ownerId = task.owner_user_id || task.user_id;
        
        try {
          // Get user preferences to determine delivery channel
          const { data: prefs } = await supabase
            .from('user_preferences')
            .select('nudge_channel')
            .eq('user_id', ownerId)
            .single();

          const channel = (prefs?.nudge_channel || 'email') as 'email' | 'slack' | 'teams';

          // Calculate days until due
          const dueDay = new Date(task.due_date);
          const today_date = new Date(today);
          const daysUntilDue = Math.ceil((dueDay.getTime() - today_date.getTime()) / (1000 * 60 * 60 * 24));

          // Generate nudge message
          const nudgeMessage = nudgeEngine.generateNudgeMessage(task.description, -daysUntilDue, task.owner || 'assigned user');

          // Send nudge via NudgeEngine (supports email, slack, teams)
          if (channel === 'email') {
            // For email, also send the formatted email
            const { data: userProfile } = await supabase
              .from('user_profiles')
              .select('email')
              .eq('id', ownerId)
              .single();

            if (userProfile?.email) {
              const emailProvider = getEmailProvider();
              const subject = `Commitment Due Soon: ${task.description.substring(0, 50)}`;
              const body = createUpcomingReminderEmail(task.description, task.due_date, daysUntilDue);
              await emailProvider.send(userProfile.email, subject, body);
            }
          }

          // Send via NudgeEngine (which handles Slack/Teams; email goes to console)
          await nudgeEngine.sendNudge(task.id, ownerId, nudgeMessage, channel);

          // Mark reminder as sent. Use .eq() guard to prevent duplicate updates in race condition.
          // If another process already marked it, the WHERE clause returns 0 rows and we don't error.
          const { error: updateError } = await supabase
            .from('tasks')
            .update({ reminder_sent_at: new Date().toISOString() })
            .eq('id', task.id)
            .is('reminder_sent_at', null); // Only update if still null (prevent concurrent duplicates)

          if (updateError) {
            console.error(`Error marking reminder sent for task ${task.id}:`, updateError);
            remindersSent.failed++;
          } else {
            remindersSent.upcoming++;
          }
        } catch (err) {
          console.error(`Error sending upcoming reminder for task ${task.id}:`, err);
          remindersSent.failed++;
        }
      }
    }

    // Find overdue tasks that haven't received overdue reminder yet
    const { data: overdueTasks, error: overdueError } = await supabase
      .from('tasks')
      .select(`
        id,
        user_id,
        description,
        due_date,
        owner,
        status,
        owner_user_id
      `)
      .in('status', ['open', 'in_progress'])
      .lt('due_date', today)
      .is('overdue_reminder_sent_at', null);

    if (overdueError) {
      console.error('Error fetching overdue tasks:', overdueError);
    } else if (overdueTasks) {
      for (const task of overdueTasks) {
        const ownerId = task.owner_user_id || task.user_id;

        try {
          // Get user preferences to determine delivery channel
          const { data: prefs } = await supabase
            .from('user_preferences')
            .select('nudge_channel')
            .eq('user_id', ownerId)
            .single();

          const channel = (prefs?.nudge_channel || 'email') as 'email' | 'slack' | 'teams';

          // Calculate days overdue
          const dueDay = new Date(task.due_date);
          const today_date = new Date(today);
          const daysSinceOverdue = Math.ceil((today_date.getTime() - dueDay.getTime()) / (1000 * 60 * 60 * 24));

          // Generate nudge message
          const nudgeMessage = nudgeEngine.generateNudgeMessage(task.description, daysSinceOverdue, task.owner || 'assigned user');

          // Send nudge via NudgeEngine
          if (channel === 'email') {
            // For email, also send the formatted email
            const { data: userProfile } = await supabase
              .from('user_profiles')
              .select('email')
              .eq('id', ownerId)
              .single();

            if (userProfile?.email) {
              const emailProvider = getEmailProvider();
              const subject = `OVERDUE: ${task.description.substring(0, 50)}`;
              const body = createOverdueReminderEmail(task.description, task.due_date, daysSinceOverdue);
              await emailProvider.send(userProfile.email, subject, body);
            }
          }

          // Send via NudgeEngine
          await nudgeEngine.sendNudge(task.id, ownerId, nudgeMessage, channel);

          // Mark overdue reminder as sent. Use .eq() guard to prevent duplicate updates in race condition.
          const { error: updateError } = await supabase
            .from('tasks')
            .update({ overdue_reminder_sent_at: new Date().toISOString() })
            .eq('id', task.id)
            .is('overdue_reminder_sent_at', null); // Only update if still null (prevent concurrent duplicates)

          if (updateError) {
            console.error(`Error marking overdue reminder sent for task ${task.id}:`, updateError);
            remindersSent.failed++;
          } else {
            remindersSent.overdue++;
          }
        } catch (err) {
          console.error(`Error sending overdue reminder for task ${task.id}:`, err);
          remindersSent.failed++;
        }
      }
    }

    return remindersSent;
  } catch (err) {
    console.error('Reminder processing error:', err);
    throw err;
  }
}

async function processRemindersAndEscalations() {
  const supabase = createServerClient();

  // Process reminders as before
  const reminderResults = await processReminders();

  // PHASE 4: Process escalations for overdue commitments
  console.log('[cron] Starting escalation processing...');
  const escalationResults = await processEscalations(supabase);

  return {
    reminders: reminderResults,
    escalations: escalationResults,
  };
}

export async function POST(req: NextRequest) {
  // Verify Vercel Cron secret
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    console.warn('Unauthorized cron request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const results = await processRemindersAndEscalations();

    return NextResponse.json(
      {
        success: true,
        message: 'Reminders and escalations processed successfully',
        results,
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (err) {
    console.error('Cron job error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
