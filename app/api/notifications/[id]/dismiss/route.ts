import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUserFromRequest } from '@/lib/supabase-server';

/**
 * POST /api/notifications/[id]/dismiss
 * Dismiss (hide) a specific notification
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const notificationId = params.id;
    const supabase = await createServerClient();
    const now = new Date().toISOString();

    // Verify ownership and mark as dismissed
    const { data, error } = await supabase
      .from('notifications')
      .update({ dismissed_at: now, updated_at: now })
      .eq('id', notificationId)
      .eq('user_id', user.userId)
      .select('id')
      .single();

    if (error) {
      console.error('[NotificationsDismissAPI] Error:', error);
      return NextResponse.json(
        { error: 'Failed to dismiss notification' },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, notification: data });
  } catch (error) {
    console.error('[NotificationsDismissAPI] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
