import { NextRequest } from 'next/server';
import { createServerClient, getUserFromRequest } from '@/lib/supabase-server';
import { ExecutiveDashboardService } from '@/lib/executive-dashboard-service';
import { successResponse, unauthorized, validationError, internalError } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return unauthorized('You must be signed in');
    }

    const body = await request.json().catch(() => ({}));
    const { period = 'month' } = body as { period?: string };

    if (!['week', 'month', 'quarter', 'year'].includes(period)) {
      return validationError('Invalid period. Must be: week, month, quarter, or year', { field: 'period' });
    }

    const supabase = createServerClient();
    const service = new ExecutiveDashboardService(supabase);

    const metrics = await service.getMetrics(user.userId, period as any);

    return successResponse(metrics);
  } catch (error) {
    console.error('Executive dashboard error:', error);
    return internalError('Failed to fetch dashboard metrics');
  }
}
