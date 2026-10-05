'use client';

/**
 * Analytics Table Components
 *
 * Display analytics data in tabular format. Props are unchanged.
 */

import React from 'react';

const cardClass =
  'overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05)]';

function CardHeader({ title }: { title: string }) {
  return (
    <div className="border-b border-slate-200 px-6 py-4">
      <h3 className="font-serif text-base font-semibold text-slate-900">{title}</h3>
    </div>
  );
}

interface AnalyticsTableProps {
  title: string;
  columns: Array<{
    key: string;
    label: string;
    align?: 'left' | 'center' | 'right';
    format?: (value: any) => string | React.ReactNode;
  }>;
  data: Array<Record<string, any>>;
}

const alignClass = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

export function AnalyticsTable({ title, columns, data }: AnalyticsTableProps) {
  if (data.length === 0) {
    return (
      <section className={cardClass}>
        <CardHeader title={title} />
        <p className="px-6 py-10 text-center text-sm text-slate-500">No data available</p>
      </section>
    );
  }

  return (
    <section className={cardClass}>
      <CardHeader title={title} />

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={`px-6 py-3 text-xs font-medium text-slate-500 ${alignClass[col.align || 'left']}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((row, rowIndex) => (
              <tr key={rowIndex} className="transition-colors hover:bg-slate-50">
                {columns.map((col) => {
                  const value = row[col.key];
                  return (
                    <td
                      key={col.key}
                      className={`px-6 py-3.5 text-slate-800 ${alignClass[col.align || 'left']}`}
                    >
                      {col.format ? col.format(value) : value}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * Status Breakdown Table
 * Shows count and share by status
 */

interface StatusBreakdownProps {
  data: Record<string, number>;
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In progress',
  blocked: 'Blocked',
  completed: 'Completed',
  overdue: 'Overdue',
  done: 'Done',
};

// Muted, professional tones: [pill bg/text/border, dot + bar]
const STATUS_STYLES: Record<string, { pill: string; bar: string }> = {
  open: { pill: 'border-blue-200 bg-blue-50 text-blue-700', bar: 'bg-blue-600' },
  in_progress: { pill: 'border-indigo-200 bg-indigo-50 text-indigo-700', bar: 'bg-indigo-500' },
  blocked: { pill: 'border-red-200 bg-red-50 text-red-700', bar: 'bg-red-600' },
  completed: { pill: 'border-green-200 bg-green-50 text-green-700', bar: 'bg-green-600' },
  overdue: { pill: 'border-amber-200 bg-amber-50 text-amber-800', bar: 'bg-amber-500' },
  done: { pill: 'border-green-200 bg-green-50 text-green-700', bar: 'bg-green-600' },
};
const FALLBACK_STYLE = { pill: 'border-slate-200 bg-slate-50 text-slate-700', bar: 'bg-slate-500' };

export function StatusBreakdownTable({ data }: StatusBreakdownProps) {
  const rows = Object.entries(data)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => ({ status, count, label: STATUS_LABELS[status] || status }));

  const total = rows.reduce((sum, row) => sum + row.count, 0);

  if (rows.length === 0) {
    return (
      <section className={cardClass}>
        <CardHeader title="By status" />
        <p className="px-6 py-10 text-center text-sm text-slate-500">No data available</p>
      </section>
    );
  }

  return (
    <section className={cardClass}>
      <CardHeader title="By status" />

      <ul className="divide-y divide-slate-100">
        {rows.map((row) => {
          const style = STATUS_STYLES[row.status] ?? FALLBACK_STYLE;
          const pct = total > 0 ? (row.count / total) * 100 : 0;
          return (
            <li key={row.status} className="flex items-center justify-between gap-4 px-6 py-3.5">
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${style.pill}`}
              >
                {row.label}
              </span>

              <div className="flex items-center gap-4">
                <div
                  className="hidden h-1.5 w-32 overflow-hidden rounded-full bg-slate-100 sm:block"
                  role="presentation"
                >
                  <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${pct}%` }} />
                </div>
                <span className="w-10 text-right text-xs text-slate-500">{Math.round(pct)}%</span>
                <span className="w-10 text-right font-serif text-base font-semibold text-slate-900">
                  {row.count}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3.5 text-sm font-medium text-slate-700">
        <span>Total</span>
        <span className="font-serif text-base font-semibold text-slate-900">{total}</span>
      </div>
    </section>
  );
}