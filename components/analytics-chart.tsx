'use client';

/**
 * Analytics Chart Components
 *
 * Lightweight SVG charts (no chart library). Props are unchanged:
 * SimpleBarChart and SimpleLineChart can be dropped in over the old versions.
 */

import React, { useId, type ReactNode } from 'react';

interface ChartPoint {
  label: string;
  value: number;
  secondary?: number;
}

const W = 640;
const PAD_L = 48;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 36;

const COLOR = '#2563eb'; // blue-600
const AXIS = '#cbd5e1'; // slate-300
const GRID = '#e2e8f0'; // slate-200
const TEXT = '#64748b'; // slate-500

/** Round the maximum up to a "nice" number so axis ticks are clean (e.g. 37 -> 40). */
function niceMax(max: number): number {
  if (!isFinite(max) || max <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
  const n = max / magnitude;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * magnitude;
}

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1 });
const TICKS = [0, 0.25, 0.5, 0.75, 1];

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
      <div className="border-b border-slate-200 px-6 py-4">
        <h3 className="font-serif text-base font-semibold text-slate-900">{title}</h3>
      </div>
      <div className="px-4 py-5 sm:px-6">{children}</div>
    </section>
  );
}

function EmptyChart({ title }: { title: string }) {
  return (
    <ChartCard title={title}>
      <p className="py-10 text-center text-sm text-slate-500">No data available</p>
    </ChartCard>
  );
}

/* ------------------------------ Bar chart ------------------------------ */

interface SimpleBarChartProps {
  title: string;
  data: ChartPoint[];
  maxValue?: number;
  height?: number;
  unit?: string;
}

export function SimpleBarChart({ title, data, maxValue, height = 300, unit = '' }: SimpleBarChartProps) {
  if (data.length === 0) return <EmptyChart title={title} />;

  const max = niceMax(maxValue ?? Math.max(...data.map((d) => d.value), 0));
  const plotW = W - PAD_L - PAD_R;
  const plotH = height - PAD_T - PAD_B;
  const baseY = PAD_T + plotH;
  const slot = plotW / data.length;
  const barW = Math.min(48, slot * 0.6);
  const labelEvery = Math.ceil(data.length / 12);
  const showValues = data.length <= 12;

  return (
    <ChartCard title={title}>
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full" role="img" aria-label={title}>
        {/* Grid + y labels */}
        {TICKS.map((t) => {
          const y = baseY - t * plotH;
          return (
            <g key={t}>
              <line
                x1={PAD_L}
                x2={W - PAD_R}
                y1={y}
                y2={y}
                stroke={t === 0 ? AXIS : GRID}
                strokeWidth={1}
                strokeDasharray={t === 0 ? undefined : '3 4'}
              />
              <text x={PAD_L - 10} y={y + 4} textAnchor="end" fontSize={11} fill={TEXT}>
                {fmt(max * t)}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((point, i) => {
          const cx = PAD_L + slot * (i + 0.5);
          const h = Math.max(0, (point.value / max) * plotH);
          const y = baseY - h;
          return (
            <g key={`${point.label}-${i}`}>
              <title>{`${point.label}: ${fmt(point.value)}${unit ? ` ${unit}` : ''}`}</title>
              <rect x={cx - barW / 2} y={y} width={barW} height={h} rx={2} fill={COLOR} opacity={0.9} />
              {showValues && point.value > 0 && (
                <text x={cx} y={y - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill="#334155">
                  {fmt(point.value)}
                </text>
              )}
              {i % labelEvery === 0 && (
                <text x={cx} y={baseY + 20} textAnchor="middle" fontSize={11} fill={TEXT}>
                  {point.label.length > 12 ? `${point.label.slice(0, 11)}…` : point.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {unit && <p className="mt-1 text-right text-xs text-slate-500">Values in {unit}</p>}
    </ChartCard>
  );
}

/* ------------------------------ Line chart ------------------------------ */

interface SimpleLineChartProps {
  title: string;
  data: Array<{ date: string; value: number; secondary?: number }>;
  yAxisLabel?: string;
  height?: number;
}

export function SimpleLineChart({ title, data, yAxisLabel = 'Count', height = 300 }: SimpleLineChartProps) {
  const gradientId = useId().replace(/:/g, '');

  if (data.length === 0) return <EmptyChart title={title} />;

  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const plotW = W - PAD_L - PAD_R;
  const plotH = height - PAD_T - PAD_B;
  const baseY = PAD_T + plotH;
  const labelEvery = Math.ceil(data.length / 10);

  const xAt = (i: number) => (data.length === 1 ? PAD_L + plotW / 2 : PAD_L + (i * plotW) / (data.length - 1));
  const yAt = (v: number) => baseY - (v / max) * plotH;

  const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i)} ${yAt(d.value)}`).join(' ');
  const area = `${line} L ${xAt(data.length - 1)} ${baseY} L ${xAt(0)} ${baseY} Z`;

  return (
    <ChartCard title={title}>
      <p className="mb-2 text-xs text-slate-500">{yAxisLabel}</p>
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full" role="img" aria-label={title}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLOR} stopOpacity={0.18} />
            <stop offset="100%" stopColor={COLOR} stopOpacity={0} />
          </linearGradient>
        </defs>

        {TICKS.map((t) => {
          const y = baseY - t * plotH;
          return (
            <g key={t}>
              <line
                x1={PAD_L}
                x2={W - PAD_R}
                y1={y}
                y2={y}
                stroke={t === 0 ? AXIS : GRID}
                strokeWidth={1}
                strokeDasharray={t === 0 ? undefined : '3 4'}
              />
              <text x={PAD_L - 10} y={y + 4} textAnchor="end" fontSize={11} fill={TEXT}>
                {fmt(max * t)}
              </text>
            </g>
          );
        })}

        {data.length > 1 && <path d={area} fill={`url(#${gradientId})`} />}
        <path d={line} fill="none" stroke={COLOR} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {data.map((point, i) => (
          <g key={`${point.date}-${i}`}>
            <title>{`${point.date}: ${fmt(point.value)}`}</title>
            <circle cx={xAt(i)} cy={yAt(point.value)} r={4} fill="#fff" stroke={COLOR} strokeWidth={2} />
            {i % labelEvery === 0 && (
              <text x={xAt(i)} y={baseY + 20} textAnchor="middle" fontSize={11} fill={TEXT}>
                {point.date.substring(5)}
              </text>
            )}
          </g>
        ))}
      </svg>
    </ChartCard>
  );
}