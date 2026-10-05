'use client';

import { useState, useCallback, useEffect } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  ArrowLeft,
  ExternalLink,
  Loader2,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Info,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
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

function formatNotificationType(type: NotificationType): string {
  return type
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch all notifications
  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/notifications?limit=500');
      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }

      const data = await response.json();
      setNotifications(data.notifications || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading notifications');
      console.error('[NotificationsPage] Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Handle realtime updates
  useRealtimeNotifications((event, notification) => {
    setNotifications((prev) => {
      if (event === 'insert') {
        return [notification as Notification, ...prev];
      } else if (event === 'update') {
        return prev.map((n) => (n.id === notification.id ? (notification as Notification) : n));
      } else if (event === 'delete') {
        return prev.filter((n) => n.id !== notification.id);
      }
      return prev;
    });
  });

  // Mark as read
  const handleMarkRead = useCallback(
    async (notificationId: string) => {
      setLoadingId(notificationId);

      try {
        const response = await fetch(`/api/notifications/${notificationId}/read`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          throw new Error('Failed to mark as read');
        }

        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId
              ? { ...n, read_at: new Date().toISOString() }
              : n
          )
        );
      } catch (err) {
        console.error('[NotificationsPage] Error marking as read:', err);
      } finally {
        setLoadingId(null);
      }
    },
    []
  );

  // Dismiss
  const handleDismiss = useCallback(
    async (notificationId: string) => {
      setLoadingId(notificationId);

      try {
        const response = await fetch(`/api/notifications/${notificationId}/dismiss`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          throw new Error('Failed to dismiss');
        }

        setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      } catch (err) {
        console.error('[NotificationsPage] Error dismissing:', err);
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

      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          read_at: n.read_at || new Date().toISOString(),
        }))
      );
    } catch (err) {
      console.error('[NotificationsPage] Error marking all as read:', err);
    } finally {
      setLoadingId(null);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Filter and search
  const filtered = notifications.filter((n) => {
    if (filterType !== 'all' && n.type !== filterType) return false;
    if (searchTerm && !n.title.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read_at && !n.dismissed_at).length;
  const typeOptions = Array.from(
    new Set(notifications.map((n) => n.type))
  ).sort();

  if (!user?.id) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="gap-1">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-600 mt-1">
            {notifications.length} total • {unreadCount} unread
          </p>
        </div>

        {/* Controls */}
        <div className="mb-6 space-y-4">
          <div className="flex gap-3">
            <Input
              type="search"
              placeholder="Search notifications..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            {unreadCount > 0 && (
              <Button
                onClick={handleMarkAllRead}
                disabled={loadingId === 'all'}
                className="gap-2"
              >
                {loadingId === 'all' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCheck className="h-4 w-4" />
                )}
                Mark all read
              </Button>
            )}
          </div>

          {/* Filter by type */}
          {typeOptions.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              <Badge
                variant={filterType === 'all' ? 'default' : 'outline'}
                className="cursor-pointer whitespace-nowrap"
                onClick={() => setFilterType('all')}
              >
                All ({notifications.length})
              </Badge>
              {typeOptions.map((type) => {
                const count = notifications.filter((n) => n.type === type).length;
                return (
                  <Badge
                    key={type}
                    variant={filterType === type ? 'default' : 'outline'}
                    className="cursor-pointer whitespace-nowrap"
                    onClick={() => setFilterType(type)}
                  >
                    {formatNotificationType(type as NotificationType)} ({count})
                  </Badge>
                );
              })}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <Card className="mb-6 border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700">{error}</p>
          </Card>
        )}

        {/* Loading */}
        {loading && notifications.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center">
            <Bell className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-lg font-medium text-gray-500">No notifications</p>
            <p className="text-sm text-gray-400">
              {notifications.length === 0 ? "You're all caught up!" : 'No matching notifications'}
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((notification) => {
              const style = getNotificationStyle(notification.type);
              const IconComponent = style.icon;
              const isRead = !!notification.read_at;

              return (
                <Card
                  key={notification.id}
                  className={cn(
                    'group relative flex gap-3 rounded-lg p-4 transition-all',
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
                    <p className="font-medium text-gray-900">{notification.title}</p>
                    <p className="text-sm text-gray-600 mt-0.5">{notification.message}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary" className={style.badgeColor}>
                        {formatNotificationType(notification.type)}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {format(new Date(notification.created_at), 'MMM d, yyyy h:mm a')}
                      </span>
                      {notification.email_failed_at && (
                        <Badge variant="destructive" className="text-xs">
                          Email failed
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {!isRead && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMarkRead(notification.id)}
                        disabled={loadingId === notification.id}
                        title="Mark as read"
                        className="h-9 w-9 p-0"
                      >
                        {loadingId === notification.id ? (
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
                        className="h-9 w-9 p-0"
                      >
                        <a href={notification.action_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDismiss(notification.id)}
                      disabled={loadingId === notification.id}
                      title="Dismiss"
                      className="h-9 w-9 p-0 text-gray-400 hover:text-gray-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
