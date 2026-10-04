'use client';

// app/<your-review-route>/page.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, RefreshCw, X } from 'lucide-react';
import { ProtectedRoute } from '@/components/protected-route';
import { CommitmentReviewPanel, type ReviewAction } from '@/components/commitment-review-panel';
import { PageLoading } from '@/components/page-loading';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useAuthFetch } from '@/hooks/use-auth-fetch';
import { cn } from '@/lib/utils';

interface ReviewTask {
  id: string;
  description: string;
  owner: string;
  meeting_title: string;
  source_quote: string;
  flag_reason: string;
  confidence: number;
  grace_period_ends_at: string;
}

const NOTICES: Record<ReviewAction, string> = {
  approve: 'Commitment kept as extracted.',
  rephrase: 'Commitment updated and kept.',
  dismiss: 'Commitment dismissed and deleted.',
};

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, '0')}`;
}

function PendingReviewContent() {
  const authFetch = useAuthFetch();
  const authFetchRef = useRef(authFetch);
  useEffect(() => {
    authFetchRef.current = authFetch;
  }, [authFetch]);

  const [tasks, setTasks] = useState<ReviewTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const skewRef = useRef(0); // server time minus client time
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() + skewRef.current), 1000);
    return () => clearInterval(id);
  }, []);

  const fetchPending = useCallback(async () => {
    try {
      const res = await authFetchRef.current('/api/commitments/pending-review');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          res.status === 401
            ? 'Your session has expired. Please sign in again.'
            : data.details || data.error || 'Failed to load pending reviews.',
        );
      }
      if (data.server_now) skewRef.current = Date.parse(data.server_now) - Date.now();
      setTasks(data.tasks || []);
      setError(null);
    } catch (err) {
      console.error('Fetch pending review error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load pending reviews.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const active = useMemo(
    () => tasks.filter((t) => Date.parse(t.grace_period_ends_at) > now),
    [tasks, now],
  );
  const selected = active.find((t) => t.id === selectedId) ?? active[0] ?? null;

  const handleResolved = (taskId: string, action: ReviewAction) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setSelectedId(null);
    setNotice(NOTICES[action]);
    setTimeout(() => setNotice(null), 4000);
  };

  if (loading) return <PageLoading />;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Pending Review</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
            Commitments the AI could not verify in the transcript. Review each one before its window closes;
            anything left unreviewed is kept.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={refreshing}
          onClick={() => {
            setRefreshing(true);
            fetchPending();
          }}
        >
          <RefreshCw className={cn('mr-2 h-3.5 w-3.5', refreshing && 'animate-spin')} aria-hidden />
          Refresh
        </Button>
      </header>

      {notice && (
        <Alert className="mt-6 border-emerald-200 bg-emerald-50">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <AlertDescription className="flex items-center justify-between text-emerald-800">
            {notice}
            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label="Dismiss"
              className="rounded p-1 hover:bg-emerald-100"
            >
              <X className="h-4 w-4" />
            </button>
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive" className="mt-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {active.length === 0 ? (
        <div className="mt-8 rounded-lg border border-slate-200 bg-white py-16 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" aria-hidden />
          </div>
          <p className="mt-4 text-base font-medium text-slate-900">Nothing to review</p>
          <p className="mt-1 text-sm text-slate-500">
            Flagged commitments will appear here when they need a decision.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid items-start gap-6 lg:grid-cols-12">
          {/* List */}
          <aside className="lg:col-span-4">
            <p className="mb-2 text-xs font-medium text-slate-500">{active.length} awaiting review</p>
            <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              {active.map((task) => {
                const remaining = Date.parse(task.grace_period_ends_at) - now;
                const isSelected = selected?.id === task.id;
                return (
                  <li key={task.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(task.id)}
                      aria-current={isSelected}
                      className={cn(
                        'block w-full border-l-2 px-4 py-3.5 text-left transition-colors',
                        isSelected
                          ? 'border-l-slate-900 bg-slate-50'
                          : 'border-l-transparent hover:bg-slate-50/70',
                      )}
                    >
                      <p className="line-clamp-2 text-sm font-medium text-slate-900">{task.description}</p>
                      <div className="mt-1.5 flex items-center justify-between gap-3 text-xs text-slate-500">
                        <span className="truncate">{task.owner}</span>
                        <span
                          className={cn(
                            'inline-flex shrink-0 items-center gap-1 font-medium tabular-nums',
                            remaining < 60_000 && 'text-red-600',
                          )}
                        >
                          <Clock className="h-3 w-3" aria-hidden />
                          {formatRemaining(remaining)}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          {/* Panel: key resets internal state when switching tasks */}
          <section className="lg:col-span-8">
            {selected && (
              <CommitmentReviewPanel
                key={selected.id}
                taskId={selected.id}
                taskDescription={selected.description}
                owner={selected.owner}
                meetingTitle={selected.meeting_title}
                sourceQuote={selected.source_quote}
                hallucinationReason={selected.flag_reason}
                confidence={selected.confidence}
                graceUntil={selected.grace_period_ends_at}
                clockSkewMs={skewRef.current}
                onResolved={(action) => handleResolved(selected.id, action)}
              />
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export default function PendingReviewPage() {
  return (
    <ProtectedRoute>
      <PendingReviewContent />
    </ProtectedRoute>
  );
}