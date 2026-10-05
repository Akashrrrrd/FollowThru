'use client';

import { useEffect, useState } from 'react';

import {

  BarChart,

  Bar,

  XAxis,

  YAxis,

  CartesianGrid,

  Tooltip,

  Legend,

  ResponsiveContainer,

} from 'recharts';

import { CheckCircle2, Clock, AlertTriangle, TrendingUp } from 'lucide-react';

import { PageLoading, PageError, EmptyState } from '@/components/page-loading';

import { ProtectedRoute } from '@/components/protected-route';

import { useAuthFetch } from '@/hooks/use-auth-fetch';

interface InsightsData {

  summary: {

    totalTasks: number;

    doneTasks: number;

    overdueTasks: number;

    completionRate: number;

  };

  meetingStats: Array<{

    id: string;

    title: string;

    created_at: string;

    done: number;

    overdue: number;

    total: number;

  }>;

  ownerStats: Array<{

    owner: string;

    total: number;

    done: number;

    completionRate: number;

  }>;

}

function InsightsContent() {

  const authFetch = useAuthFetch();

  const [data, setData] = useState<InsightsData | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {

    authFetch('/api/insights')

      .then((res) => res.json())

      .then((d: InsightsData | { error: string }) => {

        if ('error' in d) {

          setError(d.error);

        } else {

          setData(d);

        }

        setLoading(false);

      })

      .catch(() => {

        setError('Network error. Please try again.');

        setLoading(false);

      });

    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, []);

  if (loading) return <PageLoading />;

  if (error) return <PageError message={error} />;

  if (!data) return <PageError message="No data available." />;

  const { summary, meetingStats, ownerStats } = data;

  if (summary.totalTasks === 0) {

    return (

      <EmptyState

        title="No insights yet"

        description="Process some meeting transcripts to see analytics here."

      />

    );

  }

  const chartData = meetingStats

    .slice()

    .reverse()

    .map((m) => ({

      name: m.title.length > 20 ? m.title.slice(0, 20) + '...' : m.title,

      Done: m.done,

      Overdue: m.overdue,

    }));

  return (

    <div className="mx-auto max-w-6xl px-4 py-8">

      <div className="mb-6">

        <h1 className="text-2xl font-bold text-gray-900">Insights</h1>

        <p className="mt-1 text-sm text-gray-500">

          Analytics across all your meetings and commitments.

        </p>

      </div>

      {/* Summary cards */}

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">

              <CheckCircle2 className="h-5 w-5 text-gray-600" />

            </div>

            <div>

              <p className="text-sm text-gray-500">Total commitments</p>

              <p className="text-2xl font-bold text-gray-900">

                {summary.totalTasks}

              </p>

            </div>

          </div>

        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">

              <TrendingUp className="h-5 w-5 text-green-600" />

            </div>

            <div>

              <p className="text-sm text-gray-500">Completion rate</p>

              <p className="text-2xl font-bold text-gray-900">

                {summary.completionRate}%

              </p>

            </div>

          </div>

        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50">

              <AlertTriangle className="h-5 w-5 text-red-600" />

            </div>

            <div>

              <p className="text-sm text-gray-500">Overdue</p>

              <p className="text-2xl font-bold text-gray-900">

                {summary.overdueTasks}

              </p>

            </div>

          </div>

        </div>

      </div>

      {/* Chart */}

      {chartData.length > 0 && (

        <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">

          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-400">

            Commitments per meeting (recent 8)

          </h2>

          <ResponsiveContainer width="100%" height={300}>

            <BarChart data={chartData}>

              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />

              <XAxis

                dataKey="name"

                tick={{ fontSize: 11, fill: '#6b7280' }}

                angle={-15}

                textAnchor="end"

                height={60}

              />

              <YAxis

                tick={{ fontSize: 11, fill: '#6b7280' }}

                allowDecimals={false}

              />

              <Tooltip

                contentStyle={{

                  borderRadius: '8px',

                  border: '1px solid #e5e7eb',

                  fontSize: '12px',

                }}

              />

              <Legend />

              <Bar dataKey="Done" fill="#16a34a" radius={[4, 4, 0, 0]} />

              <Bar dataKey="Overdue" fill="#dc2626" radius={[4, 4, 0, 0]} />

            </BarChart>

          </ResponsiveContainer>

        </div>

      )}

      {/* Commitments by owner */}

      {ownerStats.length > 0 && (

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">

          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-400">

            Commitments by owner

          </h2>

          <div className="space-y-3">

            {ownerStats.map((stat) => (

              <div

                key={stat.owner}

                className="flex items-center justify-between rounded-md border border-gray-100 p-3"

              >

                <div className="flex items-center gap-3">

                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600">

                    {stat.owner.slice(0, 2).toUpperCase()}

                  </span>

                  <span className="text-sm font-medium text-gray-900">

                    {stat.owner}

                  </span>

                </div>

                <div className="flex items-center gap-6 text-sm">

                  <span className="text-gray-500">

                    {stat.total} commitment{stat.total !== 1 ? 's' : ''}

                  </span>

                  <span className="text-green-600">{stat.done} done</span>

                  <span className="text-gray-900 font-medium">

                    {stat.completionRate}%

                  </span>

                </div>

              </div>

            ))}

          </div>

        </div>

      )}

    </div>

  );

}

export default function InsightsPage() {

  return (

    <ProtectedRoute>

      <InsightsContent />

    </ProtectedRoute>

  );

}
