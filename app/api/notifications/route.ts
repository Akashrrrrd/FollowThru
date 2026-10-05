import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUserFromRequest } from '@/lib/supabase-server';

/**
 * GET /api/notifications
 * Fetch all notifications for the current user
 * Supports filtering by type, read status, and pagination
 * Query params:
 *   - type: notification type filter (optional)
 *   - unread_only: true/false to filter unread notifications (optional)
 *   - limit: number of results (default: 50)
 *   - offset: pagination offset (default: 0)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[NotificationsAPI] User authenticated:', user.userId);
    const supabase = createServerClient();
    const url = new URL(request.url);
    const type = url.searchParams.get('type');
    const unreadOnly = url.searchParams.get('unread_only') === 'true';
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    console.log('[NotificationsAPI] Query params - type:', type, 'unreadOnly:', unreadOnly, 'limit:', limit, 'offset:', offset);

    // Build query
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.userId)
      .order('created_at', { ascending: false });
    
    console.log('[NotificationsAPI] Built initial query for user:', user.userId);

    // Filter by type if provided (column name is 'notification_type')
    if (type) {
      query = query.eq('notification_type', type);
    }

    // Filter by read status if requested
    if (unreadOnly) {
      query = query.is('read_at', null);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    console.log('[NotificationsAPI] Executing query...');
    const { data, error, count } = await query;

    if (error) {
      console.error('[NotificationsAPI] Database error details:', {
        message: error.message,
        code: (error as any).code,
        details: (error as any).details,
        hint: (error as any).hint
      });
      return NextResponse.json(
        { error: 'Failed to fetch notifications', details: error.message },
        { status: 500 }
      );
    }

    console.log('[NotificationsAPI] Query successful. Rows:', data?.length, 'Count:', count);

    // Calculate unread count
    const unreadCountQuery = await supabase
      .from('notifications')
      .select('id', { count: 'exact' })
      .eq('user_id', user.userId)
      .is('read_at', null);

    const unreadCount = unreadCountQuery.count || 0;

    return NextResponse.json({
      notifications: data || [],
      total: count || 0,
      unreadCount,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[NotificationsAPI] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notifications/read-all
 * Mark all unread notifications as read for the current user
 */
export async function POST(request: NextRequest) {
  try {
    // Check if this is a read-all request
    const url = new URL(request.url);
    if (url.pathname.endsWith('/read-all')) {
      const user = await getUserFromRequest(request);
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const supabase = createServerClient();
      const now = new Date().toISOString();

      const { error } = await supabase
        .from('notifications')
        .update({ read_at: now, updated_at: now })
        .eq('user_id', user.userId)
        .is('read_at', null);

      if (error) {
        console.error('[NotificationsAPI] Error marking all as read:', error);
        return NextResponse.json(
          { error: 'Failed to update notifications' },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    console.error('[NotificationsAPI] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
