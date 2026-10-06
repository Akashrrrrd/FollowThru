import { NextRequest } from 'next/server';
import { createServerClient, getUserFromRequest } from '@/lib/supabase-server';
import { successResponse, unauthorized, internalError, listResponse, parsePagination } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/**
 * GET /api/notifications
 * Fetch all notifications for the current user
 * Query params:
 *   - type: notification type filter (optional)
 *   - unread_only: true/false to filter unread notifications (optional)
 *   - page: page number (default: 1)
 *   - per_page: results per page (default: 50, max: 100)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return unauthorized('You must be signed in');
    }

    const supabase = createServerClient();
    const url = new URL(request.url);
    
    // Parse query parameters
    const type = url.searchParams.get('type');
    const unreadOnly = url.searchParams.get('unread_only') === 'true';
    const pagination = parsePagination({
      page: url.searchParams.get('page') ?? undefined,
      per_page: url.searchParams.get('per_page') ?? undefined,
    });

    // Build query
    let query = supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', user.userId)
      .order('created_at', { ascending: false });

    if (type) {
      query = query.eq('notification_type', type);
    }

    if (unreadOnly) {
      query = query.is('read_at', null);
    }

    // Apply pagination
    query = query.range(pagination.offset, pagination.offset + pagination.per_page - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('[NotificationsAPI] Database error:', error);
      return internalError('Failed to fetch notifications');
    }

    // Get unread count
    const { count: unreadCount, error: unreadError } = await supabase
      .from('notifications')
      .select('id', { count: 'exact' })
      .eq('user_id', user.userId)
      .is('read_at', null);

    if (unreadError) {
      console.warn('Failed to get unread count:', unreadError);
    }

    return listResponse(
      data || [],
      count || 0,
      pagination,
      `Fetched ${data?.length || 0} notifications`
    );
  } catch (error) {
    console.error('[NotificationsAPI] Error:', error);
    return internalError('An unexpected error occurred');
  }
}

/**
 * POST /api/notifications
 * Mark all unread notifications as read for the current user
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return unauthorized('You must be signed in');
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
      return internalError('Failed to update notifications');
    }

    return successResponse({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('[NotificationsAPI] Error:', error);
    return internalError('An unexpected error occurred');
  }
}
