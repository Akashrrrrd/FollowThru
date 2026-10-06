'use client';

import { useEffect } from 'react';
import { useAuth } from '@/components/auth-provider';
import { supabase } from '@/lib/supabase-client';

/**
 * Real-time subscription to task status updates
 *
 * Subscribes to task changes within a specific team or organization.
 * Useful for dashboards that need to stay in sync with task status changes.
 *
 * Filters are applied server-side via Postgres policies to ensure
 * users only see updates for tasks they have access to.
 */

export interface TaskUpdate {
  id: string;
  status: string;
  assigned_to_user_id?: string;
  team_id?: string;
  due_date?: string;
  updated_at: string;
}

export function useTaskUpdatesSubscription(
  filters: {
    teamId?: string;
    userId?: string;
  },
  onUpdate?: (update: TaskUpdate) => void
): void {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!user?.id || loading) {
      return;
    }

    const channelName = `tasks:${filters.teamId || filters.userId || 'org'}`;

    const channel = supabase
      .channel(channelName, {
        config: {
          broadcast: {
            self: true,
          },
        },
      })
      .on(
        'postgres_changes',
        {
          event: '*', // All events: INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'tasks',
        },
        (payload: any) => {
          const update = payload.new || payload.old;

          // Apply local filters
          if (filters.teamId && update.team_id !== filters.teamId) {
            return;
          }
          if (filters.userId && update.owner_user_id !== filters.userId) {
            return;
          }

          onUpdate?.(update);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[useTaskUpdatesSubscription] Subscribed to ${channelName}`);
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [user?.id, loading, filters.teamId, filters.userId, onUpdate]);
}
