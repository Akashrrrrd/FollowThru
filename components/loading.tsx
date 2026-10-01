import React from 'react';

/**
 * Loading animations for FollowThru
 * Professional, classic designs that match the brand aesthetic
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
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
  };

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div className={`${sizeClasses[size]} relative`}>
        <svg
          className="animate-spin text-gold"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
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
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`${dotColorClasses[variant]} h-2 w-2 rounded-full`}
            style={{
              animation: `pulse 1.4s infinite`,
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}

// Gradient bar (progress-like animation)
export function LoadingBar({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="w-32 h-1 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-gold to-primary rounded-full"
          style={{
            animation: 'shimmer 2s infinite',
            backgroundSize: '200% 100%',
          }}
        />
      </div>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}

// Skeleton loader (content placeholder)
export function LoadingContent() {
  return (
    <div className="space-y-4">
      <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
      <div className="h-4 w-full rounded bg-muted animate-pulse" />
      <div className="h-4 w-5/6 rounded bg-muted animate-pulse" />
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
    <div className="fixed inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-50">
      <div className="bg-card rounded-lg shadow-lg p-8">
        {renderLoader()}
      </div>
    </div>
  );
}

// Mini loader (for buttons/inline)
export function LoadingMini() {
  return (
    <svg
      className="animate-spin h-4 w-4 text-current"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

// Task cards skeleton loader
export function LoadingTaskCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-border bg-card p-6 animate-pulse"
        >
          {/* Card header skeleton */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="h-5 bg-muted rounded w-3/4 mb-2" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
            <div className="h-8 w-8 bg-muted rounded-full" />
          </div>

          {/* Card content skeleton */}
          <div className="space-y-3">
            <div className="h-3 bg-muted rounded w-full" />
            <div className="h-3 bg-muted rounded w-5/6" />
          </div>

          {/* Card footer skeleton */}
          <div className="flex gap-2 mt-4 pt-4 border-t border-border">
            <div className="h-2 bg-muted rounded w-12" />
            <div className="h-2 bg-muted rounded w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Extraction steps loader
export function LoadingExtraction() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-16">
      <div className="relative">
        <div className="w-16 h-16 rounded-full border-4 border-gold/20 border-t-gold animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-gold"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              fill="currentColor"
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
            />
          </svg>
        </div>
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-foreground mb-2">
          Extracting Commitments
        </h3>
        <p className="text-sm text-muted-foreground">
          Analyzing meeting transcript and identifying action items...
        </p>
      </div>
      <div className="flex gap-1">
        <div
          className="h-1 w-1 bg-gold rounded-full animate-bounce"
          style={{ animationDelay: '0s' }}
        />
        <div
          className="h-1 w-1 bg-gold rounded-full animate-bounce"
          style={{ animationDelay: '0.2s' }}
        />
        <div
          className="h-1 w-1 bg-gold rounded-full animate-bounce"
          style={{ animationDelay: '0.4s' }}
        />
      </div>
    </div>
  );
}