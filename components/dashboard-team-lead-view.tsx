'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Users, AlertCircle, TrendingDown, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AccountabilityBadge } from '@/components/accountability-badge';
import type { AccountabilityStatus } from '@/lib/accountability-status';
import { getStatusDescription } from '@/lib/accountability-status';

interface TeamMetric {
  team_id: string;
  team_name: string;
  total: number;
  completed: number;
  completion_rate: number;
  overdue: number;
  status?: AccountabilityStatus;
}

interface OwnerMetric {
  owner: string;
  total: number;
  completed: number;
  completion_rate: number;
  overdue: number;
  status?: AccountabilityStatus;
}

interface TeamLeadDashboardData {
  accountability_status: {
    my_status: AccountabilityStatus;
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

export interface TeamLeadDashboardViewProps {
  data: TeamLeadDashboardData;
  loading: boolean;
  error: string | null;
  managedTeamIds?: string[];
}

export function TeamLeadDashboardView({
  data,
  loading,
  error,
  managedTeamIds,
}: TeamLeadDashboardViewProps) {
  const [sortBy, setSortBy] = useState<'status' | 'completion' | 'overdue'>(
    'status',
  );

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-40 rounded-xl border border-slate-200 bg-white" />
        <div className="h-64 rounded-xl border border-slate-200 bg-white" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-500">
        <AlertCircle className="mx-auto mb-2 h-8 w-8" />
        <p>{error || 'Failed to load team accountability data.'}</p>
      </div>
    );
  }

  // Filter to only show teams the user manages
  const myTeams = managedTeamIds
    ? data.teams.filter((t) => managedTeamIds.includes(t.team_id))
    : data.teams;

  // Get all employees in my teams
  const teamMemberIds = new Set(
    myTeams.map((t) => t.team_id),
  );

  const sortedTeams = useMemo(() => {
    const sorted = [...myTeams];
    if (sortBy === 'status') {
      // Sort by status severity
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
  }, [myTeams, sortBy]);

  const atRiskTeams = myTeams.filter(
    (t) => t.status === 'AT_RISK' || t.status === 'NEEDS_ATTENTION',
  );

  return (
    <div className="space-y-6">
      {/* Team Overview */}
      {myTeams.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">
            My Teams Overview
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="border-l-4 border-slate-300 pl-4">
              <p className="text-sm text-slate-600">Teams</p>
              <p className="text-2xl font-semibold text-slate-900">
                {myTeams.length}
              </p>
            </div>
            <div className="border-l-4 border-emerald-500 pl-4">
              <p className="text-sm text-slate-600">On Track</p>
              <p className="text-2xl font-semibold text-emerald-600">
                {myTeams.filter((t) => t.status === 'ON_TRACK').length}
              </p>
            </div>
            <div className="border-l-4 border-amber-500 pl-4">
              <p className="text-sm text-slate-600">At Risk</p>
              <p className="text-2xl font-semibold text-amber-600">
                {myTeams.filter((t) => t.status === 'AT_RISK').length}
              </p>
            </div>
            <div className="border-l-4 border-rose-500 pl-4">
              <p className="text-sm text-slate-600">Needs Attention</p>
              <p className="text-2xl font-semibold text-rose-600">
                {myTeams.filter((t) => t.status === 'NEEDS_ATTENTION').length}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Team Performance Table */}
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
            <Users className="mx-auto mb-2 h-8 w-8 opacity-50" />
            <p>No teams to manage.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-medium uppercase text-slate-600">
                  <th className="px-6 py-3">Team</th>
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

      {/* At Risk Alert */}
      {atRiskTeams.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
              <div>
                <h3 className="font-semibold text-amber-900">
                  {atRiskTeams.length} Team{atRiskTeams.length !== 1 ? 's' : ''} Need{atRiskTeams.length !== 1 ? '' : 's'} Attention
                </h3>
                <p className="mt-1 text-sm text-amber-800">
                  Review these teams' progress and address blockers.
                </p>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            {atRiskTeams.map((team) => (
              <div key={team.team_id} className="flex items-center justify-between text-sm">
                <span className="text-amber-900">
                  {team.team_name}: {team.overdue} overdue, {team.completion_rate}% completion
                </span>
                <Link href={`/teams/${team.team_id}`}>
                  <ArrowRight className="h-4 w-4 text-amber-600" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My Personal Accountability */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-slate-900">My Personal Accountability</h3>
            <p className="mt-1 text-sm text-slate-500">
              {data.mine.completed} of {data.mine.total} commitments completed
            </p>
          </div>
          <AccountabilityBadge status={data.accountability_status.my_status} />
        </div>
      </div>
    </div>
  );
}
