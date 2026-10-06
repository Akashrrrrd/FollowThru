'use client';

import { useEffect, useCallback } from 'react';
import { useAuth } from '@/components/auth-provider';
import { supabase } from '@/lib/supabase-client';

/**
 * Real-time subscription to task assignment changes
 *
 * Subscribes to updates on tasks table and triggers a callback when:
 * - A task is assigned to the current user
 * - A task assigned to the current user is updated
 * - A task in the user's team is updated
 *
 * Used to keep UI in sync with server-side assignment changes without polling.
 */

export interface AssignmentUpdate {
  type: 'assigned' | 'reassigned' | 'updated';
  taskId: string;
  taskTitle: string;
  previousAssignee?: string;
  newAssignee?: string;
  updatedAt: string;
}

export function useTaskAssignmentSubscription(
  onUpdate?: (update: AssignmentUpdate) => void
): { unsubscribe: () => void; isConnected: boolean } {
  const { user, loading } = useAuth();

  const unsubscribe = useCallback(() => {
    // Cleanup will be handled in useEffect return
  }, []);

  useEffect(() => {
    if (!user?.id || loading) {
      return;
    }

    // Subscribe to task updates using Realtime
    // This subscribes to all task changes, but we'll filter client-side
    const channel = supabase
      .channel(`task-assignments:${user.id}`, {
        config: {
          broadcast: {
            self: true,
          },
        },
      })
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tasks',
        },
        (payload: any) => {
          const newData = payload.new;
          const oldData = payload.old;

          // Only process if task is assigned to current user or was assigned to them
          const isAssignedToUser = newData.assigned_to_user_id === user.id;
          const wasAssignedToUser = oldData?.assigned_to_user_id === user.id;

          if (!isAssignedToUser && !wasAssignedToUser) {
            return;
          }

          // Determine update type
          let updateType: 'assigned' | 'reassigned' | 'updated' = 'updated';

          // New assignment to this user
          if (!oldData?.assigned_to_user_id && isAssignedToUser) {
            updateType = 'assigned';
          }
          // Reassignment from/to this user
          else if (
            oldData?.assigned_to_user_id &&
            newData.assigned_to_user_id &&
            oldData.assigned_to_user_id !== newData.assigned_to_user_id
          ) {
            updateType = 'reassigned';
          }

          const update: AssignmentUpdate = {
            type: updateType,
            taskId: newData.id,
            taskTitle: newData.description || 'Untitled commitment',
            previousAssignee: oldData?.assigned_to_user_id,
            newAssignee: newData.assigned_to_user_id,
            updatedAt: newData.updated_at,
          };

          onUpdate?.(update);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[useTaskAssignmentSubscription] Subscribed to assignment updates');
        } else if (status === 'CLOSED') {
          console.log('[useTaskAssignmentSubscription] Subscription closed');
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [user?.id, loading, onUpdate]);

  return { unsubscribe, isConnected: !loading && !!user };
}
