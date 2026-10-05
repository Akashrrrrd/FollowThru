'use client';

import { useEffect, useState, useCallback } from 'react';
import { Users, RefreshCw, AlertCircle, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/protected-route';
import { PageLoading, PageError, EmptyState } from '@/components/page-loading';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuthFetch } from '@/hooks/use-auth-fetch';
import { useRealtimeCommitments } from '@/hooks/use-realtime-commitments';
import { cn } from '@/lib/utils';

interface TeamTaskMetrics {
  total: number;
  completed: number;
  in_progress: number;
  blocked: number;
  overdue: number;
  needs_assignment_review: number;
  unassigned: number;
}

interface TeamMemberSummary {
  user_id: string;
  display_name: string;
  full_name?: string;
  metrics: TeamTaskMetrics;
}

interface TeamLeadDashboardData {
  team_id: string;
  team_name: string;
  summary: TeamTaskMetrics;
  members: TeamMemberSummary[];
}

interface AvailableTeam {
  team_id: string;
  team_name: string;
}

function TeamLeadDashboardContent() {
  const authFetch = useAuthFetch();

  const [availableTeams, setAvailableTeams] = useState<AvailableTeam[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<TeamLeadDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  /* Subscribe to commitment changes for the current team */
  useRealtimeCommitments((event) => {
    // On commitment changes, refresh team dashboard to get updated metrics
    if (event === 'update' || event === 'insert' || event === 'delete') {
      // Use a small delay to batch rapid updates
      const timer = setTimeout(() => {
        if (selectedTeamId) {
          fetchDashboard();
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  });

  // Fetch available teams
  const fetchTeams = useCallback(async () => {
    try {
      const res = await authFetch('/api/dashboard/team-lead', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to load teams');
        setLoading(false);
        return;
      }

      const teams = data.teams || [];
      setAvailableTeams(teams);

      // Auto-select first team
      if (teams.length > 0 && !selectedTeamId) {
        setSelectedTeamId(teams[0].team_id);
      }

      setLoading(false);
    } catch (err) {
      console.error('Teams fetch error:', err);
      setError('Failed to load teams');
      setLoading(false);
    }
  }, [authFetch, selectedTeamId]);

  // Fetch dashboard for selected team
  const fetchDashboard = useCallback(async () => {
    if (!selectedTeamId) return;

    setRefreshing(true);
    setError(null);

    try {
      const res = await authFetch(`/api/dashboard/team-lead?team_id=${selectedTeamId}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to load dashboard');
        setRefreshing(false);
        return;
      }

      setDashboard(data);
      setSelectedMemberId(null);
      setRefreshing(false);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError('Failed to load dashboard');
      setRefreshing(false);
    }
  }, [selectedTeamId, authFetch]);

  // Load teams on mount
  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  // Load dashboard when team selected
  useEffect(() => {
    if (selectedTeamId) {
      fetchDashboard();
    }
  }, [selectedTeamId, fetchDashboard]);

  if (loading) {
    return <PageLoading />;
  }

  if (availableTeams.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <EmptyState
          title="No teams to manage"
          description="You are not a team lead for any teams in your organization."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Team Dashboard
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
            Monitor your team's commitments and progress.
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={refreshing} onClick={fetchDashboard}>
            <RefreshCw className={cn('mr-2 h-3.5 w-3.5', refreshing && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Team Selector */}
      <div className="mb-8 flex gap-3">
        <Select value={selectedTeamId || ''} onValueChange={setSelectedTeamId}>
          <SelectTrigger className="w-full sm:w-[300px]">
            <SelectValue placeholder="Select a team" />
          </SelectTrigger>
          <SelectContent>
            {availableTeams.map((team) => (
              <SelectItem key={team.team_id} value={team.team_id}>
                {team.team_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {dashboard && (
        <div className="space-y-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-white p-6">
              <p className="text-xs font-medium text-slate-500">TOTAL</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{dashboard.summary.total}</p>
              <p className="mt-1 text-xs text-slate-500">commitments</p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-6">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <p className="text-xs font-medium text-slate-500">COMPLETED</p>
              </div>
              <p className="mt-2 text-3xl font-bold text-emerald-600">
                {dashboard.summary.completed}
              </p>
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
              <p className="mt-1 text-xs text-slate-500">past due</p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-6">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-slate-400" />
                <p className="text-xs font-medium text-slate-500">NEEDS REVIEW</p>
              </div>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {dashboard.summary.needs_assignment_review}
              </p>
              <p className="mt-1 text-xs text-slate-500">assignments</p>
            </div>
          </div>

          {/* Status Breakdown */}
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <h3 className="font-semibold text-slate-900">Status Breakdown</h3>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div className="rounded bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-600">In Progress</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {dashboard.summary.in_progress}
                </p>
              </div>
              <div className="rounded bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-600">Blocked</p>
                <p className="mt-1 text-2xl font-bold text-red-600">
                  {dashboard.summary.blocked}
                </p>
              </div>
              <div className="rounded bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-600">Unassigned</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {dashboard.summary.unassigned}
                </p>
              </div>
            </div>
          </div>

          {/* Team Members */}
          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-6 py-4">
              <h3 className="font-semibold text-slate-900">Team Members</h3>
              <p className="mt-1 text-sm text-slate-600">{dashboard.members.length} members</p>
            </div>

            {dashboard.members.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <p className="text-sm text-slate-500">No team members with assigned tasks</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {dashboard.members.map((member) => (
                  <button
                    key={member.user_id}
                    onClick={() =>
                      setSelectedMemberId(
                        selectedMemberId === member.user_id ? null : member.user_id,
                      )
                    }
                    className="w-full px-6 py-4 text-left transition-colors hover:bg-slate-50"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900">{member.display_name}</p>
                        {member.full_name && member.full_name !== member.display_name && (
                          <p className="text-xs text-slate-500">{member.full_name}</p>
                        )}
                      </div>

                      <div className="flex gap-3 text-right">
                        <div className="text-xs text-slate-600">
                          <p className="font-semibold text-slate-900">
                            {member.metrics.completed}/{member.metrics.total}
                          </p>
                          <p className="text-slate-500">completed</p>
                        </div>

                        {member.metrics.overdue > 0 && (
                          <div className="text-xs text-amber-600">
                            <p className="font-semibold">{member.metrics.overdue}</p>
                            <p className="text-amber-500">overdue</p>
                          </div>
                        )}

                        {member.metrics.blocked > 0 && (
                          <div className="text-xs text-red-600">
                            <p className="font-semibold">{member.metrics.blocked}</p>
                            <p className="text-red-500">blocked</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Expanded member details */}
                    {selectedMemberId === member.user_id && (
                      <div className="mt-4 border-t border-slate-100 pt-4">
                        <div className="grid grid-cols-3 gap-3 text-xs">
                          <div>
                            <p className="text-slate-600">In Progress</p>
                            <p className="font-semibold text-slate-900">
                              {member.metrics.in_progress}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-600">Needs Assignment</p>
                            <p className="font-semibold text-slate-900">
                              {member.metrics.needs_assignment_review}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-600">Unassigned</p>
                            <p className="font-semibold text-slate-900">
                              {member.metrics.unassigned}
                            </p>
                          </div>
                        </div>

                        <Link href={`/dashboard/team-lead/${dashboard.team_id}/${member.user_id}`}>
                          <Button size="sm" variant="outline" className="mt-3 w-full">
                            View All Tasks
                          </Button>
                        </Link>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TeamLeadDashboardPage() {
  return (
    <ProtectedRoute>
      <TeamLeadDashboardContent />
    </ProtectedRoute>
  );
}
