'use client';

/**
 * useTeamContext Hook
 * 
 * Provides access to user's team context within their organization.
 * Returns list of teams user is a member of with their role in each.
 * 
 * Usage:
 * const { teams, defaultTeamId, loading } = useTeamContext();
 */

import { useEffect, useState } from 'react';
import { useAuthFetch } from './use-auth-fetch';

interface Team {
  teamId: string;
  teamName: string;
  role: 'team_lead' | 'member';
}

interface TeamContextData {
  organizationId: string;
  teams: Team[];
  defaultTeamId?: string;
  defaultTeamName?: string;
}

interface UseTeamContextResult {
  context: TeamContextData | null;
  loading: boolean;
  error: string | null;
}

export function useTeamContext(): UseTeamContextResult {
  const authFetch = useAuthFetch();
  const [context, setContext] = useState<TeamContextData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTeamContext = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await authFetch('/api/profile');
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'Failed to load team context');
          setLoading(false);
          return;
        }

        if (data.teams) {
          setContext(data.teams);
        }
      } catch (err) {
        console.error('Error loading team context:', err);
        setError('Failed to load team context');
      } finally {
        setLoading(false);
      }
    };

    fetchTeamContext();
  }, [authFetch]);

  return { context, loading, error };
}

/**
 * Helper hook to check if user is a team lead in any team.
 */
export function useIsTeamLead(): boolean {
  const { context } = useTeamContext();
  return (context?.teams ?? []).some((t) => t.role === 'team_lead');
}

/**
 * Helper hook to get user's default team.
 */
export function useDefaultTeam(): {
  teamId?: string;
  teamName?: string;
} {
  const { context } = useTeamContext();
  return {
    teamId: context?.defaultTeamId,
    teamName: context?.defaultTeamName,
  };
}

/**
 * Helper hook to check if user is in a specific team.
 */
export function useIsInTeam(teamId: string): boolean {
  const { context } = useTeamContext();
  return (context?.teams ?? []).some((t) => t.teamId === teamId);
}
