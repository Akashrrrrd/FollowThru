'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  TrendingDown,
  Users,
  CheckCircle2,
  BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AccountabilityBadge } from '@/components/accountability-badge';
import type { AccountabilityStatus } from '@/lib/accountability-status';
import { getStatusDescription } from '@/lib/accountability-status';

interface TeamMetric {
  team_id: string;
  team_name: string;
  total: number;
  completed: number;
  in_progress: number;
  blocked: number;
  overdue: number;
  completion_rate: number;
  status?: AccountabilityStatus;
}

interface OwnerMetric {
  owner: string;
  total: number;
  completed: number;
  in_progress: number;
  blocked: number;
  overdue: number;
  completion_rate: number;
  status?: AccountabilityStatus;
}

interface ManagerDashboardData {
  organization: {
    id: string;
    role: string;
  };
  accountability_status: {
    organization: AccountabilityStatus;
    my_status: AccountabilityStatus;
  };
  summary: {
    total: number;
    completed: number;
    in_progress: number;
    blocked: number;
    overdue: number;
    open: number;
    completion_rate: number;
  };
  mine: {
    total: number;
    completed: number;
    overdue: number;
    completion_rate: number;
  };
  teams: TeamMetric[];
  owners: OwnerMetric[];
}

export interface ManagerDashboardViewProps {
  data: ManagerDashboardData;
  loading: boolean;
  error: string | null;
}

