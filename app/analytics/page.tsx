'use client';

/**
 * Analytics Dashboard
 *
 * Main page for viewing commitment analytics and trends.
 * Role-based views:
 * - Manager: Organization-wide analytics with team drill-down
 * - Team Lead: Team analytics with member drill-down
 * - Member: Personal analytics only
 */

import React, { useState, useMemo } from 'react';
import { ProtectedRoute } from '@/components/protected-route';
import { useTeamContext } from '@/hooks/use-team-context';
import { useOrganizationContext } from '@/hooks/use-organization-context';
import { useAnalytics } from '@/hooks/use-analytics';
import {
  AnalyticsSummaryCard,
  AnalyticsSummaryGrid,
} from '@/components/analytics-summary-card';
import { SimpleBarChart, SimpleLineChart } from '@/components/analytics-chart';
import {
  AnalyticsTable,
  StatusBreakdownTable,
} from '@/components/analytics-table';

function AnalyticsDashboard() {
  const { organization, isManager } = useOrganizationContext();
  const { context: teamContext } = useTeamContext();
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [selectedTeamId, setSelectedTeamId] = useState<string | undefined>();

  // Calculate date range
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = (() => {
    const d = new Date();
    switch (dateRange) {
      case '7d':
        d.setDate(d.getDate() - 7);
        break;
      case '30d':
        d.setDate(d.getDate() - 30);
        break;
      case '90d':
        d.setDate(d.getDate() - 90);
        break;
    }
    return d.toISOString().split('T')[0];
  })();

  // Memoize params to prevent infinite refetch loop
  const analyticsParams = useMemo(
    () => ({
      startDate,
      endDate,
      teamId: selectedTeamId,
    }),
    [startDate, endDate, selectedTeamId]
  );

  // Fetch analytics - params object is memoized so dependency is stable
  const { data, loading, error, refetch } = useAnalytics({
    params: analyticsParams,
  });

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <h2 className="font-semibold text-red-900">Error</h2>
          <p className="mt-1 text-sm text-red-700">{error}</p>
          <button
            onClick={refetch}
            className="mt-4 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-900 rounded font-medium transition"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
          <p className="mt-4 text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  const { analytics, trends } = data;
  const metrics = analytics.metrics;

  /*
   * -------------------------------------------------------
   * BUILD SUMMARY CARDS
   * -------------------------------------------------------
   */

  const summaryCards: Array<{
    title: string;
    value: string | number;
    variant: 'default' | 'success' | 'warning' | 'danger';
  }> = [
    {
      title: 'Total Commitments',
      value: metrics.total,
      variant: 'default',
    },
    {
      title: 'Completion Rate',
      value: `${metrics.completion_rate}%`,
      variant: metrics.completion_rate >= 80 ? 'success' : metrics.completion_rate >= 60 ? 'default' : 'warning',
    },
    {
      title: 'On-Time Rate',
      value: `${metrics.on_time_rate}%`,
      variant: metrics.on_time_rate >= 80 ? 'success' : metrics.on_time_rate >= 60 ? 'default' : 'warning',
    },
    {
      title: 'Follow-Through Score',
      value: `${metrics.follow_through_score}%`,
      variant: metrics.follow_through_score >= 80 ? 'success' : metrics.follow_through_score >= 60 ? 'default' : 'warning',
    },
  ];

  /*
   * -------------------------------------------------------
   * BUILD BREAKDOWN DATA
   * -------------------------------------------------------
   */

  const timeSeriesData = trends.completion.map((point) => ({
    date: point.week,
    value: point.completionRate,
  }));

  const statusTableData = Object.entries(analytics.byStatus).map(
    ([status, count]) => ({
      status: status.replace('_', ' ').charAt(0).toUpperCase() + status.slice(1),
      count,
      percentage: metrics.total > 0 ? Math.round((count / metrics.total) * 100) : 0,
    })
  );

  /*
   * -------------------------------------------------------
   * RENDER
   * -------------------------------------------------------
   */

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
              <p className="mt-1 text-sm text-gray-600">
                Commitment metrics and trends
              </p>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4">
              {/* Date Range Selector */}
              <div className="flex gap-2">
                {(['7d', '30d', '90d'] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setDateRange(range)}
                    className={`px-3 py-2 rounded font-medium text-sm transition ${
                      dateRange === range
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
                  </button>
                ))}
              </div>

              {/* Team Selector (for managers and team leads) */}
              {(isManager || (teamContext?.teams?.length ?? 0) > 1) && (
                <select
                  value={selectedTeamId || ''}
                  onChange={(e) => setSelectedTeamId(e.target.value || undefined)}
                  className="px-3 py-2 border rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition"
                >
                  <option value="">All Teams</option>
                  {teamContext?.teams?.map((team) => (
                    <option key={team.teamId} value={team.teamId}>
                      {team.teamName}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Summary Cards */}
        <div className="mb-8">
          <AnalyticsSummaryGrid cards={summaryCards} />
        </div>

        {/* Key Metrics Grid */}
        <div className="mb-8 grid gap-6 md:grid-cols-2">
          <div className="rounded-lg border bg-white p-6">
            <h3 className="font-semibold text-gray-900">Status Distribution</h3>
            <dl className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <dt className="text-sm text-gray-600">In Progress</dt>
                <dd className="text-2xl font-bold text-gray-900">
                  {metrics.in_progress}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-sm text-gray-600">Blocked</dt>
                <dd className="text-2xl font-bold text-red-600">
                  {metrics.blocked}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-sm text-gray-600">Overdue</dt>
                <dd className="text-2xl font-bold text-amber-600">
                  {metrics.overdue}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-sm text-gray-600">Completed</dt>
                <dd className="text-2xl font-bold text-green-600">
                  {metrics.completed}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border bg-white p-6">
            <h3 className="font-semibold text-gray-900">Key Metrics</h3>
            <dl className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <dt className="text-sm text-gray-600">Avg Days to Complete</dt>
                <dd className="text-2xl font-bold text-gray-900">
                  {metrics.avg_days_to_complete}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-sm text-gray-600">Overdue Rate</dt>
                <dd className="text-2xl font-bold text-amber-600">
                  {metrics.overdue_rate}%
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-sm text-gray-600">Escalations</dt>
                <dd className="text-2xl font-bold text-red-600">
                  {metrics.escalation_count}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Charts */}
        <div className="mb-8 grid gap-6">
          {trends.completion.length > 0 && (
            <SimpleLineChart
              title="Completion Rate Trend"
              data={timeSeriesData}
              yAxisLabel="Completion Rate (%)"
            />
          )}

          {Object.keys(analytics.byStatus).length > 0 && (
            <SimpleBarChart
              title="Status Breakdown"
              data={Object.entries(analytics.byStatus).map(([status, count]) => ({
                label: status.replace('_', ' ').substring(0, 10),
                value: count,
              }))}
              unit="commitments"
            />
          )}
        </div>

        {/* Status Table */}
        <div className="mb-8">
          <StatusBreakdownTable data={analytics.byStatus} />
        </div>

        {/* Team Breakdown (for managers) */}
        {isManager && analytics.byTeam && Object.keys(analytics.byTeam).length > 0 && (
          <div className="mb-8">
            <AnalyticsTable
              title="Breakdown by Team"
              columns={[
                { key: 'team', label: 'Team' },
                {
                  key: 'count',
                  label: 'Commitments',
                  align: 'right',
                },
              ]}
              data={Object.entries(analytics.byTeam).map(([teamId, count]) => ({
                team: teamId,
                count,
              }))}
            />
          </div>
        )}

        {/* Escalation Trend */}
        {trends.escalation.length > 0 && (
          <div>
            <SimpleLineChart
              title="Escalation Trend (30 days)"
              data={trends.escalation.map((point) => ({
                date: point.date,
                value: point.escalations,
              }))}
              yAxisLabel="Escalations"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <ProtectedRoute>
      <AnalyticsDashboard />
    </ProtectedRoute>
  );
}
