'use client';

/**
 * Analytics Summary Card Component
 *
 * Displays a key metric with trend and comparison.
 * Used in analytics dashboard summary section. Props are unchanged.
 */

import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

interface AnalyticsSummaryCardProps {
  title: string;
  value: number | string;
  unit?: string;
  subtitle?: string;
  trend?: number; // percentage change (positive = improvement)
  trendLabel?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  icon?: React.ReactNode;
}

const VARIANTS = {
  default: { card: 'border-slate-200 bg-white', chip: 'border-slate-200 bg-slate-50 text-slate-600' },
  success: { card: 'border-green-200 bg-green-50/50', chip: 'border-green-200 bg-green-100 text-green-700' },
  warning: { card: 'border-amber-200 bg-amber-50/50', chip: 'border-amber-200 bg-amber-100 text-amber-800' },
  danger: { card: 'border-red-200 bg-red-50/50', chip: 'border-red-200 bg-red-100 text-red-700' },
};

export function AnalyticsSummaryCard({
  title,
  value,
  unit,
  subtitle,
  trend,
  trendLabel,
  variant = 'default',
  icon,
}: AnalyticsSummaryCardProps) {
  const styles = VARIANTS[variant];

  // trend === 0 is "no change", not a decline
  const direction = trend === undefined ? null : trend > 0 ? 'up' : trend < 0 ? 'down' : 'flat';
  const TrendIcon = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : Minus;
  const trendColor =
    direction === 'up' ? 'text-green-700' : direction === 'down' ? 'text-red-700' : 'text-slate-500';

  return (
    <div
      className={`rounded-lg border p-6 shadow-[0_1px_2px_rgba(16,24,40,0.05)] ${styles.card}`}
    >
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm font-medium text-slate-600">{title}</p>
        {icon && (
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border ${styles.chip}`}
            aria-hidden="true"
          >
            {icon}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <p className="font-serif text-4xl font-semibold tracking-tight text-slate-900">{value}</p>
        {unit && <p className="text-sm text-slate-500">{unit}</p>}
      </div>

      {subtitle && <p className="mt-2 text-xs leading-relaxed text-slate-500">{subtitle}</p>}

      {trend !== undefined && (
        <div className="mt-4 flex items-center gap-2 border-t border-slate-200/80 pt-3 text-xs">
          <span className={`inline-flex items-center gap-0.5 font-semibold ${trendColor}`}>
            <TrendIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {Math.abs(trend)}%
          </span>
          {trendLabel && <span className="text-slate-500">{trendLabel}</span>}
        </div>
      )}
    </div>
  );
}

/**
 * Analytics Summary Grid Component
 *
 * Displays multiple metric cards in a responsive grid.
 */

interface AnalyticsSummaryGridProps {
  cards: AnalyticsSummaryCardProps[];
}

export function AnalyticsSummaryGrid({ cards }: AnalyticsSummaryGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, index) => (
        <AnalyticsSummaryCard key={`${card.title}-${index}`} {...card} />
      ))}
    </div>
  );
}