import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { CompletionNotificationService } from '@/lib/completion-notification-service';
import { getUserFromRequest } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const userResult = await getUserFromRequest(request);
    if (!userResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      task_id,
      action = 'create_draft',
      recipient_email,
      recipient_name,
      subject,
      email_body,
    } = body;

    if (!task_id) {
      return NextResponse.json(
        { error: 'task_id required' },
        { status: 400 },
      );
    }

    const supabase = createServerClient();

    // Verify task ownership
    const { data: task } = await supabase
      .from('tasks')
      .select('id, user_id')
      .eq('id', task_id)
      .single();

    if (!task || task.user_id !== userResult.userId) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const service = new CompletionNotificationService(supabase);

    // If action is generate_email, generate it with Claude
    if (action === 'generate_email') {
      if (!recipient_name) {
        return NextResponse.json(
          { error: 'recipient_name required for email generation' },
          { status: 400 },
        );
      }

      // Get task details
      const { data: fullTask } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', task_id)
        .single();

      if (!fullTask) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      }

      // Get meeting context
      let meetingContext = 'Commitment from meeting';
      let sourceQuote = fullTask.source_quote || fullTask.description;

      if (fullTask.meeting_id) {
        const { data: meeting } = await supabase
          .from('meetings')
          .select('topic')
          .eq('id', fullTask.meeting_id)
          .single();

        if (meeting?.topic) {
          meetingContext = `From meeting: ${meeting.topic}`;
        }

        // Try to get evidence with quote
        const { data: evidence } = await supabase
          .from('commitment_evidence')
          .select('quote')
          .eq('task_id', task_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (evidence?.quote) {
          sourceQuote = evidence.quote;
        }
      }

      // Generate email
      const emailData = await service.generateCompletionEmail(
        fullTask.description,
        fullTask.owner,
        meetingContext,
        sourceQuote,
        recipient_name,
        new Date().toLocaleDateString('en-US'),
      );

      return NextResponse.json({
        generated: true,
        subject: emailData.subject,
        body: emailData.body,
      });
    }

    // If action is create_draft or explicit
    if (action === 'create_draft') {
      if (!recipient_email || !recipient_name || !subject || !email_body) {
        return NextResponse.json(
          { error: 'recipient_email, recipient_name, subject, and email_body required' },
          { status: 400 },
        );
      }

      const notificationId = await service.createDraftNotification(
        task_id,
        recipient_email,
        recipient_name,
        subject,
        email_body,
      );

      return NextResponse.json({ id: notificationId, status: 'draft' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Create notification error:', error);
    return NextResponse.json(
      { error: 'Failed to create notification' },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const userResult = await getUserFromRequest(request);
    if (!userResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const taskId = request.nextUrl.searchParams.get('task_id');
    if (!taskId) {
      return NextResponse.json({ error: 'task_id required' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Verify task ownership
    const { data: task } = await supabase
      .from('tasks')
      .select('id, user_id')
      .eq('id', taskId)
      .single();

    if (!task || task.user_id !== userResult.userId) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const service = new CompletionNotificationService(supabase);
    const history = await service.getNotificationHistory(taskId);

    return NextResponse.json({ history });
  } catch (error) {
    console.error('Get notifications error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userResult = await getUserFromRequest(request);
    if (!userResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { notification_id, action } = body;

    if (!notification_id || !action) {
      return NextResponse.json(
        { error: 'notification_id and action required' },
        { status: 400 },
      );
    }

    const supabase = createServerClient();

    // Verify ownership by checking task
    const { data: notification } = await supabase
      .from('completion_notifications')
      .select('task_id')
      .eq('id', notification_id)
      .single();

    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    const { data: task } = await supabase
      .from('tasks')
      .select('user_id')
      .eq('id', notification.task_id)
      .single();

    if (!task || task.user_id !== userResult.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const service = new CompletionNotificationService(supabase);

    if (action === 'send') {
      await service.sendNotification(notification_id);
      return NextResponse.json({ status: 'sent', message: 'Email sent successfully' });
    } else if (action === 'update') {
      const { subject, email_body } = body;
      await service.updateDraftNotification(notification_id, {
        subject,
        emailBody: email_body,
      });
      return NextResponse.json({ status: 'updated' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Update notification error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update notification' },
      { status: 500 },
    );
  }
}
