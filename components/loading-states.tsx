'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, AlertTriangle } from 'lucide-react';

/**
 * Standardized Loading & Error States
 *
 * Consistent patterns for async operations across the app.
 * Use these instead of ad-hoc loading indicators for uniform UX.
 */

// ============================================================================
// LOADING STATES
// ============================================================================

/** Full page loading state - used when loading major page content */
export function PageSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Skeleton className="h-8 w-48 mb-6" />
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

/** List item skeleton - used for repeating list items */
export function ListItemSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 border-b border-slate-200">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-6 w-16" />
    </div>
  );
}

/** Table row skeleton - used for data table rows */
export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr className="border-b border-slate-200">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-4">
          <Skeleton className="h-4 w-20" />
        </td>
      ))}
    </tr>
  );
}

/** Card skeleton - used for dashboard cards */
export function CardSkeleton() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <Skeleton className="h-6 w-32 mb-4" />
      <div className="space-y-3">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
  );
}

/** Grid of items loading - used for commitment cards, team cards, etc. */
export function GridSkeleton({ count = 6, cols = 3 }: { count?: number; cols?: number }) {
  return (
    <div className={`grid gap-6 md:grid-cols-${cols}`}>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Inline loading spinner - used for small async operations */
export function InlineLoader({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-600">
      <Loader2 className="h-4 w-4 animate-spin" />
      {text}
    </div>
  );
}

/** Button loading state - used when a button action is in progress */
export function ButtonLoader({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="flex items-center gap-2">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>{text}</span>
    </div>
  );
}

/** Overlay loading - used for modal or full-screen operations */
export function OverlayLoader({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm z-50">
      <div className="bg-white rounded-lg p-8 shadow-lg flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-sm font-medium text-slate-900">{message}</p>
      </div>
    </div>
  );
}

// ============================================================================
// ERROR STATES
// ============================================================================

interface ErrorStateProps {
  title: string;
  message: string;
  onRetry?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

/** Standardized error state for failed operations */
export function ErrorState({ title, message, onRetry, size = 'md' }: ErrorStateProps) {
  const sizeClasses = {
    sm: 'px-4 py-6',
    md: 'px-6 py-12',
    lg: 'px-8 py-16',
  };

  return (
    <div className={`flex flex-col items-center justify-center text-center ${sizeClasses[size]}`}>
      <AlertTriangle className="h-12 w-12 text-red-500 mb-4" aria-hidden="true" />
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm text-slate-600 max-w-md">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          Try again
        </button>
      )}
    </div>
  );
}

/** Inline error message - used in forms or for smaller errors */
export function InlineError({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-red-200 bg-red-50 p-4">
      <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" aria-hidden="true" />
      <p className="text-sm text-red-800 flex-1">{message}</p>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-red-600 hover:text-red-800"
          aria-label="Dismiss error"
        >
          ✕
        </button>
      )}
    </div>
  );
}

/** Network error state - specific messaging for connection issues */
export function NetworkError({ onRetry }: { onRetry?: () => void }) {
  return (
    <ErrorState
      title="Connection failed"
      message="Check your internet connection and try again."
      onRetry={onRetry}
    />
  );
}

/** Permission error state - user doesn't have access */
export function PermissionError() {
  return (
    <ErrorState
      title="Access denied"
      message="You don't have permission to view this content."
    />
  );
}

/** Not found error state - resource doesn't exist */
export function NotFoundError() {
  return (
    <ErrorState
      title="Not found"
      message="The item you're looking for doesn't exist or has been deleted."
    />
  );
}

/** Server error state - 500 errors */
export function ServerError({ onRetry }: { onRetry?: () => void }) {
  return (
    <ErrorState
      title="Something went wrong"
      message="An unexpected error occurred. Our team has been notified."
      onRetry={onRetry}
    />
  );
}

// ============================================================================
// VALIDATION ERROR STATES
// ============================================================================

/** Form field error - displayed below form inputs */
export function FieldError({ message }: { message: string }) {
  return <p className="mt-1 text-xs font-medium text-red-600">{message}</p>;
}

/** Validation errors list - for multiple validation errors */
export function ValidationErrors({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;

  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-4 mb-4">
      <p className="text-sm font-medium text-red-900 mb-2">Please fix the following errors:</p>
      <ul className="space-y-1">
        {errors.map((error, i) => (
          <li key={i} className="text-sm text-red-700 flex items-start gap-2">
            <span className="text-red-500 mt-0.5">•</span>
            {error}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================================
// COMBINED STATES (for common patterns)
// ============================================================================

interface AsyncStateProps<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  children: (data: T) => React.ReactNode;
  onRetry?: () => void;
  skeleton?: React.ReactNode;
  emptyMessage?: string;
}

/**
 * Generic async state handler
 * Handles loading, error, empty, and success states
 */
export function AsyncState<T>({
  data,
  loading,
  error,
  children,
  onRetry,
  skeleton = <PageSkeleton />,
  emptyMessage,
}: AsyncStateProps<T>) {
  if (loading) {
    return <>{skeleton}</>;
  }

  if (error) {
    return <ErrorState title="Failed to load" message={error} onRetry={onRetry} />;
  }

  if (!data && emptyMessage) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-slate-500">{emptyMessage}</p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return <>{children(data)}</>;
}
