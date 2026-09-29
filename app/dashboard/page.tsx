'use client';

import { useEffect, useState, useCallback } from 'react';

import { Plus, Filter } from 'lucide-react';

import Link from 'next/link';

import { Button } from '@/components/ui/button';

import {

  Select,

  SelectContent,

  SelectItem,

  SelectTrigger,

  SelectValue,

} from '@/components/ui/select';

import { TaskCard } from '@/components/task-card';

import { PageLoading, PageError, EmptyState } from '@/components/page-loading';

import { ProtectedRoute } from '@/components/protected-route';

import { useAuthFetch } from '@/hooks/use-auth-fetch';

import { isOverdue } from '@/lib/lifecycle';

import type { Task, TaskStatus } from '@/lib/types';

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

  const fetchTasks = useCallback(async () => {

    setLoading(true);

    setError(null);

    try {

      const params = new URLSearchParams();

      // Don't send "overdue" to API; handle it client-side

      if (statusFilter !== 'all' && statusFilter !== 'overdue') {

        params.set('status', statusFilter);

      }

      if (ownerFilter !== 'all') params.set('owner', ownerFilter);

      if (myCommitmentsOnly) params.set('my_commitments', 'true');

      const res = await authFetch(`/api/tasks?${params.toString()}`);

      const data = await res.json();

      if (!res.ok) {

        setError(data.error || 'Failed to load tasks.');

        setLoading(false);

        return;

      }

      let fetchedTasks: Task[] = data.tasks ?? [];

      // Filter by overdue client-side if requested

      if (statusFilter === 'overdue') {

        fetchedTasks = fetchedTasks.filter((t) => isOverdue(t));

      }

      if (sortDesc) {

        fetchedTasks = [...fetchedTasks].reverse();

      }

      setTasks(fetchedTasks);

      setLoading(false);

    } catch (err) {

      console.error('Dashboard fetch error:', err);

      setError('Network error. Please try again.');

      setLoading(false);

    }

    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, [statusFilter, ownerFilter, sortDesc, myCommitmentsOnly]);

  useEffect(() => {

    fetchTasks();

  }, [fetchTasks]);

  useEffect(() => {

    authFetch('/api/tasks')

      .then((res) => res.json())

      .then((data: { tasks?: Task[] }) => {

        const allOwners: string[] = Array.from(

          new Set((data.tasks ?? []).map((t) => t.owner)),

        ).sort();

        setOwners(allOwners);

      })

      .catch(() => {});

    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, []);

  const handleToggleDone = async (id: string, done: boolean) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, status: done ? 'done' : 'open' } : t,
      ),
    );

    try {
      const res = await authFetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: done ? 'done' : 'open' }),
      });

      const data = await res.json();

      if (!res.ok) {
        fetchTasks();
      } else {
        setTasks((prev) =>
          prev.map((t) => (t.id === id ? data.task : t)),
        );
      }
    } catch (err) {
      console.error('Toggle error:', err);
      fetchTasks();
    }
  };

  const handleStatusChange = async (id: string, newStatus: TaskStatus) => {
    console.log('Dashboard handleStatusChange:', { id, newStatus });
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, status: newStatus } : t,
      ),
    );

    try {
      const res = await authFetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();
      console.log('API response:', { ok: res.ok, data });

      if (!res.ok) {
        console.error('API error:', data.error);
        fetchTasks();
      } else {
        setTasks((prev) =>
          prev.map((t) => (t.id === id ? data.task : t)),
        );
      }
    } catch (err) {
      console.error('Status change error:', err);
      fetchTasks();
    }
  };

  const handleEdit = async (

    id: string,

    updates: { description: string; owner: string; due_date: string | null },

  ) => {

    try {

      const res = await authFetch(`/api/tasks/${id}`, {

        method: 'PATCH',

        body: JSON.stringify(updates),

      });

      const data = await res.json();

      if (res.ok) {

        setTasks((prev) =>

          prev.map((t) => (t.id === id ? data.task : t)),

        );

      }

    } catch (err) {

      console.error('Edit error:', err);

    }

  };

  const handleNudge = async (id: string): Promise<string> => {

    const res = await authFetch(`/api/tasks/${id}/nudge`, { method: 'POST' });

    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Failed to generate reminder.');

    return data.message;

  };

  return (

    <div className="mx-auto max-w-6xl px-4 py-8">

      <div className="mb-6 flex items-center justify-between">

        <div>

          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

          <p className="mt-1 text-sm text-gray-500">

            All action items across every meeting.

          </p>

        </div>

        <Link href="/new">

          <Button className="bg-blue-600 text-white hover:bg-blue-700">

            <Plus className="mr-1.5 h-4 w-4" />

            New Meeting

          </Button>

        </Link>

      </div>

      {/* Lifecycle Metrics */}

      {tasks.length > 0 && (

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">

          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">

            <p className="text-xs font-medium text-gray-500">Open</p>

            <p className="mt-1 text-2xl font-bold text-blue-600">

              {tasks.filter((t) => t.status === 'open' || t.status === 'overdue').length}

            </p>

          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">

            <p className="text-xs font-medium text-gray-500">In Progress</p>

            <p className="mt-1 text-2xl font-bold text-yellow-600">

              {tasks.filter((t) => t.status === 'in_progress').length}

            </p>

          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">

            <p className="text-xs font-medium text-gray-500">Blocked</p>

            <p className="mt-1 text-2xl font-bold text-red-600">

              {tasks.filter((t) => t.status === 'blocked').length}

            </p>

          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">

            <p className="text-xs font-medium text-gray-500">Completed</p>

            <p className="mt-1 text-2xl font-bold text-green-600">

              {tasks.filter((t) => t.status === 'completed' || t.status === 'done').length}

            </p>

          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">

            <p className="text-xs font-medium text-gray-500">Overdue</p>

            <p className="mt-1 text-2xl font-bold text-orange-600">

              {tasks.filter((t) => isOverdue(t)).length}

            </p>

          </div>

        </div>

      )}

      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">

        <div className="flex items-center gap-2 text-sm text-gray-500">

          <Filter className="h-4 w-4" />

          Filter:

        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>

          <SelectTrigger className="w-[140px] border-gray-200">

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

          <SelectTrigger className="w-[160px] border-gray-200">

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

        <Button

          variant="outline"

          size="sm"

          onClick={() => setSortDesc((prev) => !prev)}

          className="border-gray-200 text-gray-600"

        >

          Due: {sortDesc ? 'Latest first' : 'Earliest first'}

        </Button>

        <Button

          variant={myCommitmentsOnly ? 'default' : 'outline'}

          size="sm"

          onClick={() => setMyCommitmentsOnly((prev) => !prev)}

          className={myCommitmentsOnly ? 'bg-blue-600 text-white' : 'border-gray-200 text-gray-600'}

        >

          My Commitments

        </Button>

      </div>

      {loading ? (

        <PageLoading />

      ) : error ? (

        <PageError message={error} />

      ) : tasks.length === 0 ? (

        <EmptyState

          title="No tasks yet"

          description="Process a meeting transcript to extract action items."

          action={

            <Link href="/new">

              <Button className="bg-blue-600 text-white hover:bg-blue-700">

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

  );

}

export default function DashboardPage() {

  return (

    <ProtectedRoute>

      <DashboardContent />

    </ProtectedRoute>

  );

}
