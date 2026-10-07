'use client';

/**
 * Analytics Dashboard
 *
 * Role-based views:
 * - Manager: Organization-wide analytics with team drill-down
 * - Team Lead: Team analytics with member drill-down
 * - Member: Personal analytics only
 *
 * Self-contained: charts are inline SVG, so this page no longer depends on
 * analytics-summary-card, analytics-chart or analytics-table.
 */

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Ban,
  BarChart3,
  CheckCircle2,
  Clock,
  Download,
  ListChecks,
  Plus,
  Printer,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';

import { ProtectedRoute } from '@/components/protected-route';
import { PageError } from '@/components/page-loading';
import { useTeamContext } from '@/hooks/use-team-context';
import { useOrganizationContext } from '@/hooks/use-organization-context';
import { useAnalytics } from '@/hooks/use-analytics';

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

type Tone = 'done' | 'soon' | 'overdue' | 'progress' | 'blocked' | 'info' | 'neutral';

const TEXT: Record<Tone, string> = {
  done: 'text-status-done',
  soon: 'text-status-soon',
  overdue: 'text-status-overdue',
  progress: 'text-status-progress',
  blocked: 'text-status-blocked',
  info: 'text-status-info',
  neutral: 'text-muted-foreground',
};

const BG: Record<Tone, string> = {
  done: 'bg-status-done',
  soon: 'bg-status-soon',
  overdue: 'bg-status-overdue',
  progress: 'bg-status-progress',
  blocked: 'bg-status-blocked',
  info: 'bg-status-info',
  neutral: 'bg-status-neutral/50',
};

const STROKE: Record<Tone, string> = {
  done: 'stroke-status-done',
  soon: 'stroke-status-soon',
  overdue: 'stroke-status-overdue',
  progress: 'stroke-status-progress',
  blocked: 'stroke-status-blocked',
  info: 'stroke-status-info',
  neutral: 'stroke-status-neutral',
};

/** 80+ healthy, 60-79 watch, below 60 struggling. Matches the dashboard. */
const rateTone = (rate: number): Tone => (rate >= 80 ? 'done' : rate >= 60 ? 'soon' : 'overdue');

const statusTone = (status: string): Tone => {
  switch (status) {
    case 'completed':
    case 'done':
      return 'done';
    case 'in_progress':
      return 'progress';
    case 'blocked':
      return 'blocked';
    case 'overdue':
      return 'overdue';
    default:
      return 'neutral';
  }
};

const humanize = (value: string) => {
  const spaced = value.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

const panel = 'rounded-xl border border-border bg-card shadow-sm';

function formatPointLabel(label: string) {
  const date = new Date(label);
  if (Number.isNaN(date.getTime())) return label;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/* -------------------------------------------------------------------------- */
/* Score ring                                                                 */
/* -------------------------------------------------------------------------- */

function ScoreRing({ value, tone }: { value: number; tone: Tone }) {
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));

  // Start empty, then fill, so the ring animates in once.
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(clamped));
    return () => cancelAnimationFrame(frame);
  }, [clamped]);

  return (
    <div className="relative h-44 w-44 shrink-0">
      <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90" role="img" aria-label={`Follow-through score ${clamped}%`}>
        <circle cx="80" cy="80" r={radius} fill="none" strokeWidth="12" className="stroke-muted" />
        <circle
          cx="80"
          cy="80"
          r={radius}
          fill="none"
          strokeWidth="12"
          strokeLinecap="round"
          className={STROKE[tone]}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - shown / 100)}
          style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="stat-value !text-5xl">
          {clamped}
          <span className="text-2xl text-muted-foreground">%</span>
        </span>
        <span className="mt-1 text-xs font-medium text-muted-foreground">Follow-through</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Trend chart (inline SVG)                                                   */
/* -------------------------------------------------------------------------- */

type Point = { label: string; value: number };

