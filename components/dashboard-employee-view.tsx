'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Zap,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AccountabilityBadge } from '@/components/accountability-badge';
import type { AccountabilityStatus } from '@/lib/accountability-status';
import { getStatusDescription } from '@/lib/accountability-status';

interface EmployeeDashboardData {
  accountability_status: {
    my_status: AccountabilityStatus;
  };
  mine: {
    total: number;
    completed: number;
    in_progress: number;
    blocked: number;
    overdue: number;
    completion_rate: number;
  };
}

export interface EmployeeDashboardViewProps {
  data: EmployeeDashboardData;
  loading: boolean;
  error: string | null;
}

export function EmployeeDashboardView({
  data,
  loading,
  error,
}: EmployeeDashboardViewProps) {
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-32 rounded-xl border border-slate-200 bg-white" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array(4).fill(0).map((_, i) => (
            <div key={i} className="h-24 rounded-xl border border-slate-200 bg-white" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-500">
        <AlertCircle className="mx-auto mb-2 h-8 w-8" />
        <p>{error || 'Failed to load your accountability data.'}</p>
      </div>
    );
  }

  const status = data.accountability_status.my_status;
  const metrics = data.mine;

  const statTiles = [
    {
      label: 'Open',
      value: metrics.total - metrics.completed,
      icon: Clock,
      color: 'text-slate-600',
      bgColor: 'bg-slate-50',
    },
    {
      label: 'In Progress',
      value: metrics.in_progress,
      icon: TrendingUp,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      label: 'Blocked',
      value: metrics.blocked,
      icon: AlertCircle,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
    },
    {
      label: 'Overdue',
      value: metrics.overdue,
      icon: Zap,
      color: 'text-rose-600',
      bgColor: 'bg-rose-50',
    },
  ];

  return (
    <div className="space-y-6">
      {/* My Accountability Status */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              My Accountability Status
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {getStatusDescription(status)}
            </p>
          </div>
          <AccountabilityBadge status={status} size="lg" />
        </div>

        {/* Completion Rate */}
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">
              Completion Rate
            </span>
            <span className="text-2xl font-semibold tabular-nums text-slate-900">
              {metrics.completion_rate}
              <span className="text-base text-slate-400">%</span>
            </span>
          </div>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
            role="progressbar"
            aria-valuenow={metrics.completion_rate}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${metrics.completion_rate}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {metrics.completed} of {metrics.total} commitments completed
          </p>
        </div>
      </div>

      {/* My Commitments Summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statTiles.map((tile) => {
          const Icon = tile.icon;
          const isAttention = tile.value > 0 && (tile.label === 'Overdue' || tile.label === 'Blocked');

          return (
            <Link
              key={tile.label}
              href={`/dashboard?status=${tile.label.toLowerCase().replace(' ', '_')}`}
              className="group"
            >
              <div
                className={`rounded-lg border border-slate-200 p-4 transition-all hover:border-slate-300 hover:shadow-md ${tile.bgColor}`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-600">
                    {tile.label}
                  </span>
                  <Icon className={`h-4 w-4 ${tile.color}`} />
                </div>
                <p className="text-2xl font-semibold tabular-nums text-slate-900">
                  {tile.value}
                </p>
                {isAttention && (
                  <p className="mt-2 text-xs text-slate-500">
                    Requires attention
                  </p>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Action Items */}
      {(metrics.overdue > 0 || metrics.blocked > 0) && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6">
          <h3 className="font-semibold text-rose-900">Action Required</h3>
          <ul className="mt-3 space-y-2">
            {metrics.overdue > 0 && (
              <li className="text-sm text-rose-800">
                <span className="font-medium">{metrics.overdue} overdue</span> — Review and prioritize
              </li>
            )}
            {metrics.blocked > 0 && (
              <li className="text-sm text-rose-800">
                <span className="font-medium">{metrics.blocked} blocked</span> — Unblock or escalate
              </li>
            )}
          </ul>
          <div className="mt-4 flex gap-2">
            {metrics.overdue > 0 && (
              <Link href="/dashboard?status=overdue">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-rose-300 text-rose-700 hover:bg-rose-100"
                >
                  View Overdue
                </Button>
              </Link>
            )}
            {metrics.blocked > 0 && (
              <Link href="/dashboard?status=blocked">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-rose-300 text-rose-700 hover:bg-rose-100"
                >
                  View Blocked
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* All On Track */}
      {metrics.overdue === 0 && metrics.blocked === 0 && status === 'ON_TRACK' && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" />
            <div>
              <h3 className="font-semibold text-emerald-900">All On Track</h3>
              <p className="mt-1 text-sm text-emerald-800">
                Great work! Your commitments are progressing well.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
