'use client';

import { useEffect, useState } from 'react';

import Link from 'next/link';

import { Plus, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { PageLoading, PageError, EmptyState } from '@/components/page-loading';
import { LoadingTaskCards } from '@/components/loading';

import { ProtectedRoute } from '@/components/protected-route';

import { useAuthFetch } from '@/hooks/use-auth-fetch';

import type { MeetingWithStats } from '@/lib/types';

function formatDate(dateStr: string): string {

  const date = new Date(dateStr);

  if (isNaN(date.getTime())) return dateStr;

  return date.toLocaleDateString('en-US', {

    month: 'short',

    day: 'numeric',

    year: 'numeric',

  });

}

function MeetingsContent() {

  const authFetch = useAuthFetch();

  const [meetings, setMeetings] = useState<MeetingWithStats[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {

    authFetch('/api/meetings')

      .then((res) => res.json())

      .then((data) => {

        if (data.error) {

          setError(data.error);

        } else {

          setMeetings(data.meetings ?? []);

        }

        setLoading(false);

      })

      .catch(() => {

        setError('Network error. Please try again.');

        setLoading(false);

      });

    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, []);

  return (

    <div className="mx-auto max-w-6xl px-4 py-8">

      <div className="mb-6 flex items-center justify-between">

        <div>

          <h1 className="text-2xl font-bold text-gray-900">Meeting History</h1>

          <p className="mt-1 text-sm text-gray-500">

            Past meetings and their task completion.

          </p>

        </div>

        <Link href="/new">

          <Button className="bg-blue-600 text-white hover:bg-blue-700">

            <Plus className="mr-1.5 h-4 w-4" />

            New Meeting

          </Button>

        </Link>

      </div>

      {loading ? (

        <LoadingTaskCards count={3} />

      ) : error ? (

        <PageError message={error} />

      ) : meetings.length === 0 ? (

        <EmptyState

          title="No meetings yet"

          description="Process your first meeting transcript to get started."

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

        <div className="space-y-3">

          {meetings.map((meeting) => {

            const pct =

              meeting.total_tasks > 0

                ? Math.round((meeting.done_tasks / meeting.total_tasks) * 100)

                : 0;

            return (

              <Link key={meeting.id} href={`/meetings/${meeting.id}`}>

                <div className="group flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-blue-200 hover:shadow-md">

                  <div className="flex-1">

                    <h3 className="font-semibold text-gray-900 group-hover:text-blue-600">

                      {meeting.title}

                    </h3>

                    <p className="mt-0.5 text-xs text-gray-500">

                      {formatDate(meeting.created_at)}

                    </p>

                  </div>

                  <div className="hidden w-48 sm:block">

                    <div className="mb-1 flex items-center justify-between text-xs text-gray-500">

                      <span>

                        {meeting.done_tasks}/{meeting.total_tasks} done

                      </span>

                      <span>{pct}%</span>

                    </div>

                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">

                      <div

                        className="h-full rounded-full bg-blue-600 transition-all"

                        style={{ width: `${pct}%` }}

                      />

                    </div>

                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-500 sm:hidden">

                    {meeting.done_tasks}/{meeting.total_tasks}

                  </div>

                  <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-blue-500" />

                </div>

              </Link>

            );

          })}

        </div>

      )}

    </div>

  );

}

export default function MeetingsPage() {

  return (

    <ProtectedRoute>

      <MeetingsContent />

    </ProtectedRoute>

  );

}
