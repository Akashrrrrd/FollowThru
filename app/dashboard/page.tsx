'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Plus,
  Filter,
  Users,
  ArrowUpDown,
  ChevronDown,
  ArrowRight,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { TaskCard } from '@/components/task-card';
import { PageError, EmptyState } from '@/components/page-loading';
import { LoadingTaskCards } from '@/components/loading';
import { ProtectedRoute } from '@/components/protected-route';

import { useAuthFetch } from '@/hooks/use-auth-fetch';
import { isOverdue } from '@/lib/lifecycle';

import type { Task, TaskStatus } from '@/lib/types';

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const isCompleted = (task: Task) =>
  task.status === 'completed' || task.status === 'done';

const percent = (part: number, whole: number) =>
  whole > 0 ? Math.round((part / whole) * 100) : 0;

type OwnerStats = {
  owner: string;
  total: number;
  completed: number;
  inProgress: number;
  blocked: number;
  overdue: number;
  rate: number;
};

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
  { key: 'completed', label: 'Completed', color: 'bg-emerald-500' },
  { key: 'inProgress', label: 'In progress', color: 'bg-amber-500' },
  { key: 'blocked', label: 'Blocked', color: 'bg-rose-500' },
  { key: 'open', label: 'Open', color: 'bg-slate-300' },
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
    <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
      <div>
        <h3 className="font-sans text-sm font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
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
      className="w-full border-t border-slate-100 px-5 py-3 text-center text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
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
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <CardHeader
        title="Follow-through trend"
        description="Completion rate of commitments created each week."
        aside={
          latest && (
            <div className="text-right">
              <p className="text-2xl font-semibold tabular-nums leading-none text-slate-900">
                {latest.rate}
                <span className="text-base text-slate-400">%</span>
              </p>
              {delta !== null && (
                <p
                  className={`mt-1.5 inline-flex items-center gap-1 text-xs font-medium tabular-nums ${
                    delta >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {delta >= 0 ? (
                    <TrendingUp className="h-3.5 w-3.5" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5" />
                  )}
                  {delta > 0 ? '+' : ''}
                  {delta} pts
                </p>
              )}
            </div>
          )
        }
      />

      <div className="p-5">
        {weeks.length === 0 ? (
          <p className="text-sm text-slate-500">No trend data yet.</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {weeks.map((week) => (
              <div
                key={week.label}
                className="flex min-w-[48px] flex-1 flex-col items-center"
                title={`${week.completed} of ${week.total} completed`}
              >
                <span className="mb-2 text-xs font-medium tabular-nums text-slate-700">
                  {week.total > 0 ? `${week.rate}%` : '–'}
                </span>

                <div className="flex h-28 w-full items-end justify-center border-b border-slate-200">
                  <div
                    className={`w-full max-w-[28px] rounded-t transition-all ${
                      week.total > 0 ? 'bg-emerald-500' : 'bg-slate-200'
                    }`}
                    style={{
                      height: `${week.total > 0 ? Math.max(week.rate, 3) : 3}%`,
                    }}
                  />
                </div>

                <span className="mt-2 max-w-full truncate text-[11px] text-slate-500">
                  {week.label}
                </span>
                <span className="text-[11px] tabular-nums text-slate-400">
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
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      <CardHeader
        title="Commitment continuity"
        description="Original commitments and their follow-ups."
        aside={
          events.length > 0 && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium tabular-nums text-slate-600">
              {events.length}
            </span>
          )
        }
      />

      {events.length === 0 ? (
        <p className="p-5 text-sm text-slate-500">No continuity events yet.</p>
      ) : (
        <ul className="max-h-[300px] flex-1 divide-y divide-slate-100 overflow-y-auto">
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
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium capitalize text-slate-600">
                      {formatEventType(event.eventType)}
                    </span>
                    {event.confidence && (
                      <span className="text-[11px] capitalize text-slate-400">
                        {event.confidence}
                      </span>
                    )}
                  </div>
                  {event.createdAt && (
                    <span className="shrink-0 text-[11px] text-slate-400">
                      {formatHistoryDate(event.createdAt)}
                    </span>
                  )}
                </div>

                <p className="mt-2 text-sm font-medium text-slate-800">
                  {event.parentDescription || 'Original commitment'}
                </p>

                {showChild && (
                  <div className="mt-1 flex items-start gap-1.5 text-sm text-slate-600">
                    <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <p>{event.childDescription}</p>
                  </div>
                )}

                {event.sourceQuoteOriginal && (
                  <blockquote className="mt-2 line-clamp-2 border-l-2 border-slate-200 pl-3 text-xs italic text-slate-500">
                    {event.sourceQuoteOriginal}
                  </blockquote>
                )}

                <p className="mt-2 truncate text-xs text-slate-400">
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
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <CardHeader
        title="Meeting history"
        description="How commitments from each meeting are progressing."
        aside={
          <div className="hidden items-center gap-3 text-[11px] text-slate-500 sm:flex">
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
        <p className="p-5 text-sm text-slate-500">No meeting history yet.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3 font-medium">Meeting</th>
                  <th className="px-3 py-3 text-right font-medium">Items</th>
                  <th className="min-w-[160px] px-5 py-3 font-medium">
                    Status mix
                  </th>
                  <th className="px-3 py-3 text-right font-medium">Done</th>
                  <th className="px-5 py-3 text-right font-medium">Links</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {visible.map((meeting) => (
                  <tr key={meeting.meetingId} className="hover:bg-slate-50/60">
                    <td className="max-w-[320px] px-5 py-3">
                      <div className="truncate font-medium text-slate-900">
                        {meeting.title || 'Untitled meeting'}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                        {formatHistoryDate(meeting.createdAt)}
                        {meeting.overdue > 0 && (
                          <span className="rounded bg-orange-50 px-1.5 py-0.5 font-medium text-orange-600">
                            {meeting.overdue} overdue
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-3 py-3 text-right tabular-nums text-slate-700">
                      {meeting.total}
                    </td>

                    <td className="px-5 py-3">
                      <div
                        className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100"
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

                    <td className="px-3 py-3 text-right font-medium tabular-nums text-slate-700">
                      {percent(meeting.completed, meeting.total)}%
                    </td>

                    <td
                      className={`px-5 py-3 text-right tabular-nums ${
                        meeting.continuity > 0
                          ? 'font-medium text-slate-700'
                          : 'text-slate-300'
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
    <div className="animate-pulse space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="h-64 rounded-xl border border-slate-200 bg-white" />
        <div className="h-64 rounded-xl border border-slate-200 bg-white" />
      </div>
      <div className="h-48 rounded-xl border border-slate-200 bg-white" />
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
    <section className="mb-8">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="group mb-4 flex w-full items-end justify-between gap-4 border-b border-slate-200 pb-4 text-left"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            History
          </p>
          <h2 className="mt-1 font-sans text-xl font-semibold tracking-tight text-slate-900">
            Accountability History
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Follow-through trends, meeting progress, and commitment continuity.
          </p>
        </div>

        <ChevronDown
          className={`h-5 w-5 shrink-0 text-slate-400 transition-transform group-hover:text-slate-600 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open &&
        (loading ? (
          <HistorySkeleton />
        ) : error ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
            History could not be loaded right now.
          </div>
        ) : data ? (
          <div className="space-y-4">
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

  /* ------------------------------- Data load ------------------------------ */

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
        setError(data.error || 'Failed to load tasks.');
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

  // Optimistic status update shared by the checkbox and status dropdown.
  const updateStatus = async (id: string, status: TaskStatus) => {
    setTasks((prev) =>
      prev.map((task) => (task.id === id ? { ...task, status } : task)),
    );

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

  const statTiles = [
    { label: 'Open', value: stats.open, dot: 'bg-slate-400' },
    { label: 'In progress', value: stats.inProgress, dot: 'bg-amber-500' },
    { label: 'Blocked', value: stats.blocked, dot: 'bg-rose-500' },
    { label: 'Overdue', value: stats.overdue, dot: 'bg-orange-500' },
    { label: 'Completed', value: stats.completed, dot: 'bg-emerald-500' },
  ];

  const showInsights = !loading && !error && tasks.length > 0;

  /* -------------------------------- Render -------------------------------- */

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {/* Header */}
        <header className="mb-8 flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Overview
            </p>
            <h1 className="mt-1 font-sans text-2xl font-semibold tracking-tight text-slate-900">
              Commitments Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Action items from every meeting, in one place.
            </p>
          </div>

          <Link href="/new">
            <Button className="bg-slate-900 text-white shadow-sm hover:bg-slate-800">
              <Plus className="mr-1.5 h-4 w-4" />
              New Meeting
            </Button>
          </Link>
        </header>

        {/* Summary + owner breakdown */}
        {showInsights && (
          <section className="mb-8 space-y-4">
            <div className="grid overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[280px_1fr]">
              {/* Follow-through */}
              <div className="border-b border-slate-200 p-6 lg:border-b-0 lg:border-r">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  FollowThru
                </p>
                <p className="mt-2 text-4xl font-semibold tabular-nums text-slate-900">
                  {stats.rate}
                  <span className="text-2xl text-slate-400">%</span>
                </p>

                <div
                  className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
                  role="progressbar"
                  aria-valuenow={stats.rate}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${stats.rate}%` }}
                  />
                </div>

                <p className="mt-3 text-xs text-slate-500">
                  {stats.completed} of {stats.total} commitments completed
                </p>
              </div>

              {/* Status breakdown */}
              <dl className="grid grid-cols-2 divide-slate-200 sm:grid-cols-5 sm:divide-x">
                {statTiles.map((tile) => (
                  <div
                    key={tile.label}
                    className="flex flex-col justify-center border-b border-slate-100 p-5 sm:border-b-0"
                  >
                    <dt className="flex items-center gap-2 text-xs font-medium text-slate-500">
                      <span className={`h-2 w-2 rounded-full ${tile.dot}`} />
                      {tile.label}
                    </dt>
                    <dd className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
                      {tile.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Owner table */}
            {ownerStats.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
                  <Users className="h-4 w-4 text-slate-500" />
                  <h2 className="font-sans text-sm font-semibold text-slate-900">
                    By owner
                  </h2>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                        <th className="px-5 py-3 font-medium">Owner</th>
                        <th className="px-5 py-3 font-medium">Completion</th>
                        <th className="px-3 py-3 text-right font-medium">
                          Total
                        </th>
                        <th className="hidden px-3 py-3 text-right font-medium sm:table-cell">
                          Active
                        </th>
                        <th className="hidden px-3 py-3 text-right font-medium sm:table-cell">
                          Blocked
                        </th>
                        <th className="px-5 py-3 text-right font-medium">
                          Overdue
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {ownerStats.map((row) => (
                        <tr key={row.owner} className="hover:bg-slate-50/60">
                          <td className="px-5 py-3 font-medium text-slate-900">
                            {row.owner}
                          </td>

                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className="h-full rounded-full bg-emerald-500"
                                  style={{ width: `${row.rate}%` }}
                                />
                              </div>
                              <span className="w-9 text-xs tabular-nums text-slate-600">
                                {row.rate}%
                              </span>
                            </div>
                          </td>

                          <td className="px-3 py-3 text-right tabular-nums text-slate-700">
                            {row.total}
                          </td>
                          <td className="hidden px-3 py-3 text-right tabular-nums text-slate-700 sm:table-cell">
                            {row.inProgress}
                          </td>
                          <td className="hidden px-3 py-3 text-right tabular-nums text-slate-700 sm:table-cell">
                            {row.blocked}
                          </td>
                          <td
                            className={`px-5 py-3 text-right tabular-nums ${
                              row.overdue > 0
                                ? 'font-medium text-orange-600'
                                : 'text-slate-400'
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

        {/* Filters */}
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <Filter className="h-4 w-4" />
            Filters
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px] border-slate-200 bg-white">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="done">Done</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>

          <Select value={ownerFilter} onValueChange={setOwnerFilter}>
            <SelectTrigger className="w-[170px] border-slate-200 bg-white">
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

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortDesc((prev) => !prev)}
              className="border-slate-200 text-slate-600"
            >
              <ArrowUpDown className="mr-1.5 h-3.5 w-3.5" />
              Due: {sortDesc ? 'Latest first' : 'Earliest first'}
            </Button>

            <Button
              variant={myCommitmentsOnly ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMyCommitmentsOnly((prev) => !prev)}
              className={
                myCommitmentsOnly
                  ? 'bg-slate-900 text-white hover:bg-slate-800'
                  : 'border-slate-200 text-slate-600'
              }
            >
              My Commitments
            </Button>
          </div>
        </div>

        {/* Tasks */}
        {loading ? (
          <LoadingTaskCards count={4} />
        ) : error ? (
          <PageError message={error} />
        ) : tasks.length === 0 ? (
          <EmptyState
            title="No tasks yet"
            description="Process a meeting transcript to extract action items."
            action={
              <Link href="/new">
                <Button className="bg-slate-900 text-white hover:bg-slate-800">
                  <Plus className="mr-1.5 h-4 w-4" />
                  New Meeting
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onToggleDone={handleToggleDone}
                onStatusChange={handleStatusChange}
                onEdit={handleEdit}
                onNudge={handleNudge}
              />
            ))}
          </div>
        )}
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