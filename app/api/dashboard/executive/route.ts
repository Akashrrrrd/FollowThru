import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { ExecutiveDashboardService } from '@/lib/executive-dashboard-service';
import { getUserFromRequest } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const userResult = await getUserFromRequest(request);
    if (!userResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { period = 'month' } = body;

    if (!['week', 'month', 'quarter', 'year'].includes(period)) {
      return NextResponse.json({ error: 'Invalid period' }, { status: 400 });
    }

    const supabase = createServerClient();
    const service = new ExecutiveDashboardService(supabase);

    const metrics = await service.getMetrics(userResult.userId, period as any);

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Executive dashboard error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard metrics' },
      { status: 500 },
    );
  }
}
