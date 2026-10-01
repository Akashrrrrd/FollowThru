import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { getEmailProvider, createUpcomingReminderEmail, createOverdueReminderEmail } from '@/lib/email-provider';

export const dynamic = 'force-dynamic';

/**
 * Vercel Cron Job: Send commitment reminders
 * 
 * Scheduled to run daily (configuration in vercel.json)
 * Finds open commitments due soon or overdue, sends reminders to owners
 * 
 * Security:
 * - Requires Authorization header with CRON_SECRET
 * - Only processes legitimate reminder jobs, never sends duplicates
 * - Idempotent: safe to retry without double-sending
 */

interface ReminderMetadata {
  reminder_sent_at?: string;
  overdue_reminder_sent_at?: string;
  last_reminder_type?: 'upcoming' | 'overdue';
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

    const success = await emailProvider.send(email, subject, body);
    return success;
  } catch (err) {
    console.error('Send reminder email error:', err);
    return false;
  }
}

async function processReminders() {
  const supabase = createServerClient();
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
        // Get user email
        const { data: userProfile } = await supabase
          .from('user_profiles')
          .select('email')
          .eq('id', task.owner_user_id || task.user_id)
          .single();

        if (userProfile?.email) {
          const success = await sendReminderEmail(userProfile.email, task.description, task.due_date, 'upcoming');

          if (success) {
            // Mark reminder as sent
            await supabase.from('tasks').update({ reminder_sent_at: new Date().toISOString() }).eq('id', task.id);

            remindersSent.upcoming++;
          } else {
            remindersSent.failed++;
          }
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
        // Get user email
        const { data: userProfile } = await supabase
          .from('user_profiles')
          .select('email')
          .eq('id', task.owner_user_id || task.user_id)
          .single();

        if (userProfile?.email) {
          const success = await sendReminderEmail(userProfile.email, task.description, task.due_date, 'overdue');

          if (success) {
            // Mark overdue reminder as sent
            await supabase
              .from('tasks')
              .update({ overdue_reminder_sent_at: new Date().toISOString() })
              .eq('id', task.id);

            remindersSent.overdue++;
          } else {
            remindersSent.failed++;
          }
        }
      }
    }

    return remindersSent;
  } catch (err) {
    console.error('Reminder processing error:', err);
    throw err;
  }
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
    const results = await processReminders();

    return NextResponse.json(
      {
        success: true,
        message: 'Reminders processed successfully',
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
