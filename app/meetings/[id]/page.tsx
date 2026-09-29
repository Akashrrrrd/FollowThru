'use client';

import { useEffect, useState, useCallback } from 'react';

import { useRouter } from 'next/navigation';

import Link from 'next/link';

import {

  ArrowLeft,

  FileText,

  ChevronDown,

  ChevronUp,

  Plus,

  Loader2,

  X,

} from 'lucide-react';

import { Button } from '@/components/ui/button';

import { Input } from '@/components/ui/input';

import {

  Collapsible,

  CollapsibleTrigger,

  CollapsibleContent,

} from '@/components/ui/collapsible';

import { TaskCard } from '@/components/task-card';

import { PageLoading, PageError } from '@/components/page-loading';

import { ProtectedRoute } from '@/components/protected-route';

import { useAuthFetch } from '@/hooks/use-auth-fetch';

import type { Meeting, Task, CarriedOverTask, TaskStatus } from '@/lib/types';

function formatDate(dateStr: string): string {

  const date = new Date(dateStr);

  if (isNaN(date.getTime())) return dateStr;

  return date.toLocaleDateString('en-US', {

    month: 'long',

    day: 'numeric',

    year: 'numeric',

  });

}

function MeetingDetailContent({

  params,

}: {

  params: { id: string };

}) {

  const { id } = params;

  const router = useRouter();

  const authFetch = useAuthFetch();

  const [meeting, setMeeting] = useState<Meeting | null>(null);

  const [tasks, setTasks] = useState<Task[]>([]);

  const [carriedOver, setCarriedOver] = useState<CarriedOverTask[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [showTranscript, setShowTranscript] = useState(false);

  // Add task form state

  const [showAddForm, setShowAddForm] = useState(false);

  const [addDescription, setAddDescription] = useState('');

  const [addOwner, setAddOwner] = useState('');

  const [addDueDate, setAddDueDate] = useState('');

  const [addLoading, setAddLoading] = useState(false);

  const [addError, setAddError] = useState<string | null>(null);

  const fetchMeeting = useCallback(async () => {

    setLoading(true);

    setError(null);

    try {

      const res = await authFetch(`/api/meetings/${id}`);

      const data = await res.json();

      if (!res.ok) {

        setError(data.error || 'Meeting not found.');

        setLoading(false);

        return;

      }

      setMeeting(data.meeting);

      setTasks(data.tasks ?? []);

      // Fetch carried-over tasks

      const coRes = await authFetch('/api/tasks/carried-over');

      const coData = await coRes.json();

      if (coRes.ok) {

        setCarriedOver((coData.tasks ?? []).filter((t: CarriedOverTask) => t.meeting_id !== id));

      }

      setLoading(false);

    } catch (err) {

      console.error('Meeting detail fetch error:', err);

      setError('Network error. Please try again.');

      setLoading(false);

    }

    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, [id]);

  useEffect(() => {

    fetchMeeting();

  }, [fetchMeeting]);

  const handleToggleDone = async (taskId: string, done: boolean) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, status: done ? 'done' : 'open' } : t,
      ),
    );

    try {
      const res = await authFetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: done ? 'done' : 'open' }),
      });

      const data = await res.json();

      if (!res.ok) {
        fetchMeeting();
      } else {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? data.task : t)),
        );
      }
    } catch (err) {
      console.error('Toggle error:', err);
      fetchMeeting();
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    // Update both tasks and carriedOver states
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, status: newStatus } : t,
      ),
    );
    setCarriedOver((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, status: newStatus } : t,
      ),
    );

    try {
      const res = await authFetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();

      if (!res.ok) {
        fetchMeeting();
      } else {
        // Update the task in the appropriate state
        const updatedTask = data.task;
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? updatedTask : t)),
        );
        setCarriedOver((prev) =>
          prev.map((t) => (t.id === taskId ? updatedTask : t)),
        );
      }
    } catch (err) {
      console.error('Status change error:', err);
      fetchMeeting();
    }
  }

  const handleEdit = async (

    taskId: string,

    updates: { description: string; owner: string; due_date: string | null },

  ) => {

    try {

      const res = await authFetch(`/api/tasks/${taskId}`, {

        method: 'PATCH',

        body: JSON.stringify(updates),

      });

      const data = await res.json();

      if (res.ok) {

        setTasks((prev) =>

          prev.map((t) => (t.id === taskId ? data.task : t)),

        );

      }

    } catch (err) {

      console.error('Edit error:', err);

    }

  };

  const handleNudge = async (taskId: string): Promise<string> => {

    const res = await authFetch(`/api/tasks/${taskId}/nudge`, {

      method: 'POST',

    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Failed to generate reminder.');

    return data.message;

  };

  const handleAddTask = async (e: React.FormEvent) => {

    e.preventDefault();

    if (!addDescription.trim() || !addOwner.trim()) {

      setAddError('Description and owner are required.');

      return;

    }

    setAddError(null);

    setAddLoading(true);

    try {

      const res = await authFetch('/api/tasks', {

        method: 'POST',

        body: JSON.stringify({

          meeting_id: id,

          description: addDescription.trim(),

          owner: addOwner.trim(),

          due_date: addDueDate || null,

        }),

      });

      const data = await res.json();

      if (!res.ok) {

        setAddError(data.error || 'Failed to add task.');

        setAddLoading(false);

        return;

      }

      setTasks((prev) => [...prev, data.task]);

      setAddDescription('');

      setAddOwner('');

      setAddDueDate('');

      setShowAddForm(false);

      setAddLoading(false);

    } catch (err) {

      console.error('Add task error:', err);

      setAddError('Network error. Please try again.');

      setAddLoading(false);

    }

  };

  if (loading) return <PageLoading />;

  if (error) return <PageError message={error} />;

  if (!meeting) return <PageError message="Meeting not found." />;

  const doneCount = tasks.filter((t) => t.status === 'done').length;

  return (

    <div className="mx-auto max-w-6xl px-4 py-8">

      <Button

        variant="ghost"

        size="sm"

        onClick={() => router.push('/meetings')}

        className="mb-4 text-gray-500 hover:text-gray-700"

      >

        <ArrowLeft className="mr-1.5 h-4 w-4" />

        Back to Meetings

      </Button>

      <div className="mb-8">

        <h1 className="text-2xl font-bold text-gray-900">{meeting.title}</h1>

        <p className="mt-1 text-sm text-gray-500">

          {formatDate(meeting.created_at)} — {doneCount}/{tasks.length} tasks

          done

        </p>

      </div>

      {/* Carried-over tasks */}

      {carriedOver.length > 0 && (

        <div className="mb-8 rounded-lg border-2 border-blue-200 bg-blue-50 p-5">

          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-blue-900">

            ↻ Carried over from previous meetings

          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

            {carriedOver.map((task) => (

              <TaskCard
                key={task.id}
                task={task}
                carriedOver
                meetingTitle={task.meeting_title}
                onToggleDone={handleToggleDone}
                onStatusChange={handleStatusChange}
                onEdit={handleEdit}
                onNudge={handleNudge}
              />

            ))}

          </div>

        </div>

      )}

      {/* Action items */}

      <div className="mb-8">

        <div className="mb-4 flex items-center justify-between border-b-2 border-gray-300 pb-3">

          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-900">

            Action Items (This Meeting)

          </h2>

          <Button

            size="sm"

            variant="outline"

            onClick={() => setShowAddForm((prev) => !prev)}

            className="border-gray-200 text-gray-600 hover:text-gray-900"

          >

            {showAddForm ? (

              <>

                <X className="mr-1 h-4 w-4" />

                Cancel

              </>

            ) : (

              <>

                <Plus className="mr-1 h-4 w-4" />

                Add task manually

              </>

            )}

          </Button>

        </div>

        {/* Add task form */}

        {showAddForm && (

          <form

            onSubmit={handleAddTask}

            className="mb-4 space-y-3 rounded-lg border border-gray-200 bg-white p-5 shadow-sm"

          >

            <Input

              value={addDescription}

              onChange={(e) => setAddDescription(e.target.value)}

              placeholder="Task description"

              className="border-gray-200"

            />

            <div className="flex gap-2">

              <Input

                value={addOwner}

                onChange={(e) => setAddOwner(e.target.value)}

                placeholder="Owner (e.g. John)"

                className="border-gray-200"

              />

              <Input

                type="date"

                value={addDueDate}

                onChange={(e) => setAddDueDate(e.target.value)}

                className="border-gray-200"

              />

            </div>

            {addError && (

              <p className="text-sm text-red-600">{addError}</p>

            )}

            <Button

              type="submit"

              disabled={addLoading}

              className="bg-blue-600 text-white hover:bg-blue-700"

            >

              {addLoading ? (

                <Loader2 className="mr-1 h-4 w-4 animate-spin" />

              ) : (

                <Plus className="mr-1 h-4 w-4" />

              )}

              Add Task

            </Button>

          </form>

        )}

        {tasks.length === 0 && !showAddForm ? (

          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">

            <p className="text-sm text-gray-500">

              No commitments were found in this transcript.

            </p>

          </div>

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

      {/* Transcript */}

      <Collapsible open={showTranscript} onOpenChange={setShowTranscript}>

        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">

          <CollapsibleTrigger className="flex w-full items-center justify-between p-5">

            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">

              <FileText className="h-4 w-4 text-gray-400" />

              Original Transcript

            </div>

            {showTranscript ? (

              <ChevronUp className="h-4 w-4 text-gray-400" />

            ) : (

              <ChevronDown className="h-4 w-4 text-gray-400" />

            )}

          </CollapsibleTrigger>

          <CollapsibleContent>

            <div className="border-t border-gray-100 p-5">

              <pre className="whitespace-pre-wrap break-words font-mono text-sm leading-relaxed text-gray-600">

                {meeting.transcript}

              </pre>

            </div>

          </CollapsibleContent>

        </div>

      </Collapsible>

    </div>

  );

}

export default function MeetingDetailPage({

  params,

}: {

  params: { id: string };

}) {

  return (

    <ProtectedRoute>

      <MeetingDetailContent params={params} />

    </ProtectedRoute>

  );

}
