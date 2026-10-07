'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import type { CSSProperties } from 'react';
import Link from 'next/link';
import {
  Plus,
  Filter,
  FilterX,
  Users,
  ArrowUpDown,
  ChevronDown,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Ban,
  Clock,
  CircleDot,
  CheckCircle2,
  ClipboardCheck,
  X,
} from 'lucide-react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { TaskCard } from '@/components/task-card';
import { PageError } from '@/components/page-loading';
import { ProtectedRoute } from '@/components/protected-route';
import { Confetti } from '@/components/Confetti';

import { useAuthFetch } from '@/hooks/use-auth-fetch';
import { useRealtimeCommitments } from '@/hooks/use-realtime-commitments';
import { isOverdue } from '@/lib/lifecycle';
import { cardStatusOf, isDueSoon } from '@/lib/task-status';
import type { CardStatus } from '@/lib/task-status';

import type { Task, TaskStatus } from '@/lib/types';

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const panel = 'rounded-xl border border-border bg-card shadow-sm';

const isCompleted = (task: Task) =>
  task.status === 'completed' || task.status === 'done';

const percent = (part: number, whole: number) =>
  whole > 0 ? Math.round((part / whole) * 100) : 0;

/** Color of the follow-through bar: green when healthy, red when struggling. */
const rateTone = (rate: number) =>
  rate >= 80 ? 'bg-status-done' : rate >= 60 ? 'bg-status-soon' : 'bg-status-overdue';

type OwnerStats = {
  owner: string;
  total: number;
  completed: number;
  inProgress: number;
  blocked: number;
  overdue: number;
  rate: number;
};

/* ----------------------------- Status grouping ---------------------------- */

type SectionKey = 'attention' | 'blocked' | 'soon' | 'active' | 'done';

/** First match wins, so each commitment lives in exactly one section. */
function sectionOf(task: Task): SectionKey {
  if (isCompleted(task)) return 'done';
  if (isOverdue(task)) return 'attention';
  if (task.status === 'blocked') return 'blocked';
  if (isDueSoon(task)) return 'soon';
  return 'active';
}

const SECTIONS: {
  key: SectionKey;
  title: string;
  hint: string;
  status: CardStatus;
  icon: typeof Clock;
}[] = [
  {
    key: 'attention',
    title: 'Needs immediate attention',
    hint: 'Past their due date',
    status: 'overdue',
    icon: AlertTriangle,
  },
  {
    key: 'blocked',
    title: 'Blocked',
    hint: 'Waiting on something',
    status: 'blocked',
    icon: Ban,
  },
  {
    key: 'soon',
    title: 'Due this week',
    hint: 'Due in the next 7 days',
    status: 'soon',
    icon: Clock,
  },
  {
    key: 'active',
    title: 'In progress',
    hint: 'Open and underway',
    status: 'progress',
    icon: CircleDot,
  },
  {
    key: 'done',
    title: 'Completed',
    hint: 'Finished commitments',
    status: 'done',
    icon: CheckCircle2,
  },
];

/* -------------------------------------------------------------------------- */
/* Accountability history                                                     */
/* -------------------------------------------------------------------------- */

type HistoryMeeting = {
  meetingId: string;
  title: string;
  createdAt: string;
  total: number;
  completed: number;
  open: number;
  inProgress: number;
  blocked: number;
  overdue: number;
  continuity: number;
};

type HistoryEvent = {
  id: string;
  eventType: string;
  confidence: string | null;
  sourceQuoteOriginal: string | null;
  createdAt: string | null;
  parentTaskId: string;
  childTaskId: string;
  parentDescription: string | null;
  childDescription: string | null;
  parentMeetingId: string | null;
  childMeetingId: string | null;
  parentMeetingTitle: string | null;
  childMeetingTitle: string | null;
};

type HistoryWeek = {
  label: string;
  total: number;
  completed: number;
  rate: number;
};

type AccountabilityHistory = {
  meetings: HistoryMeeting[];
  continuityEvents: HistoryEvent[];
  weeklyTrend: HistoryWeek[];
};

