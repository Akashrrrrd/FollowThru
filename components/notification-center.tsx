'use client';

import { useState, useCallback, useEffect } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  X,
  ExternalLink,
  Loader2,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/components/auth-provider';
import { useRealtimeNotifications } from '@/hooks/use-realtime-notifications';

type NotificationType =
  | 'assignment'
  | 'reassignment'
  | 'due_soon'
  | 'due_1h'
  | 'overdue'
  | 'escalation'
  | 'status_change'
  | 'completion'
  | 'team_invitation'
  | 'team_member_joined';

interface Notification {
  id: string;
  user_id: string;
  organization_id: string;
  team_id?: string;
  commitment_id?: string;
  meeting_id?: string;
  type: NotificationType;
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
}

interface NotificationCenterProps {
  showBadge?: boolean;
  maxItems?: number;
}

// Helper function to get icon and color for notification type
function getNotificationStyle(type: NotificationType) {
  switch (type) {
    case 'assignment':
    case 'reassignment':
      return {
        icon: AlertCircle,
        bgColor: 'bg-blue-50',
        textColor: 'text-blue-700',
        badgeColor: 'bg-blue-100 text-blue-800',
      };
    case 'due_soon':
      return {
        icon: AlertTriangle,
        bgColor: 'bg-yellow-50',
        textColor: 'text-yellow-700',
        badgeColor: 'bg-yellow-100 text-yellow-800',
      };
    case 'due_1h':
    case 'overdue':
      return {
        icon: AlertCircle,
        bgColor: 'bg-red-50',
        textColor: 'text-red-700',
        badgeColor: 'bg-red-100 text-red-800',
      };
    case 'escalation':
      return {
        icon: AlertTriangle,
        bgColor: 'bg-orange-50',
        textColor: 'text-orange-700',
        badgeColor: 'bg-orange-100 text-orange-800',
      };
    case 'status_change':
      return {
        icon: Info,
        bgColor: 'bg-purple-50',
        textColor: 'text-purple-700',
        badgeColor: 'bg-purple-100 text-purple-800',
      };
    case 'completion':
      return {
        icon: CheckCircle2,
        bgColor: 'bg-green-50',
        textColor: 'text-green-700',
        badgeColor: 'bg-green-100 text-green-800',
      };
    case 'team_invitation':
    case 'team_member_joined':
      return {
        icon: Info,
        bgColor: 'bg-indigo-50',
        textColor: 'text-indigo-700',
        badgeColor: 'bg-indigo-100 text-indigo-800',
      };
    default:
      return {
        icon: Bell,
        bgColor: 'bg-gray-50',
        textColor: 'text-gray-700',
        badgeColor: 'bg-gray-100 text-gray-800',
      };
  }
}

