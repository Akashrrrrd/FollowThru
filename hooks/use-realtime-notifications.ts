'use client';

import { useEffect } from 'react';
import { useAuth } from '@/components/auth-provider';
import { supabase } from '@/lib/supabase-client';
import type { RealtimePostgresChangesPayload } from '@supabase/realtime-js';

interface Notification {
  id: string;
  user_id: string;
  organization_id: string;
  team_id?: string;
  commitment_id?: string;
  meeting_id?: string;
  type: string;
  title: string;
  message: string;
  action_url?: string;
  read_at?: string;
  dismissed_at?: string;
  email_sent_at?: string;
  email_failed_at?: string;
  email_error?: string;
  related_user_id?: string;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

type NotificationChangeCallback = (
  event: 'insert' | 'update' | 'delete',
  notification: Notification
) => void;

/**
 * Hook to subscribe to real-time notification changes for the current user.
 *
 * Supports both the new unified 'notifications' table and the legacy 'completion_notifications' table.
 * Transitions to the new table while maintaining backward compatibility.
 *
 * Usage:
 * ```typescript
 * const { isSubscribed } = useRealtimeNotifications((event, notification) => {
 *   if (event === 'insert') {
 *     console.log('New notification:', notification);
 *   }
 * });
 * ```
 *
 * Key behaviors:
 * - Subscribes to the unified 'notifications' table (Phase 5)
 * - Also maintains subscription to 'completion_notifications' for backward compatibility
 * - Only receives notifications for the current user (filtered by user_id)
 * - Reacts to new notifications, updates (mark as read), and deletions
 * - Cleans up subscriptions on unmount
 * - User isolation is strict (only user_id matches see these events)
 */
export function useRealtimeNotifications(onNotificationChange: NotificationChangeCallback) {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    // Create a channel for this user's notifications
    const channel = supabase.channel(`notifications:user_${user.id}`);

    // Subscribe to unified notifications table (Phase 5)
    channel
      .on(
        'postgres_changes',
        {
          event: '*', // All events: insert, update, delete
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const notification = (payload.new || payload.old) as Notification;
          if (!notification) return;

          const event = (payload.eventType || 'update') as 'insert' | 'update' | 'delete';
          onNotificationChange(event, notification);
        }
      )
      // Also subscribe to completion_notifications for backward compatibility
      // (will be deprecated in a future phase)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'completion_notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const notification = (payload.new || payload.old) as Notification;
          if (!notification) return;

          const event = (payload.eventType || 'update') as 'insert' | 'update' | 'delete';
          onNotificationChange(event, notification);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[Realtime] Subscribed to notifications for user ${user.id}`);
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`[Realtime] Channel error for user ${user.id}`);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, onNotificationChange]);

  return { isSubscribed: !!user?.id };
}
