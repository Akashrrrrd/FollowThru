import { createClient } from '@supabase/supabase-js';

interface MetricsData {
  period: string;
  date_range: { start: string; end: string };
  follow_through: {
    total_commitments: number;
    completed: number;
    dismissed: number;
    percentage: number;
  };
  velocity: {
    current_week: number;
    previous_week: number;
    trend: Array<{ week: string; count: number }>;
  };
  decision_revisits: {
    average: number;
    top_revisited: Array<{
      id: string;
      description: string;
      revisit_count: number;
      reschedule_count: number;
      scope_changes: number;
    }>;
  };
}

export class ExecutiveDashboardService {
  private supabase: any;

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  /**
   * Get metrics for a specific period
   */
  async getMetrics(userId: string, period: 'week' | 'month' | 'quarter' | 'year'): Promise<MetricsData> {
    const dateRange = this.getDateRange(period);

    // Get follow-through metrics
    const { data: tasks } = await this.supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', dateRange.start.toISOString())
      .lte('created_at', dateRange.end.toISOString());

    const followThrough = this.calculateFollowThrough(tasks || []);

    // Get velocity
    const velocity = await this.calculateVelocity(userId, dateRange);

    // Get decision revisits
    const revisits = await this.getDecisionRevisits(userId);

    return {
      period,
      date_range: {
        start: dateRange.start.toISOString().split('T')[0],
        end: dateRange.end.toISOString().split('T')[0],
      },
      follow_through: {
        total_commitments: followThrough.totalCommitments,
        completed: followThrough.completed,
        dismissed: followThrough.dismissed,
        percentage: followThrough.percentage,
      },
      velocity: {
        current_week: velocity.currentWeek,
        previous_week: velocity.previousWeek,
        trend: velocity.trend,
      },
      decision_revisits: {
        average: revisits.average,
        top_revisited: revisits.topRevisited.map((r) => ({
          id: r.id,
          description: r.description,
          revisit_count: r.revisitCount,
          reschedule_count: r.rescheduleCount,
          scope_changes: r.scopeChanges,
        })),
      },
    };
  }

  /**
   * Calculate follow-through percentage
   */
  private calculateFollowThrough(
    tasks: any[],
  ): {
    totalCommitments: number;
    completed: number;
    dismissed: number;
    percentage: number;
  } {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === 'done' || t.status === 'completed').length;
    const dismissed = tasks.filter((t) => t.state === 'DISMISSED').length;

    return {
      totalCommitments: total,
      completed,
      dismissed,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }

  /**
   * Calculate velocity trends
   */
  private async calculateVelocity(
    userId: string,
    dateRange: { start: Date; end: Date },
  ): Promise<{
    currentWeek: number;
    previousWeek: number;
    trend: Array<{ week: string; count: number }>;
  }> {
    const { data: tasks } = await this.supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', dateRange.start.toISOString())
      .lte('created_at', dateRange.end.toISOString());

    const trend: Array<{ week: string; count: number }> = [];
    let currentWeek = 0;
    let previousWeek = 0;

    // Group by week
    const weeks = new Map<string, number>();
    (tasks || []).forEach((task: any) => {
      const date = new Date(task.created_at);
      const week = this.getWeekString(date);
      weeks.set(week, (weeks.get(week) || 0) + 1);
    });

    // Sort and format trend
    Array.from(weeks.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([week, count]) => {
        trend.push({ week, count });
      });

    if (trend.length > 0) {
      currentWeek = trend[trend.length - 1].count;
      previousWeek = trend.length > 1 ? trend[trend.length - 2].count : 0;
    }

    return { currentWeek, previousWeek, trend };
  }

  /**
   * Get decision revisit statistics
   */
  private async getDecisionRevisits(
    userId: string,
  ): Promise<{
    average: number;
    topRevisited: Array<{
      id: string;
      description: string;
      revisitCount: number;
      rescheduleCount: number;
      scopeChanges: number;
    }>;
  }> {
    const { data: revisits } = await this.supabase
      .from('decision_revisits')
      .select('*, tasks(id, description, user_id)')
      .order('revisit_count', { ascending: false })
      .limit(5);

    const filtered = (revisits || []).filter((r: any) => r.tasks?.user_id === userId);

    const average =
      filtered.length > 0
        ? Math.round(
            filtered.reduce((sum: number, r: any) => sum + r.revisit_count, 0) /
              filtered.length,
          )
        : 0;

    return {
      average,
      topRevisited: filtered.map((r: any) => ({
        id: r.task_id,
        description: r.tasks?.description || 'Unknown',
        revisitCount: r.revisit_count,
        rescheduleCount: r.reschedule_count,
        scopeChanges: r.scope_changes,
      })),
    };
  }

  private getDateRange(period: string): { start: Date; end: Date } {
    const end = new Date();
    const start = new Date();

    switch (period) {
      case 'week':
        start.setDate(end.getDate() - 7);
        break;
      case 'month':
        start.setMonth(end.getMonth() - 1);
        break;
      case 'quarter':
        start.setMonth(end.getMonth() - 3);
        break;
      case 'year':
        start.setFullYear(end.getFullYear() - 1);
        break;
    }

    return { start, end };
  }

  private getWeekString(date: Date): string {
    const year = date.getFullYear();
    const weekNum = this.getWeekNumber(date);
    return `W${weekNum} ${year}`;
  }

  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }
}
