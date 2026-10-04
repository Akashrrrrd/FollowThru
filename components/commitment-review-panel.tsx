'use client';

// components/commitment-review-panel.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, Check, Clock, Loader2, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuthFetch } from '@/hooks/use-auth-fetch';

export type ReviewAction = 'approve' | 'dismiss' | 'rephrase';

interface CommitmentReviewPanelProps {
  taskId: string;
  taskDescription: string;
  owner: string;
  meetingTitle: string;
  sourceQuote: string;
  hallucinationReason: string;
  confidence: number;
  graceUntil: string; // ISO string
  clockSkewMs?: number; // server time minus client time
  onResolved: (action: ReviewAction) => void;
}

const ACTIONS: { id: ReviewAction; label: string; hint: string; icon: typeof Check }[] = [
  { id: 'approve', label: 'Keep', hint: 'The commitment is correct. Remove the flag and keep it as it is.', icon: Check },
  { id: 'rephrase', label: 'Edit', hint: 'Correct the wording to match what was actually said, then keep it.', icon: Pencil },
  { id: 'dismiss', label: 'Dismiss', hint: 'Not a real commitment. This deletes it permanently.', icon: Trash2 },
];

const CONFIRM_LABEL: Record<ReviewAction, string> = {
  approve: 'Keep commitment',
  rephrase: 'Save changes',
  dismiss: 'Delete commitment',
};

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, '0')}`;
}

export function CommitmentReviewPanel({
  taskId,
  taskDescription,
  owner,
  meetingTitle,
  sourceQuote,
  hallucinationReason,
  confidence,
  graceUntil,
  clockSkewMs = 0,
  onResolved,
}: CommitmentReviewPanelProps) {
  const authFetch = useAuthFetch();
  const authFetchRef = useRef(authFetch);
  useEffect(() => {
    authFetchRef.current = authFetch;
  }, [authFetch]);

  const graceMs = useMemo(() => new Date(graceUntil).getTime(), [graceUntil]);
  const [remaining, setRemaining] = useState(() => graceMs - (Date.now() + clockSkewMs));
  const [action, setAction] = useState<ReviewAction | null>(null);
  const [rephrased, setRephrased] = useState(taskDescription);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setRemaining(graceMs - (Date.now() + clockSkewMs));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [graceMs, clockSkewMs]);

  const expired = remaining <= 0;
  const urgent = !expired && remaining < 60_000;
  const risk = confidence >= 0.7 ? 'High' : confidence >= 0.5 ? 'Medium' : 'Low';
  const current = ACTIONS.find((a) => a.id === action);

  const submit = async () => {
    if (!action || expired) return;

    if (action === 'rephrase') {
      const text = rephrased.trim();
      if (!text) return setError('Description cannot be empty.');
      if (text === taskDescription.trim()) return setError('Change the description before saving.');
    }

    setLoading(true);
    setError(null);
    try {
      const res = await authFetchRef.current(`/api/commitments/${taskId}/hallucination-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          action === 'rephrase' ? { action, new_description: rephrased.trim() } : { action },
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Request failed. Please try again.');
      onResolved(action);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      {/* Commitment */}
      <div className="px-6 pb-5 pt-5">
        <div className="flex items-center justify-between text-xs">
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-600">
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                risk === 'High' ? 'bg-red-500' : risk === 'Medium' ? 'bg-amber-500' : 'bg-slate-400',
              )}
              aria-hidden
            />
            {risk} risk · {Math.round(confidence * 100)}%
          </span>
          <span
            className={cn(
              'inline-flex items-center gap-1.5 font-medium tabular-nums',
              expired ? 'text-slate-400' : urgent ? 'text-red-600' : 'text-slate-600',
            )}
          >
            <Clock className="h-3.5 w-3.5" aria-hidden />
            {expired ? 'Window ended' : `${formatRemaining(remaining)} left`}
          </span>
        </div>

        <p className="mt-4 text-lg font-semibold leading-snug text-slate-900">{taskDescription}</p>
        <p className="mt-1.5 text-sm text-slate-500">
          {owner} <span aria-hidden>·</span> {meetingTitle}
        </p>

        <div className="mt-5 space-y-3">
          <div className="flex gap-2.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
            <span>{hallucinationReason}</span>
          </div>

          {sourceQuote && (
            <figure className="border-l-2 border-slate-300 pl-3">
              <figcaption className="text-xs font-medium text-slate-500">From the transcript</figcaption>
              <blockquote className="mt-0.5 text-sm italic text-slate-700">{sourceQuote}</blockquote>
            </figure>
          )}
        </div>
      </div>

      {/* Decision */}
      <div className="border-t border-slate-200 bg-slate-50/70 px-6 py-5">
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {expired && (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              The review window has ended. This commitment will be kept automatically. Refresh the list.
            </AlertDescription>
          </Alert>
        )}

        <p className="text-sm font-medium text-slate-900">Your decision</p>

        <div
          role="radiogroup"
          aria-label="Review decision"
          className="mt-3 grid grid-cols-3 gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1"
        >
          {ACTIONS.map(({ id, label, icon: Icon }) => {
            const selected = action === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={expired}
                onClick={() => {
                  setAction(id);
                  setError(null);
                }}
                className={cn(
                  'inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50',
                  selected
                    ? id === 'dismiss'
                      ? 'bg-white text-red-700 shadow-sm ring-1 ring-red-200'
                      : 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                    : 'text-slate-600 hover:text-slate-900',
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {label}
              </button>
            );
          })}
        </div>

        <p className="mt-3 min-h-[20px] text-sm text-slate-600">
          {current ? current.hint : 'Choose what should happen to this commitment.'}
        </p>

        {action === 'rephrase' && (
          <Textarea
            value={rephrased}
            onChange={(e) => setRephrased(e.target.value)}
            rows={3}
            placeholder="Enter the corrected commitment description"
            className="mt-3 bg-white"
          />
        )}

        <div className="mt-5 flex justify-end">
          <Button
            onClick={submit}
            disabled={!action || loading || expired}
            variant={action === 'dismiss' ? 'destructive' : 'default'}
            className="min-w-[160px]"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
            {action ? CONFIRM_LABEL[action] : 'Select a decision'}
          </Button>
        </div>
      </div>
    </div>
  );
}