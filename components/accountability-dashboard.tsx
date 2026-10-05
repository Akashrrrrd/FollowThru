'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthFetch } from '@/hooks/use-auth-fetch';
import { useAccountabilityRealtime } from '@/hooks/use-accountability-realtime';
import { EmployeeDashboardView } from './dashboard-employee-view';
import { TeamLeadDashboardView } from './dashboard-team-lead-view';
import { ManagerDashboardView } from './dashboard-manager-view';
import type { AccountabilityStatus } from '@/lib/accountability-status';

interface AccountabilityData {
  organization: {
    id: string;
    role: 'owner' | 'manager' | 'member';
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
    in_progress: number;
    blocked: number;
    overdue: number;
    completion_rate: number;
  };
  owners: Array<{
    owner: string;
    total: number;
    completed: number;
    in_progress: number;
    blocked: number;
    overdue: number;
    completion_rate: number;
    status?: AccountabilityStatus;
  }>;
  teams: Array<{
    team_id: string;
    team_name: string;
    total: number;
    completed: number;
    in_progress: number;
    blocked: number;
    overdue: number;
    completion_rate: number;
    status?: AccountabilityStatus;
  }>;
}

interface AccountabilityDashboardProps {
  managedTeamIds?: string[];
}

export function AccountabilityDashboard({
  managedTeamIds,
}: AccountabilityDashboardProps) {
  const authFetch = useAuthFetch();

  const [data, setData] = useState<AccountabilityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch accountability data
  const fetchAccountability = useCallback(async () => {
    try {
      setError(null);
      const res = await authFetch('/api/accountability');

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(
          errorData.error || 'Failed to load accountability data',
        );
      }

      const newData = await res.json();
      setData(newData);
      setLoading(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'An error occurred';
      console.error('[AccountabilityDashboard] Fetch error:', err);
      setError(message);
      setLoading(false);
    }
  }, [authFetch]);

  // Initial load
  useEffect(() => {
    fetchAccountability();
  }, [fetchAccountability]);

  // Realtime updates
  useAccountabilityRealtime({
    enabled: !loading && !error,
    onRefresh: fetchAccountability,
  });

  if (!data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-40 rounded-xl border border-slate-200 bg-white" />
        <div className="h-64 rounded-xl border border-slate-200 bg-white" />
      </div>
    );
  }

  const userRole = data.organization.role;
  const isManager = userRole === 'owner' || userRole === 'manager';

  // Determine which dashboard to show based on role
  // Managers see manager view
  // Team leads see team lead view
  // Regular members see employee view

  if (isManager) {
    return (
      <ManagerDashboardView
        data={data as any}
        loading={loading}
        error={error}
      />
    );
  }

  // Check if user is a team lead (has teams to manage)
  const isTeamLead = managedTeamIds && managedTeamIds.length > 0;

  if (isTeamLead) {
    return (
      <TeamLeadDashboardView
        data={data as any}
        loading={loading}
        error={error}
        managedTeamIds={managedTeamIds}
      />
    );
  }

  // Default to employee view
  return (
    <EmployeeDashboardView
      data={data as any}
      loading={loading}
      error={error}
    />
  );
}
