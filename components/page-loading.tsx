import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';

/** Full-page placeholder that mirrors a title plus a list of cards. */
export function PageLoading() {
  return (
    <div
      className="container-classic py-10"
      role="status"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="skeleton h-9 w-56" />
      <div className="skeleton-text mt-3 w-80 max-w-full" />

      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton-card space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="skeleton h-5 w-20 rounded-full" />
              <div className="skeleton h-5 w-24 rounded-full" />
            </div>
            <div className="skeleton-text w-full" />
            <div className="skeleton-text w-3/4" />
            <div className="flex items-center gap-3 pt-2">
              <div className="skeleton-circle h-7 w-7" />
              <div className="skeleton-text w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Says what went wrong and offers a way forward. Pass `onRetry` to show a retry button. */
export function PageError({
  message,
  title = 'Something went wrong',
  onRetry,
}: {
  message: string;
  title?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl py-10">
      <div
        role="alert"
        className="rounded-xl border border-status-overdue/30 bg-status-overdue-soft p-6 text-center"
        data-status="overdue"
      >
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-status-overdue/10 text-status-overdue">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h3 className="font-sans text-base font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>

        {onRetry && (
          <button type="button" onClick={onRetry} className="btn-outline btn-sm mt-4">
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </button>
        )}
      </div>
    </div>
  );
}

/** An empty screen is an invitation: say what belongs here and offer the next step. */
export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state__art">{icon ?? <Inbox className="h-8 w-8" />}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}