'use client';

import { useEffect, useState } from 'react';
import { useTaskAssignmentSubscription, type AssignmentUpdate } from '@/hooks/use-task-assignment-subscription';
import { Bell } from 'lucide-react';

/**
 * Assignment Notification Provider
 *
 * Displays real-time notifications when the user receives new task assignments
 * or when their assigned tasks are updated. Uses Supabase Realtime subscriptions
 * to keep the UI in sync without polling.
 *
 * Can be placed near the top of the app to provide global assignment notifications.
 */

export function AssignmentNotificationProvider() {
  const [notifications, setNotifications] = useState<Array<{ id: string; update: AssignmentUpdate }>>([]);

  // Subscribe to assignment updates
  const { isConnected } = useTaskAssignmentSubscription((update) => {
    // Add notification to queue
    const id = `${update.taskId}-${Date.now()}`;
    setNotifications((prev) => [...prev, { id, update }]);

    // Auto-dismiss after 6 seconds
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 6000);
  });

  if (!isConnected || notifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
      {notifications.map(({ id, update }) => (
        <div
          key={id}
          className={`flex items-start gap-3 rounded-lg border p-4 shadow-md bg-white animate-in fade-in slide-in-from-right-2 duration-300 ${
            update.type === 'assigned' ? 'border-blue-200 bg-blue-50' : 'border-slate-200'
          }`}
        >
          <Bell
            className={`h-5 w-5 mt-0.5 flex-shrink-0 ${
              update.type === 'assigned' ? 'text-blue-600' : 'text-slate-600'
            }`}
            aria-hidden="true"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900">
              {update.type === 'assigned' && 'New commitment assigned'}
              {update.type === 'reassigned' && 'Commitment reassigned'}
              {update.type === 'updated' && 'Commitment updated'}
            </p>
            <p className="text-sm text-slate-600 mt-1 truncate">{update.taskTitle}</p>
          </div>
          <button
            onClick={() => setNotifications((prev) => prev.filter((n) => n.id !== id))}
            className="text-slate-400 hover:text-slate-600 mt-0.5"
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
