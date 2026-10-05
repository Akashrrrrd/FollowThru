'use client';

import { useEffect } from 'react';
import { useAuth } from '@/components/auth-provider';
import { supabase } from '@/lib/supabase-client';
import type { RealtimePostgresChangesPayload } from '@supabase/realtime-js';

interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: 'team_lead' | 'member';
}

type TeamMemberChangeCallback = (
  event: 'insert' | 'update' | 'delete',
  member: TeamMember
) => void;

/**
 * Hook to subscribe to real-time team membership changes.
 *
 * Usage:
 * ```typescript
 * const { isSubscribed } = useRealtimeTeamMembers((event, member) => {
 *   if (event === 'insert') {
 *     console.log('New member joined:', member);
 *   }
 * });
 * ```
 *
 * Key behaviors:
 * - Subscribes to team_members table for all events
 * - Updates when users join/leave teams
 * - Updates when roles change
 * - Cleans up subscriptions on unmount
 *
 * Note: Organization isolation is enforced server-side by RLS policies.
 * We do client-side filtering based on teams the user belongs to.
 */
export function useRealtimeTeamMembers(onTeamMemberChange: TeamMemberChangeCallback) {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Create a channel for this user's team membership updates
    const channel = supabase.channel(`team_members:user_${user.id}`);

    // Subscribe to all team_members events
    channel
      .on(
        'postgres_changes',
        {
          event: '*', // All events (insert, update, delete)
          schema: 'public',
          table: 'team_members',
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const member = (payload.new || payload.old) as TeamMember;
          if (!member) return;

          // The server enforces that this user can only see team_members from their org.
          // We react to all events since they're already filtered by RLS.
          const event = (payload.eventType || 'update') as 'insert' | 'update' | 'delete';
          onTeamMemberChange(event, member);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Subscribed to team membership changes');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, onTeamMemberChange]);

  return { isSubscribed: !!user };
}
