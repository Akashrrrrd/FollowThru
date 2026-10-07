import React from 'react';

/**
 * Loading states for FollowThru.
 * Prefer skeletons (LoadingTaskCards, LoadingContent) for content that has a known shape,
 * and the spinner/bar variants for actions with no predictable layout.
 */

// Spinner with gold accent (primary loader)
export function LoadingSpinner({
  size = 'md',
  message,
}: {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
}) {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-10 w-10',
    lg: 'h-16 w-16',
  };

  return (
    <div className="flex flex-col items-center justify-center gap-3" role="status">
      <div className={`${sizeClasses[size]} relative`}>
        <svg
          className="animate-spin text-gold"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>
      {message ? (
        <p className="text-sm text-muted-foreground">{message}</p>
      ) : (
        <span className="sr-only">Loading</span>
      )}
    </div>
  );
}

// Pulse dots (subtle animation)
export function LoadingPulse({
  message,
  variant = 'gold',
}: {
  message?: string;
  variant?: 'gold' | 'primary' | 'muted';
}) {
  const dotColorClasses = {
    gold: 'bg-gold',
    primary: 'bg-primary',
    muted: 'bg-muted-foreground',
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4" role="status">
      <div className="flex gap-2" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`${dotColorClasses[variant]} h-2 w-2 animate-pulse rounded-full`}
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
      {message ? (
        <p className="text-sm text-muted-foreground">{message}</p>
      ) : (
        <span className="sr-only">Loading</span>
      )}
    </div>
  );
}

// Indeterminate bar
export function LoadingBar({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4" role="status">
      <div className="progress w-40" data-indeterminate aria-hidden="true">
        <span />
      </div>
      {message ? (
        <p className="text-sm text-muted-foreground">{message}</p>
      ) : (
        <span className="sr-only">Loading</span>
      )}
    </div>
  );
}

// Skeleton loader (content placeholder)
export function LoadingContent() {
  return (
    <div className="space-y-3" role="status" aria-busy="true" aria-label="Loading content">
      <div className="skeleton-text w-3/4" />
      <div className="skeleton-text w-full" />
      <div className="skeleton-text w-5/6" />
    </div>
  );
}

// Centered loading overlay
export function LoadingOverlay({
  isLoading = true,
  message = 'Loading...',
  variant = 'spinner',
}: {
  isLoading?: boolean;
  message?: string;
  variant?: 'spinner' | 'pulse' | 'bar';
}) {
  if (!isLoading) return null;

  const renderLoader = () => {
    switch (variant) {
      case 'pulse':
        return <LoadingPulse message={message} />;
      case 'bar':
        return <LoadingBar message={message} />;
      default:
        return <LoadingSpinner message={message} />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
      <div className="rounded-xl border border-border bg-card p-8 shadow-lg">{renderLoader()}</div>
    </div>
  );
}

// Mini loader (for buttons/inline). Buttons can also use aria-busy="true" for the built-in spinner.
export function LoadingMini() {
  return (
    <svg
      className="h-4 w-4 animate-spin text-current"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

// Task cards skeleton loader (mirrors the real TaskCard layout)
export function LoadingTaskCards({ count = 4 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-1 gap-4 md:grid-cols-2"
      role="status"
      aria-busy="true"
      aria-label="Loading commitments"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-card space-y-3">
          <div className="flex items-center gap-2">
            <div className="skeleton h-5 w-20 rounded-full" />
            <div className="skeleton h-5 w-28 rounded-full" />
          </div>
          <div className="skeleton-text w-full" />
          <div className="skeleton-text w-4/5" />
          <div className="flex items-center gap-3 pt-1">
            <div className="skeleton-circle h-7 w-7" />
            <div className="skeleton-text w-24" />
            <div className="skeleton-text ml-auto w-20" />
          </div>
          <div className="flex gap-2 border-t border-border pt-3">
            <div className="skeleton h-7 w-28 rounded-md" />
            <div className="skeleton h-7 w-16 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Extraction progress. Indeterminate on purpose: we don't know how far along the AI is,
// so we say what is happening rather than showing a fake percentage.
export function LoadingExtraction() {
  return (
    <div
      className="mx-auto flex max-w-md flex-col items-center gap-6 py-16 text-center"
      role="status"
      aria-live="polite"
    >
      <div className="relative h-16 w-16">
        <div className="absolute inset-0 animate-spin rounded-full border-4 border-gold/20 border-t-gold" />
        <div className="absolute inset-3 rounded-full bg-gold/10" aria-hidden="true" />
      </div>

      <div>
        <h3 className="font-sans text-lg font-semibold tracking-tight text-foreground">
          Extracting commitments
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Reading the transcript, finding who promised what, and matching owners and due dates.
          Longer meetings take a little longer.
        </p>
      </div>

      <div className="progress w-48" data-indeterminate aria-hidden="true">
        <span />
      </div>

      <p className="text-xs text-muted-foreground">
        Keep this tab open. You&apos;ll go to the meeting page when it&apos;s done.
      </p>
    </div>
  );
}