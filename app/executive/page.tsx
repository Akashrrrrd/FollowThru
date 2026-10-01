'use client';

import { useEffect, useState, useCallback } from 'react';
import { ProtectedRoute } from '@/components/protected-route';
import { PageLoading, PageError } from '@/components/page-loading';
import { useAuthFetch } from '@/hooks/use-auth-fetch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Target,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExecutiveDashboardData {
  period: string;
  date_range: { start: string; end: string };
  follow_through: {
    total_commitments: number;
    completed: number;
    dismissed: number;
    percentage: number;
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
  velocity: {
    trend: Array<{ week: string; count: number }>;
    current_week: number;
    previous_week: number;
  };
}

function ExecutiveDashboardContent() {
  const authFetch = useAuthFetch();
  const [data, setData] = useState<ExecutiveDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<string>('month');
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch('/api/dashboard/executive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period }),
      });

      const result = await res.json();
      if (!res.ok) {
        setError(result.error || 'Failed to load dashboard data.');
        return;
      }

      setData(result);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError('Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [period, authFetch]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDashboard();
    setRefreshing(false);
  }, [fetchDashboard]);

  if (loading) {
    return <PageLoading />;
  }

  if (error) {
    return <PageError message={error} />;
  }

  if (!data) {
    return <PageError message="No dashboard data available." />;
  }

  const velocityChange =
    data.velocity.previous_week > 0
      ? ((data.velocity.current_week - data.velocity.previous_week) / data.velocity.previous_week) * 100
      : 0;

  const followThroughColor =
    data.follow_through.percentage >= 80
      ? 'text-green-600'
      : data.follow_through.percentage >= 60
        ? 'text-yellow-600'
        : 'text-red-600';

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Executive Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Performance metrics and insights for decision-making
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Last Week</SelectItem>
              <SelectItem value="month">Last Month</SelectItem>
              <SelectItem value="quarter">Last Quarter</SelectItem>
              <SelectItem value="year">Last Year</SelectItem>
            </SelectContent>
          </Select>

          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            size="sm"
            variant="outline"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="mb-8 grid gap-4 md:grid-cols-3">
        {/* Follow-Through Rate */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Follow-Through Rate</p>
              <p className={cn('text-3xl font-bold mt-2', followThroughColor)}>
                {data.follow_through.percentage}%
              </p>
              <p className="text-xs text-gray-500 mt-2">
                {data.follow_through.completed} of {data.follow_through.total_commitments} completed
              </p>
            </div>
            <CheckCircle2 className={cn('h-10 w-10', followThroughColor)} />
          </div>
        </div>

        {/* Velocity */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Current Velocity</p>
              <p className="text-3xl font-bold mt-2 text-blue-600">
                {data.velocity.current_week}
              </p>
              <div className="flex items-center gap-1 mt-2">
                {velocityChange >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
                <p className={`text-xs ${velocityChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {Math.abs(velocityChange).toFixed(1)}% vs previous
                </p>
              </div>
            </div>
            <BarChart3 className="h-10 w-10 text-blue-600" />
          </div>
        </div>

        {/* Decision Revisits */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg. Revisits</p>
              <p className="text-3xl font-bold mt-2 text-amber-600">
                {data.decision_revisits.average}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                per commitment
              </p>
            </div>
            <RotateCcw className="h-10 w-10 text-amber-600" />
          </div>
        </div>
      </div>

      {/* Velocity Trend Chart */}
      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Velocity Trend</h2>
        <div className="flex items-end gap-2" style={{ height: '200px' }}>
          {(data.velocity.trend || []).length > 0 ? (
            data.velocity.trend.map((week, idx) => {
              const maxCount = Math.max(...data.velocity.trend.map((w) => w.count || 0), 1);
              const heightPercent = (week.count / maxCount) * 100;

              return (
                <div key={idx} className="flex flex-1 flex-col items-center gap-2">
                  <div
                    className="w-full rounded-t bg-blue-500 transition-all hover:bg-blue-600"
                    style={{ height: `${heightPercent}%`, minHeight: week.count > 0 ? '20px' : '0' }}
                    title={`${week.week}: ${week.count} commitments`}
                  />
                  <span className="text-xs text-gray-600">{week.week}</span>
                  <span className="text-sm font-semibold text-gray-900">{week.count}</span>
                </div>
              );
            })
          ) : (
            <div className="w-full text-center text-gray-500">No velocity data available</div>
          )}
        </div>
      </div>

      {/* Top Revisited Commitments */}
      {data.decision_revisits.top_revisited.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Most Revisited Commitments
          </h2>
          <div className="space-y-3">
            {data.decision_revisits.top_revisited.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{item.description}</p>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="outline">
                      <RotateCcw className="h-3 w-3 mr-1" />
                      {item.revisit_count} revisits
                    </Badge>
                    {item.reschedule_count > 0 && (
                      <Badge variant="outline">
                        <Clock className="h-3 w-3 mr-1" />
                        {item.reschedule_count} reschedules
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ExecutiveDashboardPage() {
  return (
    <ProtectedRoute>
      <ExecutiveDashboardContent />
    </ProtectedRoute>
  );
}
