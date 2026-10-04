'use client';

import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, AlertCircle, CheckCircle2, Clock, TrendingDown } from 'lucide-react';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/protected-route';
import { PageLoading, PageError, EmptyState } from '@/components/page-loading';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuthFetch } from '@/hooks/use-auth-fetch';
import { cn } from '@/lib/utils';

interface OrganizationTaskMetrics {
  total: number;
  completed: number;
  in_progress: number;
  blocked: number;
  overdue: number;
  needs_assignment_review: number;
  unassigned: number;
}

interface TeamMetrics {
  team_id: string;
  team_name: string;
  total: number;
  completed: number;
  in_progress: number;
  blocked: number;
  overdue: number;
  needs_assignment_review: number;
  unassigned: number;
  member_count: number;
}

interface ManagerDashboardData {
  organization_id: string;
  organization_name: string;
  summary: OrganizationTaskMetrics;
  teams: TeamMetrics[];
}

function ManagerDashboardContent() {
  const authFetch = useAuthFetch();

  const [dashboard, setDashboard] = useState<ManagerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  // Fetch dashboard
  const fetchDashboard = useCallback(async () => {
    setRefreshing(true);
    setError(null);

    try {
      const res = await authFetch('/api/dashboard/manager');
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to load dashboard');
        setRefreshing(false);
        setLoading(false);
        return;
      }

      setDashboard(data);
      setLoading(false);
      setRefreshing(false);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError('Failed to load dashboard');
      setLoading(false);
      setRefreshing(false);
    }
  }, [authFetch]);

  // Load on mount
  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (loading) {
    return <PageLoading />;
  }

  if (error && !dashboard) {
    return <PageError message={error} />;
  }

  if (!dashboard) {
    return <EmptyState title="No data" description="Failed to load dashboard" />;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Organization Dashboard
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
            {dashboard.organization_name} — Organization-wide commitment visibility
          </p>
        </div>

        <Button variant="outline" size="sm" disabled={refreshing} onClick={fetchDashboard}>
          <RefreshCw className={cn('mr-2 h-3.5 w-3.5', refreshing && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <p className="text-xs font-medium text-slate-500">TOTAL COMMITMENTS</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{dashboard.summary.total}</p>
          <p className="mt-1 text-xs text-slate-500">across all teams</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <p className="text-xs font-medium text-slate-500">COMPLETED</p>
          </div>
          <p className="mt-2 text-3xl font-bold text-emerald-600">{dashboard.summary.completed}</p>
          <p className="mt-1 text-xs text-slate-500">
            {dashboard.summary.total > 0
              ? Math.round((dashboard.summary.completed / dashboard.summary.total) * 100)
              : 0}
            %
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-600" />
            <p className="text-xs font-medium text-slate-500">OVERDUE</p>
          </div>
          <p className="mt-2 text-3xl font-bold text-amber-600">{dashboard.summary.overdue}</p>
          <p className="mt-1 text-xs text-slate-500">commitments past due</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-slate-400" />
            <p className="text-xs font-medium text-slate-500">NEEDS REVIEW</p>
          </div>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {dashboard.summary.needs_assignment_review}
          </p>
          <p className="mt-1 text-xs text-slate-500">assignments pending</p>
        </div>
      </div>

      {/* Status Breakdown */}
      <div className="mt-8 rounded-lg border border-slate-200 bg-white p-6">
        <h3 className="font-semibold text-slate-900">Status Breakdown</h3>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-600">In Progress</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {dashboard.summary.in_progress}
            </p>
          </div>
          <div className="rounded bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-600">Blocked</p>
            <p className="mt-1 text-2xl font-bold text-red-600">{dashboard.summary.blocked}</p>
          </div>
          <div className="rounded bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-600">Unassigned</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {dashboard.summary.unassigned}
            </p>
          </div>
          <div className="rounded bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-600">Teams</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{dashboard.teams.length}</p>
          </div>
        </div>
      </div>

      {/* Team Breakdown */}
      <div className="mt-8 rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-4">
          <h3 className="font-semibold text-slate-900">Team Breakdown</h3>
          <p className="mt-1 text-sm text-slate-600">{dashboard.teams.length} teams</p>
        </div>

        {dashboard.teams.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <p className="text-sm text-slate-500">No teams found in organization</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700">
                    Team
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-700">
                    Members
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-700">
                    Total
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-700">
                    Completed
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-700">
                    Active
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-700">
                    Blocked
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-700">
                    Overdue
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {dashboard.teams.map((team) => (
                  <tr
                    key={team.team_id}
                    className="transition-colors hover:bg-slate-50"
                    onClick={() =>
                      setSelectedTeamId(selectedTeamId === team.team_id ? null : team.team_id)
                    }
                  >
                    <td className="px-6 py-4">
                      <button className="font-medium text-blue-600 hover:underline">
                        {team.team_name}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-slate-600">
                      {team.member_count}
                    </td>
                    <td className="px-6 py-4 text-center font-semibold text-slate-900">
                      {team.total}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="font-semibold text-emerald-600">{team.completed}</span>
                      <span className="text-xs text-slate-500">
                        {' '}
                        ({team.total > 0 ? Math.round((team.completed / team.total) * 100) : 0}%)
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center font-semibold text-slate-900">
                      {team.in_progress}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="font-semibold text-red-600">{team.blocked}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={cn(
                          'font-semibold',
                          team.overdue > 0 ? 'text-amber-600' : 'text-slate-500',
                        )}
                      >
                        {team.overdue}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Critical Issues Summary */}
      {(dashboard.summary.blocked > 0 || dashboard.summary.overdue > 0) && (
        <div className="mt-8 space-y-3">
          {dashboard.summary.blocked > 0 && (
            <Alert className="border-red-200 bg-red-50">
              <TrendingDown className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <span className="font-semibold">{dashboard.summary.blocked} blocked</span> —
                Review team blockers to unblock progress
              </AlertDescription>
            </Alert>
          )}

          {dashboard.summary.overdue > 0 && (
            <Alert className="border-amber-200 bg-amber-50">
              <Clock className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                <span className="font-semibold">{dashboard.summary.overdue} overdue</span> —
                Teams have commitments past their due dates
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  );
}

export default function ManagerDashboardPage() {
  return (
    <ProtectedRoute>
      <ManagerDashboardContent />
    </ProtectedRoute>
  );
}