function TrendChart({
  title,
  description,
  points,
  unit = '',
  fixedMax,
  color,
  valueNoun,
}: {
  title: string;
  description: string;
  points: Point[];
  unit?: string;
  fixedMax?: number;
  color: string;
  valueNoun: string;
}) {
  const [active, setActive] = useState<number | null>(null);

  const W = 640;
  const H = 230;
  const pad = { l: 40, r: 16, t: 20, b: 30 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;

  const values = points.map((p) => p.value);
  const rawMax = Math.max(1, ...values);
  const max = fixedMax ?? Math.max(1, Math.ceil(rawMax * 1.2));

  const x = (i: number) =>
    points.length === 1 ? pad.l + innerW / 2 : pad.l + (i * innerW) / (points.length - 1);
  const y = (v: number) => pad.t + innerH * (1 - v / max);

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;

  // Annotate the best and worst points when the series actually varies.
  const highIdx = values.indexOf(Math.max(...values));
  const lowIdx = values.indexOf(Math.min(...values));
  const varies = points.length >= 3 && highIdx !== lowIdx;

  const shownIdx = active ?? points.length - 1;
  const shownPoint = points[shownIdx];

  const labelStep = Math.max(1, Math.ceil(points.length / 6));

  return (
    <div className={panel}>
      <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div>
          <h3 className="font-sans text-base font-semibold tracking-tight text-foreground">{title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        {shownPoint && (
          <div className="text-right" aria-live="polite">
            <p className="stat-value !text-3xl">
              {shownPoint.value}
              <span className="text-base text-muted-foreground">{unit}</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatPointLabel(shownPoint.label)}
            </p>
          </div>
        )}
      </div>

      <div className="p-4 sm:p-5">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full overflow-visible"
          role="img"
          aria-label={`${title}: ${points.length} data points, from ${points[0]?.value ?? 0}${unit} to ${
            points[points.length - 1]?.value ?? 0
          }${unit}`}
        >
          <defs>
            <linearGradient id={`fill-${title.replace(/\W/g, '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.22" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Grid */}
          {[0, 0.5, 1].map((t) => (
            <g key={t}>
              <line
                x1={pad.l}
                x2={W - pad.r}
                y1={y(max * t)}
                y2={y(max * t)}
                className="stroke-border"
                strokeDasharray={t === 0 ? undefined : '3 4'}
              />
              <text
                x={pad.l - 8}
                y={y(max * t) + 4}
                textAnchor="end"
                className="fill-muted-foreground text-[11px]"
              >
                {Math.round(max * t)}
                {unit}
              </text>
            </g>
          ))}

          {points.length > 1 && <path d={area} fill={`url(#fill-${title.replace(/\W/g, '')})`} />}
          {points.length > 1 && (
            <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          )}

          {/* Annotations */}
          {varies &&
            [
              { idx: highIdx, text: `Peak ${values[highIdx]}${unit}`, above: true },
              { idx: lowIdx, text: `Low ${values[lowIdx]}${unit}`, above: false },
            ].map(({ idx, text, above }) => (
              <text
                key={text}
                x={Math.min(Math.max(x(idx), pad.l + 28), W - pad.r - 28)}
                y={y(values[idx]) + (above ? -12 : 20)}
                textAnchor="middle"
                className="fill-foreground text-[11px] font-semibold"
              >
                {text}
              </text>
            ))}

          {/* X labels */}
          {points.map((p, i) =>
            i % labelStep === 0 || i === points.length - 1 ? (
              <text
                key={`${p.label}-${i}`}
                x={x(i)}
                y={H - 8}
                textAnchor="middle"
                className="fill-muted-foreground text-[11px]"
              >
                {formatPointLabel(p.label)}
              </text>
            ) : null,
          )}

          {/* Points + hover columns */}
          {points.map((p, i) => (
            <g key={`pt-${p.label}-${i}`}>
              <rect
                x={x(i) - innerW / Math.max(points.length - 1, 1) / 2}
                y={pad.t}
                width={innerW / Math.max(points.length - 1, 1)}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
              />
              <circle
                cx={x(i)}
                cy={y(p.value)}
                r={shownIdx === i ? 5.5 : 3.5}
                fill={shownIdx === i ? color : 'hsl(var(--card))'}
                stroke={color}
                strokeWidth="2"
                tabIndex={0}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                style={{ transition: 'r 0.15s ease', outline: 'none' }}
              >
                <title>{`${formatPointLabel(p.label)}: ${p.value}${unit} ${valueNoun}`}</title>
              </circle>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Small pieces                                                               */
/* -------------------------------------------------------------------------- */

function MetricCard({
  label,
  value,
  detail,
  tone,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  detail: string;
  tone?: Tone;
  icon: typeof ListChecks;
}) {
  return (
    <div className="stat-card card-static" data-status={tone}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <Icon className={`h-4 w-4 ${tone ? TEXT[tone] : 'text-muted-foreground'}`} />
      </div>
      <p className="stat-value mt-3">{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function StatusBreakdown({ byStatus, total }: { byStatus: Record<string, number>; total: number }) {
  const rows = Object.entries(byStatus)
    .map(([status, count]) => ({
      status,
      label: humanize(status),
      count,
      percent: total > 0 ? Math.round((count / total) * 100) : 0,
      tone: statusTone(status),
    }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className={panel}>
      <div className="border-b border-border px-5 py-4">
        <h3 className="font-sans text-base font-semibold tracking-tight text-foreground">
          Status breakdown
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">Where every commitment stands right now.</p>
      </div>

      <div className="p-5">
        <div
          className="flex h-3 w-full overflow-hidden rounded-full bg-muted"
          role="img"
          aria-label={rows.map((r) => `${r.label}: ${r.count}`).join(', ')}
        >
          {rows.map((row) => (
            <div
              key={row.status}
              className={`${BG[row.tone]} transition-all duration-500`}
              style={{ width: `${row.percent}%` }}
              title={`${row.label}: ${row.count}`}
            />
          ))}
        </div>

        <ul className="mt-5 divide-y divide-border">
          {rows.map((row) => (
            <li key={row.status} className="flex items-center gap-3 py-2.5 text-sm">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${BG[row.tone]}`} />
              <span className="flex-1 font-medium text-foreground">{row.label}</span>
              <span className="tabular-nums text-muted-foreground">{row.percent}%</span>
              <span className="w-10 text-right font-semibold tabular-nums text-foreground">
                {row.count}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="container-classic py-10" role="status" aria-busy="true" aria-label="Loading analytics">
      <div className="skeleton h-10 w-56" />
      <div className="skeleton-text mt-3 w-72 max-w-full" />
      <div className="skeleton mt-8 h-60 rounded-xl" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-32 rounded-xl" />
        ))}
      </div>
      <div className="skeleton mt-6 h-72 rounded-xl" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

const RANGES = [
  { key: '7d', label: '7 days', days: 7 },
  { key: '30d', label: '30 days', days: 30 },
  { key: '90d', label: '90 days', days: 90 },
] as const;

function AnalyticsDashboard() {
  const { isManager } = useOrganizationContext();
  const { context: teamContext } = useTeamContext();
  const [dateRange, setDateRange] = useState<(typeof RANGES)[number]['key']>('30d');
  const [selectedTeamId, setSelectedTeamId] = useState<string | undefined>();

  // Calculate date range
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() - (RANGES.find((r) => r.key === dateRange)?.days ?? 30));
    return d.toISOString().split('T')[0];
  })();

  // Memoize params to prevent infinite refetch loop
  const analyticsParams = useMemo(
    () => ({ startDate, endDate, teamId: selectedTeamId }),
    [startDate, endDate, selectedTeamId],
  );

  const { data, loading, error, refetch } = useAnalytics({ params: analyticsParams });

  const teams = teamContext?.teams ?? [];
  const showTeamSelect = isManager || teams.length > 1;
  const rangeLabel = RANGES.find((r) => r.key === dateRange)?.label ?? '30 days';

  /* ------------------------------ Header (always shown) ------------------------------ */

  const exportCsv = () => {
    if (!data) return;
    const { analytics, trends } = data;
    const m = analytics.metrics;

    const rows: (string | number)[][] = [
      ['FollowThru analytics', `${startDate} to ${endDate}`],
      [],
      ['Metric', 'Value'],
      ['Total commitments', m.total],
      ['Completed', m.completed],
      ['In progress', m.in_progress],
      ['Blocked', m.blocked],
      ['Overdue', m.overdue],
      ['Completion rate (%)', m.completion_rate],
      ['On-time rate (%)', m.on_time_rate],
      ['Follow-through score (%)', m.follow_through_score],
      ['Avg days to complete', m.avg_days_to_complete],
      ['Overdue rate (%)', m.overdue_rate],
      ['Escalations', m.escalation_count],
      [],
      ['Status', 'Count'],
      ...Object.entries(analytics.byStatus).map(([s, c]) => [s, c as number]),
      [],
      ['Week', 'Completion rate (%)'],
      ...trends.completion.map((p) => [p.week, p.completionRate]),
    ];

    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `followthru-analytics-${endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const header = (
    <header className="rule-gold mb-8 flex flex-col gap-4 border-b border-border pb-6 pt-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h1 className="text-3xl sm:text-4xl">Analytics</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          How well commitments are being kept over the last {rangeLabel}.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <div className="inline-flex gap-1 rounded-lg border border-border bg-card p-1" role="group" aria-label="Date range">
          {RANGES.map((range) => (
            <button
              key={range.key}
              type="button"
              onClick={() => setDateRange(range.key)}
              aria-pressed={dateRange === range.key}
              className={`btn-sm ${dateRange === range.key ? 'btn-primary' : 'btn-ghost'}`}
            >
              {range.label}
            </button>
          ))}
        </div>

        {showTeamSelect && (
          <select
            aria-label="Team"
            value={selectedTeamId || ''}
            onChange={(e) => setSelectedTeamId(e.target.value || undefined)}
            className="field !w-auto py-2"
          >
            <option value="">All teams</option>
            {teams.map((team) => (
              <option key={team.teamId} value={team.teamId}>
                {team.teamName}
              </option>
            ))}
          </select>
        )}

        <button type="button" className="btn-outline btn-sm" onClick={exportCsv} disabled={!data}>
          <Download className="h-3.5 w-3.5" />
          Download CSV
        </button>
        <button type="button" className="btn-outline btn-sm" onClick={() => window.print()} disabled={!data}>
          <Printer className="h-3.5 w-3.5" />
          Print or save PDF
        </button>
      </div>
    </header>
  );

  /* -------------------------------- States -------------------------------- */

  if (error) {
    return (
      <div className="container-classic py-10">
        {header}
        <PageError
          title="Analytics didn't load"
          message={error}
          onRetry={refetch}
        />
      </div>
    );
  }

  if (loading || !data) {
    return <AnalyticsSkeleton />;
  }

  const { analytics, trends } = data;
  
  // Safely access metrics with fallback
  if (!analytics || !analytics.metrics) {
    return (
      <div className="container-classic py-10">
        {header}
        <PageError
          title="Analytics data structure error"
          message="Unable to load analytics. The data format is invalid. Please refresh the page."
          onRetry={refetch}
        />
      </div>
    );
  }
  
  const metrics = analytics.metrics;

  if (metrics.total === 0) {
    return (
      <div className="container-classic py-10">
        {header}
        <div className="empty-state">
          <div className="empty-state__art">
            <BarChart3 className="h-8 w-8" />
          </div>
          <h3>Not enough data yet</h3>
          <p>
            Analytics appear once commitments exist in this period. Upload a meeting transcript to
            create the first ones, or try a longer date range.
          </p>
          <Link href="/new" className="btn-primary mt-2">
            <Plus className="h-4 w-4" />
            New meeting
          </Link>
        </div>
      </div>
    );
  }

  /* ------------------------------ Derived data ------------------------------ */

  const score = metrics.follow_through_score;
  const tone = rateTone(score);

  const selectedTeam = teams.find((t) => t.teamId === selectedTeamId);
  const scope = selectedTeam ? selectedTeam.teamName : isManager ? 'Your organization' : 'You';

  const headline =
    tone === 'done'
      ? 'Commitments are being kept.'
      : tone === 'soon'
        ? 'Steady, with room to improve.'
        : 'Too many commitments are slipping.';

  // Week-over-week change, from the last two completion points.
  const completion = trends.completion;
  const last = completion[completion.length - 1];
  const prev = completion[completion.length - 2];
  const delta = last && prev ? Math.round(last.completionRate - prev.completionRate) : null;

  // Insights are derived only from numbers in this response.
  const insights: { tone: Tone; icon: typeof Clock; text: string; detail?: string; href?: string }[] = [];

  if (metrics.overdue > 0) {
    insights.push({
      tone: 'overdue',
      icon: AlertTriangle,
      text: `${metrics.overdue} ${metrics.overdue === 1 ? 'commitment is' : 'commitments are'} overdue`,
      detail: `${metrics.overdue_rate}% of all commitments`,
      href: '/dashboard',
    });
  }
  if (metrics.blocked > 0) {
    insights.push({
      tone: 'blocked',
      icon: Ban,
      text: `${metrics.blocked} ${metrics.blocked === 1 ? 'commitment is' : 'commitments are'} blocked`,
      detail: 'Clear the blocker or reassign the work',
      href: '/dashboard',
    });
  }
  if (metrics.escalation_count > 0) {
    insights.push({
      tone: 'soon',
      icon: Zap,
      text: `${metrics.escalation_count} ${metrics.escalation_count === 1 ? 'escalation' : 'escalations'} in this period`,
    });
  }
  if (metrics.on_time_rate + 15 < metrics.completion_rate) {
    insights.push({
      tone: 'info',
      icon: Clock,
      text: 'Work gets done, but late',
      detail: `${metrics.completion_rate}% completed, only ${metrics.on_time_rate}% on time`,
    });
  }

  const teamRows = isManager && analytics.byTeam
    ? Object.entries(analytics.byTeam)
        .map(([teamId, count]) => ({
          teamId,
          name: teams.find((t) => t.teamId === teamId)?.teamName ?? teamId,
          count: count as number,
        }))
        .sort((a, b) => b.count - a.count)
    : [];
  const teamMax = Math.max(1, ...teamRows.map((r) => r.count));

  /* -------------------------------- Render -------------------------------- */

  return (
    <div className="min-h-screen bg-background">
      <div className="container-classic page-enter py-10">
        {header}

        {/* Hero: the score, then what to do about it */}
        <section className="card-classic card-static mb-6 grid gap-8 p-6 sm:p-8 lg:grid-cols-[auto_1fr] lg:items-center">
          <div className="flex justify-center lg:justify-start">
            <ScoreRing value={score} tone={tone} />
          </div>

          <div>
            <p className="text-sm font-medium text-muted-foreground">{scope}</p>
            <h2 className="mt-1 font-display text-2xl sm:text-3xl">{headline}</h2>

            {delta !== null && (
              <p
                className={`mt-3 inline-flex items-center gap-1.5 text-sm font-semibold tabular-nums ${
                  delta >= 0 ? 'text-status-done' : 'text-status-overdue'
                }`}
              >
                {delta >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {delta > 0 ? '+' : ''}
                {delta} pts completion rate vs the previous week
              </p>
            )}

            <div className="mt-5 border-t border-border pt-5">
              <h3 className="font-sans text-sm font-semibold text-foreground">
                {insights.length > 0 ? 'What needs attention' : 'All clear'}
              </h3>

              {insights.length === 0 ? (
                <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-status-done" />
                  Nothing is overdue or blocked in this period.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {insights.slice(0, 4).map((item) => {
                    const Icon = item.icon;
                    const body = (
                      <>
                        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${TEXT[item.tone]}`} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-foreground">{item.text}</span>
                          {item.detail && (
                            <span className="block text-xs text-muted-foreground">{item.detail}</span>
                          )}
                        </span>
                        {item.href && (
                          <span className="shrink-0 text-xs font-medium text-muted-foreground group-hover:text-foreground">
                            Review
                          </span>
                        )}
                      </>
                    );

                    return (
                      <li key={item.text} data-status={item.tone}>
                        {item.href ? (
                          <Link
                            href={item.href}
                            className="group flex items-start gap-3 rounded-lg border border-border bg-[hsl(var(--st-soft))] px-3.5 py-2.5 no-underline transition-colors hover:border-[hsl(var(--st)/0.5)]"
                          >
                            {body}
                          </Link>
                        ) : (
                          <div className="flex items-start gap-3 rounded-lg border border-border bg-[hsl(var(--st-soft))] px-3.5 py-2.5">
                            {body}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </section>

        {/* Key metrics */}
        <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Key metrics">
          <MetricCard
            label="Total commitments"
            value={metrics.total}
            detail={`${metrics.in_progress} in progress, ${metrics.blocked} blocked`}
            icon={ListChecks}
          />
          <MetricCard
            label="Completed"
            value={metrics.completed}
            detail={`${metrics.completion_rate}% of all commitments`}
            tone="done"
            icon={CheckCircle2}
          />
          <MetricCard
            label="On-time rate"
            value={`${metrics.on_time_rate}%`}
            detail={`Average ${metrics.avg_days_to_complete} days to complete`}
            tone={rateTone(metrics.on_time_rate)}
            icon={Clock}
          />
          <MetricCard
            label="Overdue"
            value={metrics.overdue}
            detail={`${metrics.overdue_rate}% of all commitments`}
            tone={metrics.overdue > 0 ? 'overdue' : 'done'}
            icon={AlertTriangle}
          />
        </section>

        {/* Charts */}
        <section className="mb-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          {completion.length > 0 ? (
            <TrendChart
              title="Completion rate"
              description="Share of commitments completed, week by week."
              points={completion.map((p) => ({ label: p.week, value: p.completionRate }))}
              unit="%"
              fixedMax={100}
              color="hsl(var(--chart-1))"
              valueNoun="completed"
            />
          ) : (
            <div className={`${panel} flex items-center justify-center p-8 text-sm text-muted-foreground`}>
              No weekly trend yet for this period.
            </div>
          )}

          <StatusBreakdown byStatus={analytics.byStatus} total={metrics.total} />
        </section>

        {/* Team breakdown (managers) */}
        {teamRows.length > 0 && (
          <section className={`${panel} mb-6`}>
            <div className="border-b border-border px-5 py-4">
              <h3 className="font-sans text-base font-semibold tracking-tight text-foreground">
                Commitments by team
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="table-classic">
                <thead>
                  <tr>
                    <th className="px-5">Team</th>
                    <th>Share</th>
                    <th className="px-5 text-right">Commitments</th>
                  </tr>
                </thead>
                <tbody>
                  {teamRows.map((row) => (
                    <tr key={row.teamId}>
                      <td className="px-5 font-medium text-foreground">{row.name}</td>
                      <td>
                        <div className="h-1.5 w-40 max-w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-chart-1"
                            style={{ width: `${(row.count / teamMax) * 100}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-5 text-right font-semibold tabular-nums">{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Escalations */}
        {trends.escalation.length > 0 && (
          <section>
            <TrendChart
              title="Escalations"
              description="How often commitments were escalated."
              points={trends.escalation.map((p) => ({ label: p.date, value: p.escalations }))}
              color="hsl(var(--status-overdue))"
              valueNoun="escalations"
            />
          </section>
        )}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <ProtectedRoute>
      <AnalyticsDashboard />
    </ProtectedRoute>
  );
}