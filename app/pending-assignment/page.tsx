'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, RefreshCw, X } from 'lucide-react';
import { ProtectedRoute } from '@/components/protected-route';
import { AssignmentReviewPanel, type AssignmentTask, type AmbiguityData } from '@/components/assignment-review-panel';
import { PageLoading } from '@/components/page-loading';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useAuthFetch } from '@/hooks/use-auth-fetch';
import { cn } from '@/lib/utils';

function PendingAssignmentContent() {
  const authFetch = useAuthFetch();
  const authFetchRef = useRef(authFetch);
  useEffect(() => {
    authFetchRef.current = authFetch;
  }, [authFetch]);

  const [tasks, setTasks] = useState<AssignmentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchPending = useCallback(async () => {
    try {
      const res = await authFetchRef.current('/api/tasks/pending-assignment');
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          res.status === 401
            ? 'Your session has expired. Please sign in again.'
            : data.details || data.error || 'Failed to load pending assignments.',
        );
      }

      setTasks(data.tasks || []);
      setError(null);
    } catch (err) {
      console.error('Fetch pending assignment error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load pending assignments.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const selected = useMemo(() => tasks.find((t) => t.id === selectedId) ?? tasks[0] ?? null, [tasks, selectedId]);

  const handleResolved = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setSelectedId(null);
    setNotice('Assignment confirmed successfully.');
    setTimeout(() => setNotice(null), 4000);
  };

  if (loading) return <PageLoading />;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Pending Assignment
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
            Commitments that couldn't be automatically assigned to a person or team. Review and confirm the correct
            assignments.
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

      {tasks.length === 0 ? (
        <div className="mt-8 rounded-lg border border-slate-200 bg-white py-16 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" aria-hidden />
          </div>
          <p className="mt-4 text-base font-medium text-slate-900">All assignments confirmed</p>
          <p className="mt-1 text-sm text-slate-500">
            Commitments that need assignment review will appear here.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid items-start gap-6 lg:grid-cols-12">
          {/* List */}
          <aside className="lg:col-span-4">
            <p className="mb-2 text-xs font-medium text-slate-500">{tasks.length} awaiting assignment</p>
            <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              {tasks.map((task) => {
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
                      <div className="mt-1.5 flex flex-col gap-1">
                        <span className="text-xs text-slate-600">Owner: {task.owner}</span>
                        <span className="text-xs text-slate-600">Meeting: {task.meeting_title}</span>
                        {task.assignment_ambiguity_data && (
                          <span className="inline-flex w-fit rounded bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                            {task.assignment_ambiguity_data.ambiguity_type.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          {/* Panel: key resets internal state when switching tasks */}
          <section className="lg:col-span-8">
            {selected && selected.assignment_ambiguity_data && (
              <AssignmentReviewPanel
                key={selected.id}
                taskId={selected.id}
                taskDescription={selected.description}
                owner={selected.owner}
                sourceQuote={selected.source_quote}
                meetingTitle={selected.meeting_title}
                ambiguityData={selected.assignment_ambiguity_data as AmbiguityData}
                onResolved={(taskId) => handleResolved(taskId)}
              />
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export default function PendingAssignmentPage() {
  return (
    <ProtectedRoute>
      <PendingAssignmentContent />
    </ProtectedRoute>
  );
}