export function ManagerDashboardView({
  data,
  loading,
  error,
}: ManagerDashboardViewProps) {
  const [sortBy, setSortBy] = useState<'status' | 'completion' | 'overdue'>(
    'status',
  );

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-40 rounded-xl border border-slate-200 bg-white" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="h-32 rounded-xl border border-slate-200 bg-white" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-500">
        <AlertCircle className="mx-auto mb-2 h-8 w-8" />
        <p>{error || 'Failed to load organization accountability data.'}</p>
      </div>
    );
  }

  const summary = data.summary;
  const orgStatus = data.accountability_status.organization;
  const myStatus = data.accountability_status.my_status;

  const atRiskTeams = data.teams.filter(
    (t) => t.status === 'AT_RISK' || t.status === 'NEEDS_ATTENTION',
  );

  const atRiskEmployees = data.owners.filter(
    (o) => o.status === 'AT_RISK' || o.status === 'NEEDS_ATTENTION',
  );

  const sortedTeams = useMemo(() => {
    const sorted = [...data.teams];
    if (sortBy === 'status') {
      const statusOrder = {
        NEEDS_ATTENTION: 0,
        AT_RISK: 1,
        ON_TRACK: 2,
      };
      sorted.sort((a, b) => {
        const aOrder = statusOrder[a.status as AccountabilityStatus] ?? 3;
        const bOrder = statusOrder[b.status as AccountabilityStatus] ?? 3;
        return aOrder - bOrder;
      });
    } else if (sortBy === 'completion') {
      sorted.sort((a, b) => a.completion_rate - b.completion_rate);
    } else if (sortBy === 'overdue') {
      sorted.sort((a, b) => b.overdue - a.overdue);
    }
    return sorted;
  }, [data.teams, sortBy]);

  return (
    <div className="space-y-6">
      {/* Organization Overview */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Organization Overview
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {getStatusDescription(orgStatus)}
            </p>
          </div>
          <AccountabilityBadge status={orgStatus} size="lg" />
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="border-l-4 border-slate-300 pl-4">
            <p className="text-sm text-slate-600">Total Commitments</p>
            <p className="text-2xl font-semibold text-slate-900">
              {summary.total}
            </p>
          </div>
          <div className="border-l-4 border-emerald-500 pl-4">
            <p className="text-sm text-slate-600">Completed</p>
            <p className="text-2xl font-semibold text-emerald-600">
              {summary.completed}
            </p>
          </div>
          <div className="border-l-4 border-rose-500 pl-4">
            <p className="text-sm text-slate-600">Overdue</p>
            <p className="text-2xl font-semibold text-rose-600">
              {summary.overdue}
            </p>
          </div>
          <div className="border-l-4 border-slate-300 pl-4">
            <p className="text-sm text-slate-600">Completion Rate</p>
            <p className="text-2xl font-semibold text-slate-900">
              {summary.completion_rate}%
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600">Overall Progress</span>
          </div>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
            role="progressbar"
            aria-valuenow={summary.completion_rate}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${summary.completion_rate}%` }}
            />
          </div>
        </div>
      </div>

      {/* Team Performance */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900">Team Performance</h2>
          <div className="flex gap-2">
            <Button
              variant={sortBy === 'status' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSortBy('status')}
            >
              By Status
            </Button>
            <Button
              variant={sortBy === 'completion' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSortBy('completion')}
            >
              By Completion
            </Button>
            <Button
              variant={sortBy === 'overdue' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSortBy('overdue')}
            >
              By Overdue
            </Button>
          </div>
        </div>

        {sortedTeams.length === 0 ? (
          <div className="p-6 text-center text-slate-500">
            <BarChart3 className="mx-auto mb-2 h-8 w-8 opacity-50" />
            <p>No teams in organization.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-medium uppercase text-slate-600">
                  <th className="px-6 py-3">Team</th>
                  <th className="px-3 py-3 text-right">Members</th>
                  <th className="px-3 py-3 text-right">Items</th>
                  <th className="px-3 py-3 text-right">Completion</th>
                  <th className="px-3 py-3 text-right">Overdue</th>
                  <th className="px-6 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedTeams.map((team) => (
                  <tr
                    key={team.team_id}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-6 py-4 font-medium text-slate-900">
                      <Link
                        href={`/teams/${team.team_id}`}
                        className="hover:text-slate-600 hover:underline"
                      >
                        {team.team_name}
                      </Link>
                    </td>
                    <td className="px-3 py-4 text-right tabular-nums text-slate-700">
                      <Users className="inline h-4 w-4" />
                    </td>
                    <td className="px-3 py-4 text-right tabular-nums text-slate-700">
                      {team.total}
                    </td>
                    <td className="px-3 py-4 text-right tabular-nums">
                      <span
                        className={`font-medium ${
                          team.completion_rate >= 75
                            ? 'text-emerald-600'
                            : team.completion_rate >= 50
                              ? 'text-amber-600'
                              : 'text-rose-600'
                        }`}
                      >
                        {team.completion_rate}%
                      </span>
                    </td>
                    <td className="px-3 py-4 text-right tabular-nums">
                      {team.overdue > 0 ? (
                        <span className="font-medium text-rose-600">
                          {team.overdue}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {team.status && (
                        <AccountabilityBadge status={team.status} size="sm" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Action Priority */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* At Risk Teams */}
        {atRiskTeams.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
            <div className="mb-4 flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
              <div>
                <h3 className="font-semibold text-amber-900">
                  {atRiskTeams.length} Team{atRiskTeams.length !== 1 ? 's' : ''} at Risk
                </h3>
                <p className="mt-1 text-xs text-amber-800">
                  Require management attention
                </p>
              </div>
            </div>
            <ul className="space-y-1">
              {atRiskTeams.slice(0, 3).map((team) => (
                <li key={team.team_id} className="text-sm text-amber-900">
                  {team.team_name} — {team.overdue} overdue
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* At Risk Employees */}
        {atRiskEmployees.length > 0 && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-6">
            <div className="mb-4 flex items-start gap-3">
              <TrendingDown className="mt-0.5 h-5 w-5 flex-shrink-0 text-rose-600" />
              <div>
                <h3 className="font-semibold text-rose-900">
                  {atRiskEmployees.length} Employee{atRiskEmployees.length !== 1 ? 's' : ''} Need{atRiskEmployees.length !== 1 ? '' : 's'} Support
                </h3>
                <p className="mt-1 text-xs text-rose-800">
                  Completion rate or overdue concerns
                </p>
              </div>
            </div>
            <ul className="space-y-1">
              {atRiskEmployees.slice(0, 3).map((employee) => (
                <li key={employee.owner} className="text-sm text-rose-900">
                  {employee.owner} — {employee.completion_rate}% complete
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* All On Track */}
        {atRiskTeams.length === 0 && atRiskEmployees.length === 0 && (
          <div className="col-span-1 rounded-xl border border-emerald-200 bg-emerald-50 p-6 lg:col-span-2">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" />
              <div>
                <h3 className="font-semibold text-emerald-900">
                  Organization On Track
                </h3>
                <p className="mt-1 text-sm text-emerald-800">
                  All teams and employees are progressing well.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
