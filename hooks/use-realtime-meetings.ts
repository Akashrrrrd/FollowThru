'use client';

import { useEffect } from 'react';
import { useAuth } from '@/components/auth-provider';
import { useTeamContext } from '@/hooks/use-team-context';
import { supabase } from '@/lib/supabase-client';
import type { RealtimePostgresChangesPayload } from '@supabase/realtime-js';

interface Meeting {
  id: string;
  team_id: string;
  title: string;
  status: string;
  [key: string]: unknown;
}

type MeetingChangeCallback = (
  event: 'insert' | 'update' | 'delete',
  meeting: Meeting
) => void;

/**
 * Hook to subscribe to real-time meeting changes for the current user's teams.
 *
 * Usage:
 * ```typescript
 * const { isSubscribed } = useRealtimeMeetings((event, meeting) => {
 *   if (event === 'insert') {
 *     console.log('New meeting created:', meeting);
 *   }
 * });
 * ```
 *
 * Key behaviors:
 * - Subscribes to meetings in teams the user belongs to
 * - Reacts to new meetings, updates (e.g., analysis complete), deletions
 * - Team isolation enforced by filtering team_id against user's teams
 * - Cleans up subscriptions on unmount
 */
export function useRealtimeMeetings(onMeetingChange: MeetingChangeCallback) {
  const { user } = useAuth();
  const { context: teamContext } = useTeamContext();

  const isSubscribed = !!user && !!teamContext;

  useEffect(() => {
    if (!isSubscribed || !teamContext) return;

    const teamIds = teamContext.teams.map((t) => t.teamId);
    if (teamIds.length === 0) return;

    // Create a channel for this user's team meetings
    const channel = supabase.channel(`meetings:user_${user?.id}:org_${teamContext.organizationId}`);

    // Subscribe to all meeting events
    channel
      .on(
        'postgres_changes',
        {
          event: '*', // All events
          schema: 'public',
          table: 'meetings',
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const meeting = (payload.new || payload.old) as Record<string, unknown>;
          if (!meeting) return;

          const teamId = meeting.team_id as string;

          // Only process if this meeting belongs to one of our teams
          if (teamIds.includes(teamId)) {
            const event = (payload.eventType || 'update') as 'insert' | 'update' | 'delete';
            const data = (payload.new || payload.old) as Meeting;
            onMeetingChange(event, data);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[Realtime] Subscribed to meetings for teams: ${teamIds.join(',')}`);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isSubscribed, user?.id, teamContext?.organizationId, teamContext?.teams, onMeetingChange]);

  return { isSubscribed };
}