const INITIAL_MEETINGS = 6;

const STATUS_SEGMENTS = [
  { key: 'completed', label: 'Completed', color: 'bg-status-done' },
  { key: 'inProgress', label: 'In progress', color: 'bg-status-progress' },
  { key: 'blocked', label: 'Blocked', color: 'bg-status-blocked' },
  { key: 'open', label: 'Open', color: 'bg-status-neutral/40' },
] as const;

function formatHistoryDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';

  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const formatEventType = (value: string) => value.replace(/_/g, ' ');

function CardHeader({
  title,
  description,
  aside,
}: {
  title: string;
  description: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
      <div>
        <h3 className="font-sans text-base font-semibold tracking-tight text-foreground">
          {title}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      {aside}
    </div>
  );
}

function ShowMoreButton({
  expanded,
  hiddenCount,
  onClick,
}: {
  expanded: boolean;
  hiddenCount: number;
  onClick: () => void;
}) {
  if (hiddenCount <= 0 && !expanded) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full border-t border-border px-5 py-3 text-center text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
    >
      {expanded ? 'Show less' : `Show ${hiddenCount} more`}
    </button>
  );
}

function TrendCard({ weeks }: { weeks: HistoryWeek[] }) {
  const latest = weeks[weeks.length - 1];
  const previous = weeks[weeks.length - 2];
  const delta = latest && previous ? latest.rate - previous.rate : null;

  return (
    <div className={panel}>
      <CardHeader
        title="Follow-through trend"
        description="Completion rate of commitments created each week."
        aside={
          latest && (
            <div className="text-right">
              <p className="stat-value !text-3xl">
                {latest.rate}
                <span className="text-lg text-muted-foreground">%</span>
              </p>
              {delta !== null && (
                <p
                  className={`mt-1.5 inline-flex items-center gap-1 text-xs font-semibold tabular-nums ${
                    delta >= 0 ? 'text-status-done' : 'text-status-overdue'
                  }`}
                >
                  {delta >= 0 ? (
                    <TrendingUp className="h-3.5 w-3.5" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5" />
                  )}
                  {delta > 0 ? '+' : ''}
                  {delta} pts vs last week
                </p>
              )}
            </div>
          )
        }
      />

      <div className="p-5">
        {weeks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No trend data yet.</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {weeks.map((week) => (
              <div
                key={week.label}
                className="flex min-w-[48px] flex-1 flex-col items-center"
                title={`${week.completed} of ${week.total} completed`}
              >
                <span className="mb-2 text-xs font-medium tabular-nums text-foreground">
                  {week.total > 0 ? `${week.rate}%` : '–'}
                </span>

                <div className="flex h-28 w-full items-end justify-center border-b border-border">
                  <div
                    className={`w-full max-w-[28px] rounded-t transition-all duration-500 ${
                      week.total > 0 ? rateTone(week.rate) : 'bg-muted'
                    }`}
                    style={{
                      height: `${week.total > 0 ? Math.max(week.rate, 3) : 3}%`,
                    }}
                  />
                </div>

                <span className="mt-2 max-w-full truncate text-[11px] text-muted-foreground">
                  {week.label}
                </span>
                <span className="text-[11px] tabular-nums text-muted-foreground/70">
                  {week.completed}/{week.total}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const sameText = (a?: string | null, b?: string | null) =>
  (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();

function ContinuityCard({ events }: { events: HistoryEvent[] }) {
  return (
    <div className={`flex flex-col ${panel}`}>
      <CardHeader
        title="Commitment continuity"
        description="Original commitments and their follow-ups."
        aside={
          events.length > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
              {events.length}
            </span>
          )
        }
      />

      {events.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">
          No follow-ups yet. When a commitment carries over to a later meeting, it shows here.
        </p>
      ) : (
        <ul className="max-h-[300px] flex-1 divide-y divide-border overflow-y-auto">
          {events.map((event) => {
            // Only show the follow-up line when its wording actually differs.
            const showChild =
              !!event.childDescription &&
              !sameText(event.parentDescription, event.childDescription);

            // Only show "A → B" when the follow-up lives in a different meeting.
            const crossMeeting =
              !!event.childMeetingTitle &&
              event.childMeetingTitle !== event.parentMeetingTitle;

            return (
              <li key={event.id} className="px-5 py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="status-badge capitalize" data-status="info">
                      {formatEventType(event.eventType)}
                    </span>
                    {event.confidence && (
                      <span className="text-[11px] capitalize text-muted-foreground">
                        {event.confidence} confidence
                      </span>
                    )}
                  </div>
                  {event.createdAt && (
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {formatHistoryDate(event.createdAt)}
                    </span>
                  )}
                </div>

                <p className="mt-2 text-sm font-medium text-foreground">
                  {event.parentDescription || 'Original commitment'}
                </p>

                {showChild && (
                  <div className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
                    <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <p>{event.childDescription}</p>
                  </div>
                )}

                {event.sourceQuoteOriginal && (
                  <blockquote className="mt-2 line-clamp-2 border-l-2 border-gold/50 pl-3 text-xs italic text-muted-foreground">
                    {event.sourceQuoteOriginal}
                  </blockquote>
                )}

                <p className="mt-2 truncate text-xs text-muted-foreground/80">
                  {event.parentMeetingTitle || 'Original meeting'}
                  {crossMeeting && ` → ${event.childMeetingTitle}`}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function MeetingsCard({ meetings }: { meetings: HistoryMeeting[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? meetings : meetings.slice(0, INITIAL_MEETINGS);

  return (
    <div className={panel}>
      <CardHeader
        title="Meeting history"
        description="How commitments from each meeting are progressing."
        aside={
          <div className="hidden items-center gap-3 text-[11px] text-muted-foreground sm:flex">
            {STATUS_SEGMENTS.map((segment) => (
              <span key={segment.key} className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${segment.color}`} />
                {segment.label}
              </span>
            ))}
          </div>
        }
      />

      {meetings.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">
          No meetings yet. Process a transcript and it appears here.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="table-classic">
              <thead>
                <tr>
                  <th className="px-5">Meeting</th>
                  <th className="text-right">Items</th>
                  <th className="min-w-[160px]">Status mix</th>
                  <th className="text-right">Done</th>
                  <th className="px-5 text-right">Links</th>
                </tr>
              </thead>

              <tbody>
                {visible.map((meeting) => (
                  <tr key={meeting.meetingId}>
                    <td className="max-w-[320px] px-5">
                      <div className="truncate font-medium text-foreground">
                        {meeting.title || 'Untitled meeting'}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        {formatHistoryDate(meeting.createdAt)}
                        {meeting.overdue > 0 && (
                          <span className="status-badge" data-status="overdue">
                            <AlertTriangle className="h-3 w-3" />
                            {meeting.overdue} overdue
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="text-right tabular-nums text-foreground">
                      {meeting.total}
                    </td>

                    <td>
                      <div
                        className="flex h-2 w-full overflow-hidden rounded-full bg-muted"
                        title={STATUS_SEGMENTS.map(
                          (s) => `${s.label}: ${meeting[s.key]}`,
                        ).join(' · ')}
                      >
                        {STATUS_SEGMENTS.map((segment) => (
                          <div
                            key={segment.key}
                            className={segment.color}
                            style={{
                              width: `${percent(meeting[segment.key], meeting.total)}%`,
                            }}
                          />
                        ))}
                      </div>
                    </td>

                    <td className="text-right font-medium tabular-nums text-foreground">
                      {percent(meeting.completed, meeting.total)}%
                    </td>

                    <td
                      className={`px-5 text-right tabular-nums ${
                        meeting.continuity > 0
                          ? 'font-medium text-foreground'
                          : 'text-muted-foreground/50'
                      }`}
                    >
                      {meeting.continuity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ShowMoreButton
            expanded={expanded}
            hiddenCount={meetings.length - INITIAL_MEETINGS}
            onClick={() => setExpanded((prev) => !prev)}
          />
        </>
      )}
    </div>
  );
}

function HistorySkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading history">
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="skeleton h-64 rounded-xl" />
        <div className="skeleton h-64 rounded-xl" />
      </div>
      <div className="skeleton h-48 rounded-xl" />
    </div>
  );
}

function AccountabilityHistorySection({
  data,
  loading,
  error,
}: {
  data: AccountabilityHistory | null;
  loading: boolean;
  error: string | null;
}) {
  const [open, setOpen] = useState(true);

  return (
    <section className="mb-10">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="group mb-4 flex w-full items-end justify-between gap-4 border-b border-border pb-4 text-left"
      >
        <div>
          <h2 className="font-sans text-xl font-semibold tracking-tight text-foreground">
            Accountability history
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Follow-through trends, meeting progress, and commitment continuity.
          </p>
        </div>

        <ChevronDown
          className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-300 group-hover:text-foreground ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open &&
        (loading ? (
          <HistorySkeleton />
        ) : error ? (
          <div className="alert-classic" data-tone="danger">
            Accountability history could not be loaded. Refresh the page to try again.
          </div>
        ) : data ? (
          <div className="page-enter space-y-4">
            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <TrendCard weeks={data.weeklyTrend} />
              <ContinuityCard events={data.continuityEvents} />
            </div>
            <MeetingsCard meetings={data.meetings} />
          </div>
        ) : null)}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Loading, empty, and feedback pieces                                        */
/* -------------------------------------------------------------------------- */

function SummarySkeleton() {
  return <div className="skeleton mb-10 h-40 rounded-xl" aria-hidden="true" />;
}

function TaskListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-1 gap-4 md:grid-cols-2"
      aria-busy="true"
      aria-label="Loading commitments"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-card space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="skeleton-title" />
            <div className="skeleton h-5 w-16 rounded-full" />
          </div>
          <div className="skeleton-text w-full" />
          <div className="skeleton-text w-4/5" />
          <div className="flex items-center gap-3 pt-2">
            <div className="skeleton-circle h-6 w-6" />
            <div className="skeleton-text w-24" />
            <div className="skeleton-text ml-auto w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

type ToastState = {
  key: number;
  taskId: string;
  text: string;
  undoStatus: TaskStatus;
};

function CompletionToast({
  toast,
  onUndo,
  onClose,
}: {
  toast: ToastState | null;
  onUndo: (toast: ToastState) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onClose, 6000);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  return (
    <div className="toast-viewport" role="status" aria-live="polite">
      {toast && (
        <div key={toast.key} className="toast" data-tone="done">
          <CheckCircle2 className="toast-icon h-5 w-5" />
          <div className="min-w-0 flex-1">
            <p className="toast-title">Marked complete</p>
            <p className="toast-body line-clamp-2">{toast.text}</p>
          </div>
          <button type="button" className="toast-action" onClick={() => onUndo(toast)}>
            Undo
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Dismiss"
            className="flex-none rounded-md p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Page content                                                               */
/* -------------------------------------------------------------------------- */

function DashboardContent() {
  const authFetch = useAuthFetch();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [owners, setOwners] = useState<string[]>([]);

  const [statusFilter, setStatusFilter] = useState('all');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [sortDesc, setSortDesc] = useState(false);
  const [myCommitmentsOnly, setMyCommitmentsOnly] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [history, setHistory] = useState<AccountabilityHistory | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Completion feedback
  const [showCompleted, setShowCompleted] = useState(false);
  const [burst, setBurst] = useState(0);
  const [justCompletedId, setJustCompletedId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const filtersActive =
    statusFilter !== 'all' || ownerFilter !== 'all' || myCommitmentsOnly;

  const clearFilters = () => {
    setStatusFilter('all');
    setOwnerFilter('all');
    setMyCommitmentsOnly(false);
  };

  /* ------------------------------- Realtime updates ------------------------------ */

  // Subscribe to commitment changes and update task list
  useRealtimeCommitments(useCallback((event, updatedCommitment) => {
    setTasks((prevTasks) => {
      const idx = prevTasks.findIndex((t) => t.id === updatedCommitment.id);
      if (event === 'delete') {
        // Remove deleted commitment
        if (idx >= 0) {
          return prevTasks.filter((t) => t.id !== updatedCommitment.id);
        }
        return prevTasks;
      } else if (event === 'insert') {
        // Add new commitment if not already present
        if (idx === -1) {
          return [...prevTasks, updatedCommitment];
        }
        return prevTasks;
      } else {
        // Update existing commitment
        if (idx >= 0) {
          const updated = [...prevTasks];
          updated[idx] = updatedCommitment;
          return updated;
        }
        return prevTasks;
      }
    });
  }, []));

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();

      // "overdue" is derived client-side, so it is never sent to the API.
      if (statusFilter !== 'all' && statusFilter !== 'overdue') {
        params.set('status', statusFilter);
      }
      if (ownerFilter !== 'all') params.set('owner', ownerFilter);
      if (myCommitmentsOnly) params.set('my_commitments', 'true');

      const query = params.toString();
      const res = await authFetch(query ? `/api/tasks?${query}` : '/api/tasks');
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to load commitments.');
        setLoading(false);
        return;
      }

      let fetched: Task[] = data.tasks ?? [];

      if (statusFilter === 'overdue') {
        fetched = fetched.filter((task) => isOverdue(task));
      }
      if (sortDesc) {
        fetched = [...fetched].reverse();
      }

      setTasks(fetched);
      setLoading(false);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError('Network error. Please try again.');
      setLoading(false);
    }
  }, [statusFilter, ownerFilter, sortDesc, myCommitmentsOnly, authFetch]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Populate the owner filter from the full, unfiltered task list.
  useEffect(() => {
    let cancelled = false;

    const loadOwners = async () => {
      try {
        const res = await authFetch('/api/tasks');
        const data: { tasks?: Task[] } = await res.json();
        if (cancelled) return;

        const all = Array.from(
          new Set(
            (data.tasks ?? [])
              .map((task) => task.owner)
              .filter(
                (owner): owner is string =>
                  typeof owner === 'string' && owner.trim().length > 0,
              ),
          ),
        ).sort((a, b) => a.localeCompare(b));

        setOwners(all);
      } catch {
        // The owner filter is optional; keep the page usable without it.
      }
    };

    loadOwners();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  // Accountability history (independent of the task filters).
  useEffect(() => {
    let cancelled = false;

    const loadHistory = async () => {
      setHistoryLoading(true);
      setHistoryError(null);

      try {
        const res = await authFetch('/api/accountability/history');
        const data = await res.json();
        if (cancelled) return;

        if (!res.ok) {
          setHistoryError(data.error || 'Failed to load accountability history.');
          setHistoryLoading(false);
          return;
        }

        setHistory(data as AccountabilityHistory);
        setHistoryLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.error('Accountability history fetch error:', err);
        setHistoryError('Failed to load accountability history.');
        setHistoryLoading(false);
      }
    };

    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  /* ------------------------------- Mutations ------------------------------ */

  const patchTask = async (id: string, body: Record<string, unknown>) => {
    const res = await authFetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return { ok: res.ok, task: data.task as Task | undefined };
  };

  const celebrate = (task: Task) => {
    setBurst((n) => n + 1);
    setJustCompletedId(task.id);
    setTimeout(() => setJustCompletedId(null), 1200);

    setToast({
      key: Date.now(),
      taskId: task.id,
      text: task.description,
      undoStatus: task.status,
    });
  };

  // Optimistic status update shared by the checkbox and status dropdown.
  const updateStatus = async (id: string, status: TaskStatus) => {
    const previous = tasks.find((task) => task.id === id);
    const becameDone =
      !!previous &&
      !isCompleted(previous) &&
      (status === 'completed' || status === 'done');

    setTasks((prev) =>
      prev.map((task) => (task.id === id ? { ...task, status } : task)),
    );

    if (becameDone && previous) celebrate(previous);

    try {
      const { ok, task } = await patchTask(id, { status });
      if (!ok || !task) {
        fetchTasks();
        return;
      }
      setTasks((prev) => prev.map((t) => (t.id === id ? task : t)));
    } catch (err) {
      console.error('Status update error:', err);
      fetchTasks();
    }
  };

  const handleToggleDone = (id: string, done: boolean) =>
    updateStatus(id, done ? 'done' : 'open');

  const handleStatusChange = (id: string, newStatus: TaskStatus) =>
    updateStatus(id, newStatus);

  const handleUndo = (current: ToastState) => {
    setToast(null);
    updateStatus(current.taskId, current.undoStatus);
  };

  const closeToast = useCallback(() => setToast(null), []);

  const handleEdit = async (
    id: string,
    updates: { description: string; owner: string; due_date: string | null },
  ) => {
    try {
      const { ok, task } = await patchTask(id, updates);
      if (ok && task) {
        setTasks((prev) => prev.map((t) => (t.id === id ? task : t)));
      }
    } catch (err) {
      console.error('Edit error:', err);
    }
  };

  const handleNudge = async (id: string): Promise<string> => {
    const res = await authFetch(`/api/tasks/${id}/nudge`, { method: 'POST' });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Failed to generate reminder.');
    }
    return data.message;
  };

  /* ------------------------------- Metrics -------------------------------- */

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(isCompleted).length;

    return {
      total,
      completed,
      open: tasks.filter((t) => t.status === 'open').length,
      inProgress: tasks.filter((t) => t.status === 'in_progress').length,
      blocked: tasks.filter((t) => t.status === 'blocked').length,
      overdue: tasks.filter((t) => isOverdue(t)).length,
      rate: percent(completed, total),
    };
  }, [tasks]);

  const ownerStats = useMemo<OwnerStats[]>(() => {
    const grouped = new Map<string, OwnerStats>();

    tasks.forEach((task) => {
      const name =
        typeof task.owner === 'string' && task.owner.trim().length > 0
          ? task.owner.trim()
          : 'Unassigned';

      const row =
        grouped.get(name) ??
        {
          owner: name,
          total: 0,
          completed: 0,
          inProgress: 0,
          blocked: 0,
          overdue: 0,
          rate: 0,
        };

      row.total += 1;
      if (isCompleted(task)) row.completed += 1;
      if (task.status === 'in_progress') row.inProgress += 1;
      if (task.status === 'blocked') row.blocked += 1;
      if (isOverdue(task)) row.overdue += 1;
      row.rate = percent(row.completed, row.total);

      grouped.set(name, row);
    });

    return Array.from(grouped.values()).sort(
      (a, b) => b.rate - a.rate || b.total - a.total,
    );
  }, [tasks]);

  // Each commitment lands in exactly one section; order within a section is preserved.
  const grouped = useMemo(() => {
    const buckets: Record<SectionKey, Task[]> = {
      attention: [],
      blocked: [],
      soon: [],
      active: [],
      done: [],
    };
    tasks.forEach((task) => buckets[sectionOf(task)].push(task));
    return buckets;
  }, [tasks]);

  const statTiles = [
    { label: 'Open', value: stats.open, dot: 'bg-status-neutral', alert: false },
    { label: 'In progress', value: stats.inProgress, dot: 'bg-status-progress', alert: false },
    { label: 'Blocked', value: stats.blocked, dot: 'bg-status-blocked', alert: false },
    { label: 'Overdue', value: stats.overdue, dot: 'bg-status-overdue', alert: true },
    { label: 'Completed', value: stats.completed, dot: 'bg-status-done', alert: false },
  ];

  const showInsights = !loading && !error && tasks.length > 0;
  const completedFilterActive = statusFilter === 'completed' || statusFilter === 'done';

  /* -------------------------------- Render -------------------------------- */

  return (
    <div className="min-h-screen bg-background">
      <Confetti burst={burst} />
      <CompletionToast toast={toast} onUndo={handleUndo} onClose={closeToast} />

      <div className="container-classic page-enter py-10">
        {/* Header */}
        <header className="rule-gold mb-10 flex flex-col gap-4 border-b border-border pb-6 pt-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl sm:text-4xl">Commitments</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Action items from every meeting, in one place.
            </p>
          </div>

          <Link href="/new" className="btn-primary">
            <Plus className="h-4 w-4" />
            New meeting
          </Link>
        </header>

        {loading && <SummarySkeleton />}

        {/* Summary + owner breakdown */}
        {showInsights && (
          <section className="mb-10 space-y-4">
            <div className={`grid overflow-hidden lg:grid-cols-[280px_1fr] ${panel}`}>
              {/* Follow-through */}
              <div className="border-b border-border p-6 lg:border-b-0 lg:border-r">
                <h2 className="font-sans text-sm font-semibold text-muted-foreground">
                  Follow-through
                </h2>
                <p className="stat-value mt-2">
                  {stats.rate}
                  <span className="text-2xl text-muted-foreground">%</span>
                </p>

                <div
                  className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-label="Follow-through rate"
                  aria-valuenow={stats.rate}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${rateTone(stats.rate)}`}
                    style={{ width: `${stats.rate}%` }}
                  />
                </div>

                <p className="mt-3 text-xs text-muted-foreground">
                  {stats.completed} of {stats.total} commitments completed
                </p>
              </div>

              {/* Status breakdown */}
              <dl className="grid grid-cols-2 divide-border sm:grid-cols-5 sm:divide-x">
                {statTiles.map((tile) => (
                  <div
                    key={tile.label}
                    className="flex flex-col justify-center border-b border-border/60 p-5 sm:border-b-0"
                  >
                    <dt className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <span className={`h-2 w-2 rounded-full ${tile.dot}`} />
                      {tile.label}
                    </dt>
                    <dd
                      className={`mt-2 text-2xl font-semibold tabular-nums ${
                        tile.alert && tile.value > 0
                          ? 'text-status-overdue'
                          : 'text-foreground'
                      }`}
                    >
                      {tile.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Owner table */}
            {ownerStats.length > 0 && (
              <div className={panel}>
                <div className="flex items-center gap-2 border-b border-border px-5 py-4">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <h2 className="font-sans text-base font-semibold tracking-tight text-foreground">
                    By owner
                  </h2>
                </div>

                <div className="overflow-x-auto">
                  <table className="table-classic">
                    <thead>
                      <tr>
                        <th className="px-5">Owner</th>
                        <th>Completion</th>
                        <th className="text-right">Total</th>
                        <th className="hidden text-right sm:table-cell">Active</th>
                        <th className="hidden text-right sm:table-cell">Blocked</th>
                        <th className="px-5 text-right">Overdue</th>
                      </tr>
                    </thead>

                    <tbody>
                      {ownerStats.map((row) => (
                        <tr key={row.owner}>
                          <td className="px-5 font-medium text-foreground">
                            {row.owner}
                          </td>

                          <td>
                            <div className="flex items-center gap-3">
                              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                                <div
                                  className={`h-full rounded-full ${rateTone(row.rate)}`}
                                  style={{ width: `${row.rate}%` }}
                                />
                              </div>
                              <span className="w-9 text-xs tabular-nums text-muted-foreground">
                                {row.rate}%
                              </span>
                            </div>
                          </td>

                          <td className="text-right tabular-nums text-foreground">
                            {row.total}
                          </td>
                          <td className="hidden text-right tabular-nums text-foreground sm:table-cell">
                            {row.inProgress}
                          </td>
                          <td className="hidden text-right tabular-nums text-foreground sm:table-cell">
                            {row.blocked}
                          </td>
                          <td
                            className={`px-5 text-right tabular-nums ${
                              row.overdue > 0
                                ? 'font-semibold text-status-overdue'
                                : 'text-muted-foreground/60'
                            }`}
                          >
                            {row.overdue}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}

        <AccountabilityHistorySection
          data={history}
          loading={historyLoading}
          error={historyError}
        />

        {/* Commitments */}
        <section aria-labelledby="commitments-heading">
          <h2 id="commitments-heading" className="mb-4 font-sans text-xl font-semibold tracking-tight text-foreground">
            Your commitments
          </h2>

          {/* Filters */}
          <div className={`mb-8 flex flex-wrap items-center gap-3 px-4 py-3 ${panel}`}>
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Filter className="h-4 w-4" />
              Filters
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In progress</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="done">Done</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>

            <Select value={ownerFilter} onValueChange={setOwnerFilter}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Owner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All owners</SelectItem>
                {owners.map((owner) => (
                  <SelectItem key={owner} value={owner}>
                    {owner}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {filtersActive && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                <FilterX className="h-3.5 w-3.5" />
                Clear filters
              </button>
            )}

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSortDesc((prev) => !prev)}
                className="btn-outline btn-sm"
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
                Due: {sortDesc ? 'latest first' : 'earliest first'}
              </button>

              <button
                type="button"
                onClick={() => setMyCommitmentsOnly((prev) => !prev)}
                aria-pressed={myCommitmentsOnly}
                className={`btn-sm ${myCommitmentsOnly ? 'btn-primary' : 'btn-outline'}`}
              >
                My commitments
              </button>
            </div>
          </div>

          {/* Tasks */}
          {loading ? (
            <TaskListSkeleton count={4} />
          ) : error ? (
            <PageError message={error} onRetry={fetchTasks} />
          ) : tasks.length === 0 ? (
            filtersActive ? (
              <div className="empty-state">
                <div className="empty-state__art">
                  <FilterX className="h-8 w-8" />
                </div>
                <h3>No commitments match these filters</h3>
                <p>Try a different status or owner, or clear the filters to see everything.</p>
                <button type="button" onClick={clearFilters} className="btn-outline mt-2">
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state__art">
                  <ClipboardCheck className="h-8 w-8" />
                </div>
                <h3>No commitments yet</h3>
                <p>
                  Upload a meeting transcript and FollowThru will pull out who promised
                  what, and by when.
                </p>
                <Link href="/new" className="btn-primary mt-2">
                  <Plus className="h-4 w-4" />
                  New meeting
                </Link>
              </div>
            )
          ) : (
            <div className="space-y-10">
              {SECTIONS.map((section) => {
                const items = grouped[section.key];
                if (items.length === 0) return null;

                const Icon = section.icon;
                const isDoneSection = section.key === 'done';
                const expanded = !isDoneSection || showCompleted || completedFilterActive;

                const bandContent = (
                  <>
                    <span className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4" />
                      <h3>{section.title}</h3>
                      <span className="text-xs font-medium opacity-80">
                        {items.length} · {section.hint}
                      </span>
                    </span>
                    {isDoneSection && !completedFilterActive && (
                      <ChevronDown
                        className={`h-4 w-4 transition-transform duration-300 ${
                          expanded ? 'rotate-180' : ''
                        }`}
                      />
                    )}
                  </>
                );

                return (
                  <div key={section.key} className="space-y-4">
                    {isDoneSection && !completedFilterActive ? (
                      <button
                        type="button"
                        onClick={() => setShowCompleted((prev) => !prev)}
                        aria-expanded={expanded}
                        className="status-band w-full text-left"
                        data-status={section.status}
                      >
                        {bandContent}
                      </button>
                    ) : (
                      <div className="status-band" data-status={section.status}>
                        {bandContent}
                      </div>
                    )}

                    {expanded && (
                      <div className="stagger grid grid-cols-1 gap-4 md:grid-cols-2">
                        {items.map((task, index) => {
                          const status = cardStatusOf(task);

                          return (
                            <div
                              key={task.id}
                              data-status={status}
                              data-just-completed={justCompletedId === task.id}
                              style={{ '--i': Math.min(index, 8) } as CSSProperties}
                              className={`relative rounded-xl transition-opacity duration-300 ${
                                status === 'done' ? 'opacity-70 hover:opacity-100' : ''
                              }`}
                            >
                              {/* Status rail: color + shape, never color alone (see badge in card) */}
                              <span
                                aria-hidden
                                className="pointer-events-none absolute inset-y-3 left-0 z-10 w-1 rounded-full bg-[hsl(var(--st))]"
                              />
                              <TaskCard
                                task={task}
                                onToggleDone={handleToggleDone}
                                onStatusChange={handleStatusChange}
                                onEdit={handleEdit}
                                onNudge={handleNudge}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}