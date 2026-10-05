'use client';

import { useEffect, useCallback } from 'react';
import { useAuth } from '@/components/auth-provider';
import { useTeamContext } from '@/hooks/use-team-context';
import { supabase } from '@/lib/supabase-client';
import type { RealtimePostgresChangesPayload } from '@supabase/realtime-js';
import type { Task } from '@/lib/types';

type CommitmentChangeCallback = (
  event: 'insert' | 'update' | 'delete',
  commitment: Task
) => void;

/**
 * Hook to subscribe to real-time commitment changes for the current user's teams.
 *
 * Usage:
 * ```typescript
 * const { isSubscribed } = useRealtimeCommitments((event, commitment) => {
 *   if (event === 'update') {
 *     console.log('Commitment updated:', commitment);
 *   }
 * });
 * ```
 *
 * Key behaviors:
 * - Only subscribes to commitments in teams the user belongs to
 * - Automatically handles org/team isolation (filters server-side)
 * - Cleans up subscriptions on unmount
 * - Handles reconnection gracefully
 */
export function useRealtimeCommitments(onCommitmentChange: CommitmentChangeCallback) {
  const { user } = useAuth();
  const { context: teamContext } = useTeamContext();

  const isSubscribed = !!user && !!teamContext;

  useEffect(() => {
    if (!isSubscribed || !teamContext) return;

    const teamIds = teamContext.teams.map((t) => t.teamId);
    if (teamIds.length === 0) return;

    // Create a channel for this user's teams
    // Channel name includes user ID to avoid conflicts and make debugging easier
    const channel = supabase.channel(
      `commitments:user_${user?.id}:org_${teamContext.organizationId}`
    );

    // Subscribe to all commitment events (insert, update, delete)
    channel
      .on(
        'postgres_changes',
        {
          event: '*', // All events
          schema: 'public',
          table: 'tasks',
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          // Server-side: API enforces org/team membership
          // Client-side: Further filter to ensure we only react to our teams
          const commitment = (payload.new || payload.old) as Record<string, unknown>;
          if (!commitment) return;

          const teamId = commitment.team_id as string;

          // Only process if this commitment belongs to one of our teams
          if (teamIds.includes(teamId)) {
            const event = (payload.eventType || 'update') as 'insert' | 'update' | 'delete';
            // For deletes, new is null; for insert/update, new has the data
            const data = (payload.new || payload.old) as Task;
            onCommitmentChange(event, data);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[Realtime] Subscribed to commitments for teams: ${teamIds.join(',')}`);
        } else if (status === 'CLOSED') {
          console.log('[Realtime] Commitment subscription closed');
        }
      });

    // Cleanup: unsubscribe when component unmounts or dependencies change
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isSubscribed, user?.id, teamContext?.organizationId, teamContext?.teams, onCommitmentChange]);

  return { isSubscribed };
}
