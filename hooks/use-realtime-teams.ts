'use client';

import { useEffect } from 'react';
import { useAuth } from '@/components/auth-provider';
import { supabase } from '@/lib/supabase-client';
import type { RealtimePostgresChangesPayload } from '@supabase/realtime-js';

interface Team {
  id: string;
  organization_id: string;
  name: string;
  updated_at: string;
  [key: string]: unknown;
}

type TeamChangeCallback = (
  event: 'insert' | 'update' | 'delete',
  team: Team
) => void;

/**
 * Hook to subscribe to real-time team changes within the user's organization.
 *
 * Usage:
 * ```typescript
 * const { isSubscribed } = useRealtimeTeams((event, team) => {
 *   if (event === 'insert') {
 *     console.log('New team created:', team);
 *   }
 * });
 * ```
 *
 * Key behaviors:
 * - Subscribes to teams table for all events
 * - Reacts to new teams being created, updated, or deleted
 * - Organization isolation enforced by RLS (server-side)
 * - Cleans up subscriptions on unmount
 */
export function useRealtimeTeams(onTeamChange: TeamChangeCallback) {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Create a channel for team updates
    const channel = supabase.channel(`teams:user_${user.id}`);

    // Subscribe to all teams events
    channel
      .on(
        'postgres_changes',
        {
          event: '*', // All events
          schema: 'public',
          table: 'teams',
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const team = (payload.new || payload.old) as Team;
          if (!team) return;

          // RLS policy ensures we only see teams in our organization
          const event = (payload.eventType || 'update') as 'insert' | 'update' | 'delete';
          onTeamChange(event, team);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Subscribed to team changes');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, onTeamChange]);

  return { isSubscribed: !!user };
}
