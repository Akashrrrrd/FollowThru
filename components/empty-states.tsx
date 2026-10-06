'use client';

import React, { ReactNode } from 'react';
import {
  FileText,
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  Inbox,
  Zap,
  ListChecks,
} from 'lucide-react';

/**
 * Empty State Variants
 *
 * Reusable empty state components for different contexts throughout the app.
 * Each variant uses appropriate iconography and messaging for its use case.
 */

interface EmptyStateVariantProps {
  title: string;
  description: string;
  action?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

function BaseEmptyState({
  icon: Icon,
  title,
  description,
  action,
  size = 'md',
}: Omit<EmptyStateVariantProps, 'title' | 'description'> & {
  icon: React.ComponentType<any>;
  title: string;
  description: string;
}) {
  const sizeMap = {
    sm: {
      container: 'px-4 py-8',
      icon: 'h-8 w-8',
      title: 'text-sm font-medium',
      description: 'text-xs',
      action: 'mt-4',
    },
    md: {
      container: 'px-6 py-12',
      icon: 'h-12 w-12',
      title: 'text-base font-semibold',
      description: 'text-sm',
      action: 'mt-6',
    },
    lg: {
      container: 'px-8 py-16',
      icon: 'h-16 w-16',
      title: 'text-lg font-semibold',
      description: 'text-base',
      action: 'mt-8',
    },
  };

  const s = sizeMap[size];

  return (
    <div className={`flex flex-col items-center justify-center text-center ${s.container}`}>
      <Icon className={`${s.icon} text-slate-300 mb-4`} aria-hidden="true" />
      <h3 className={`${s.title} text-slate-900`}>{title}</h3>
      <p className={`${s.description} text-slate-500 mt-1`}>{description}</p>
      {action && <div className={s.action}>{action}</div>}
    </div>
  );
}

/** No commitments extracted yet - primary CTA to extract from meetings */
export function NoCommitmentsEmpty({
  title = 'No commitments yet',
  description = 'Process a meeting transcript to extract commitments, owners, and deadlines.',
  action,
  size,
}: Omit<EmptyStateVariantProps, 'title' | 'description'> & {
  title?: string;
  description?: string;
}) {
  return (
    <BaseEmptyState
      icon={ListChecks}
      title={title}
      description={description}
      action={action}
      size={size}
    />
  );
}

/** No meetings found - prompt to upload transcript or create first meeting */
export function NoMeetingsEmpty({
  title = 'No meetings yet',
  description = 'Upload a meeting transcript to get started extracting commitments.',
  action,
  size,
}: Omit<EmptyStateVariantProps, 'title' | 'description'> & {
  title?: string;
  description?: string;
}) {
  return (
    <BaseEmptyState
      icon={Calendar}
      title={title}
      description={description}
      action={action}
      size={size}
    />
  );
}

/** No team members - empty team or not yet added members */
export function NoTeamMembersEmpty({
  title = 'No team members yet',
  description = 'Invite team members to collaborate on commitments and track accountability.',
  action,
  size,
}: Omit<EmptyStateVariantProps, 'title' | 'description'> & {
  title?: string;
  description?: string;
}) {
  return (
    <BaseEmptyState
      icon={Users}
      title={title}
      description={description}
      action={action}
      size={size}
    />
  );
}

/** No search results - query returned no matches */
export function NoSearchResultsEmpty({
  title = 'No results found',
  description,
  query,
  action,
  size,
}: Omit<EmptyStateVariantProps, 'title' | 'description'> & {
  title?: string;
  description?: string;
  query?: string;
}) {
  const finalDescription = description || `We couldn't find any commitments${query ? ` for "${query}"` : ''}. Try a different search term.`;
  return (
    <BaseEmptyState
      icon={Search}
      title={title}
      description={finalDescription}
      action={action}
      size={size}
    />
  );
}

/** No notifications - user is all caught up */
export function NoNotificationsEmpty({
  title = "You're all caught up",
  description = 'No new notifications. Check back later for updates on commitments and assignments.',
  action,
  size,
}: Omit<EmptyStateVariantProps, 'title' | 'description'> & {
  title?: string;
  description?: string;
}) {
  return (
    <BaseEmptyState
      icon={Inbox}
      title={title}
      description={description}
      action={action}
      size={size}
    />
  );
}

/** No completed items - dashboard showing completed commitments is empty */
export function NoCompletedEmpty({
  title = 'No completed commitments',
  description = 'Commitments will appear here as they are marked complete. Keep up the great work!',
  action,
  size,
}: Omit<EmptyStateVariantProps, 'title' | 'description'> & {
  title?: string;
  description?: string;
}) {
  return (
    <BaseEmptyState
      icon={CheckCircle2}
      title={title}
      description={description}
      action={action}
      size={size}
    />
  );
}

/** No overdue items - good news! */
export function NoOverdueEmpty({
  title = 'No overdue commitments',
  description = 'Great job staying on top of your commitments! No items are past their due date.',
  action,
  size,
}: Omit<EmptyStateVariantProps, 'title' | 'description'> & {
  title?: string;
  description?: string;
}) {
  return (
    <BaseEmptyState
      icon={CheckCircle2}
      title={title}
      description={description}
      action={action}
      size={size}
    />
  );
}

/** No upcoming items - user has no scheduled commitments */
export function NoUpcomingEmpty({
  title = 'No upcoming commitments',
  description = 'Nothing on the horizon. Extract new commitments from meetings to add items to your schedule.',
  action,
  size,
}: Omit<EmptyStateVariantProps, 'title' | 'description'> & {
  title?: string;
  description?: string;
}) {
  return (
    <BaseEmptyState
      icon={Clock}
      title={title}
      description={description}
      action={action}
      size={size}
    />
  );
}

/** No assigned items - user has nothing assigned to them */
export function NoAssignedEmpty({
  title = 'Nothing assigned yet',
  description = 'You have no commitments assigned to you. Team leads can assign commitments from meetings.',
  action,
  size,
}: Omit<EmptyStateVariantProps, 'title' | 'description'> & {
  title?: string;
  description?: string;
}) {
  return (
    <BaseEmptyState
      icon={Inbox}
      title={title}
      description={description}
      action={action}
      size={size}
    />
  );
}

/** No data for analytics - insufficient data to show trends */
export function NoAnalyticsDataEmpty({
  title = 'No analytics data yet',
  description = 'Analytics will appear here as you extract and complete commitments over time.',
  action,
  size,
}: Omit<EmptyStateVariantProps, 'title' | 'description'> & {
  title?: string;
  description?: string;
}) {
  return (
    <BaseEmptyState
      icon={Zap}
      title={title}
      description={description}
      action={action}
      size={size}
    />
  );
}

/** Error state - something went wrong loading data */
export function DataErrorEmpty({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <BaseEmptyState
      icon={AlertCircle}
      title="Something went wrong"
      description={error || 'Failed to load data. Please try again.'}
      action={
        onRetry ? (
          <button
            onClick={onRetry}
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Try again
          </button>
        ) : undefined
      }
      size="md"
    />
  );
}

/** Filtered to nothing - user applied filters that resulted in no matches */
export function FilteredToNothingEmpty({
  itemType = 'commitments',
  onClearFilters,
}: {
  itemType?: string;
  onClearFilters?: () => void;
}) {
  return (
    <BaseEmptyState
      icon={Search}
      title={`No ${itemType} match`}
      description={`Your current filters don't match any ${itemType}. Try adjusting your selection.`}
      action={
        onClearFilters ? (
          <button
            onClick={onClearFilters}
            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Clear filters
          </button>
        ) : undefined
      }
      size="md"
    />
  );
}