// Format notification type for display
function formatNotificationType(type: NotificationType): string {
  return type
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

interface NotificationItemProps {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
  isLoading: boolean;
}

function NotificationItem({
  notification,
  onMarkRead,
  onDismiss,
  isLoading,
}: NotificationItemProps) {
  const style = getNotificationStyle(notification.type);
  const IconComponent = style.icon;
  const isRead = !!notification.read_at;

  return (
    <div
      className={cn(
        'group relative flex gap-3 rounded-lg p-3 transition-all',
        style.bgColor,
        !isRead && 'border-l-4 border-blue-500'
      )}
    >
      {/* Icon */}
      <div className={cn('mt-0.5 flex-shrink-0', style.textColor)}>
        <IconComponent className="h-5 w-5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium text-gray-900">{notification.title}</p>
            <p className="text-sm text-gray-600 mt-0.5">{notification.message}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary" className={style.badgeColor}>
                {formatNotificationType(notification.type)}
              </Badge>
              <span className="text-xs text-gray-500">
                {formatDistanceToNow(new Date(notification.created_at), {
                  addSuffix: true,
                })}
              </span>
              {notification.email_failed_at && (
                <Badge variant="destructive" className="text-xs">
                  Email failed
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-1 flex-shrink-0">
        {!isRead && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onMarkRead(notification.id)}
            disabled={isLoading}
            title="Mark as read"
            className="h-8 w-8 p-0"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
          </Button>
        )}
        {notification.action_url && (
          <Button
            variant="ghost"
            size="sm"
            asChild
            title="View details"
            className="h-8 w-8 p-0"
          >
            <a href={notification.action_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDismiss(notification.id)}
          disabled={isLoading}
          title="Dismiss"
          className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function NotificationCenter({ showBadge = true, maxItems = 10 }: NotificationCenterProps) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Fetch notifications on mount and when notifications change
  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/notifications');
      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }

      const data = await response.json();
      setNotifications(data.notifications || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading notifications');
      console.error('[NotificationCenter] Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Handle realtime updates
  useRealtimeNotifications((event, notification) => {
    setNotifications((prev) => {
      if (event === 'insert') {
        // Add new notification to the top
        return [notification as Notification, ...prev];
      } else if (event === 'update') {
        // Update existing notification
        return prev.map((n) => (n.id === notification.id ? (notification as Notification) : n));
      } else if (event === 'delete') {
        // Remove deleted notification
        return prev.filter((n) => n.id !== notification.id);
      }
      return prev;
    });
  });

  // Mark notification as read
  const handleMarkRead = useCallback(
    async (notificationId: string) => {
      setLoadingId(notificationId);

      try {
        const response = await fetch(`/api/notifications/${notificationId}/read`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          throw new Error('Failed to mark notification as read');
        }

        // Update local state
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId
              ? { ...n, read_at: new Date().toISOString() }
              : n
          )
        );
      } catch (err) {
        console.error('[NotificationCenter] Error marking as read:', err);
        setError(err instanceof Error ? err.message : 'Error updating notification');
      } finally {
        setLoadingId(null);
      }
    },
    []
  );

  // Dismiss (mark as dismissed) notification
  const handleDismiss = useCallback(
    async (notificationId: string) => {
      setLoadingId(notificationId);

      try {
        const response = await fetch(`/api/notifications/${notificationId}/dismiss`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          throw new Error('Failed to dismiss notification');
        }

        // Remove from local state
        setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      } catch (err) {
        console.error('[NotificationCenter] Error dismissing notification:', err);
        setError(err instanceof Error ? err.message : 'Error dismissing notification');
      } finally {
        setLoadingId(null);
      }
    },
    []
  );

  // Mark all as read
  const handleMarkAllRead = useCallback(async () => {
    setLoadingId('all');

    try {
      const response = await fetch('/api/notifications/read-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to mark all as read');
      }

      // Update local state
      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          read_at: n.read_at || new Date().toISOString(),
        }))
      );
    } catch (err) {
      console.error('[NotificationCenter] Error marking all as read:', err);
      setError(err instanceof Error ? err.message : 'Error updating notifications');
    } finally {
      setLoadingId(null);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Calculate unread count
  const unreadCount = notifications.filter((n) => !n.read_at && !n.dismissed_at).length;
  const displayedNotifications = notifications.slice(0, maxItems);

  if (!user?.id) {
    return null;
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative h-9 w-9 p-0 text-gray-600 hover:text-gray-900"
          title="Notifications"
        >
          <Bell className="h-5 w-5" />
          {showBadge && unreadCount > 0 && (
            <span className="absolute top-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-96 p-0" align="end">
        {/* Header */}
        <div className="border-b bg-white p-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
            {unreadCount > 0 && (
              <p className="text-xs text-gray-500">{unreadCount} unread</p>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllRead}
              disabled={loadingId === 'all'}
              className="text-xs text-blue-600 hover:text-blue-700"
              title="Mark all as read"
            >
              {loadingId === 'all' ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <CheckCheck className="h-4 w-4 mr-1" />
              )}
              Mark all read
            </Button>
          )}
        </div>

        {/* Content */}
        <ScrollArea className="h-[400px] bg-gray-50">
          <div className="p-4 space-y-2">
            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : displayedNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Bell className="h-8 w-8 text-gray-300 mb-2" />
                <p className="text-sm font-medium text-gray-500">No notifications</p>
                <p className="text-xs text-gray-400">
                  {notifications.length === 0
                    ? "You're all caught up!"
                    : 'No more notifications to display'}
                </p>
              </div>
            ) : (
              <>
                {displayedNotifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkRead={handleMarkRead}
                    onDismiss={handleDismiss}
                    isLoading={loadingId === notification.id}
                  />
                ))}
              </>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        {notifications.length > maxItems && (
          <>
            <Separator />
            <div className="bg-white p-3 text-center">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-blue-600 hover:text-blue-700"
                asChild
              >
                <a href="/notifications">View all notifications</a>
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
