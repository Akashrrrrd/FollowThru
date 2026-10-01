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
      recipient_email,
      recipient_name,
      subject,
      email_body,
    } = body;

    if (!task_id || !recipient_email || !recipient_name || !subject || !email_body) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 },
      );
    }

    const supabase = createServerClient();
    const service = new CompletionNotificationService(supabase);

    const notificationId = await service.createDraftNotification(
      task_id,
      recipient_email,
      recipient_name,
      subject,
      email_body,
    );

    return NextResponse.json({ id: notificationId, status: 'draft' });
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
