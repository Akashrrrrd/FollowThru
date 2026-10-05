'use client';

import { useEffect, useState, useMemo } from 'react';

import Link from 'next/link';

import { Plus, ChevronRight, X } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { PageLoading, PageError, EmptyState } from '@/components/page-loading';
import { LoadingTaskCards } from '@/components/loading';

import { ProtectedRoute } from '@/components/protected-route';

import { useAuthFetch } from '@/hooks/use-auth-fetch';
import { useRealtimeMeetings } from '@/hooks/use-realtime-meetings';
import { useTeamContext } from '@/hooks/use-team-context';

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

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

type DateRange = 'today' | 'week' | 'month' | 'custom' | 'all';

interface Filters {
  search: string;
  dateRange: DateRange;
  customDateStart?: string;
  customDateEnd?: string;
  creator: string; // 'all' or user_id
  team: string; // 'all' or team_id
  completionStatus: 'all' | 'not-started' | 'in-progress' | 'completed';
}

function getDateRangeFilter(
  range: DateRange,
  customStart?: string,
  customEnd?: string
): { start: Date; end: Date } | null {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  switch (range) {
    case 'today':
      return { start: today, end: tomorrow };
    case 'week': {
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      return { start: weekStart, end: weekEnd };
    }
    case 'month': {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return { start: monthStart, end: monthEnd };
    }
    case 'custom': {
      if (!customStart || !customEnd) return null;
      return {
        start: new Date(customStart),
        end: new Date(customEnd),
      };
    }
    case 'all':
    default:
      return null;
  }
}

function MeetingsContent() {

  const authFetch = useAuthFetch();
  const { context: teamContext } = useTeamContext();

  const [allMeetings, setAllMeetings] = useState<MeetingWithStats[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<Filters>({
    search: '',
    dateRange: 'all',
    creator: 'all',
    team: 'all',
    completionStatus: 'all',
  });

  /* Subscribe to meeting changes (analysis complete, new meetings, etc.) */
  useRealtimeMeetings((event, meeting) => {
    if (event === 'update') {
      // Meeting updated (e.g., analysis completed) - update existing meeting with new data
      setAllMeetings((prev) =>
        prev.map((m) => (m.id === meeting.id ? { ...m, ...meeting } : m))
      );
    } else if (event === 'delete') {
      // Meeting deleted
      setAllMeetings((prev) => prev.filter((m) => m.id !== meeting.id));
    }
    // For insert, we don't add since we may not have all the stats fields
    // A page refresh or explicit refetch is safer for new meetings
  });

  useEffect(() => {

    authFetch('/api/meetings')

      .then((res) => res.json())

      .then((data) => {

        if (data.error) {

          setError(data.error);

        } else {

          setAllMeetings(data.meetings ?? []);

        }

        setLoading(false);

      })

      .catch(() => {

        setError('Network error. Please try again.');

        setLoading(false);

      });

    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, []);

  // Apply filters
  const meetings = useMemo(() => {
    let filtered = allMeetings;

    // Search by title
    if (filters.search) {
      const q = filters.search.toLowerCase();
      filtered = filtered.filter((m) =>
        m.title.toLowerCase().includes(q)
      );
    }

    // Date range filter
    if (filters.dateRange !== 'all') {
      const range = getDateRangeFilter(
        filters.dateRange,
        filters.customDateStart,
        filters.customDateEnd
      );
      if (range) {
        filtered = filtered.filter((m) => {
          const meetingDate = new Date(m.created_at);
          return meetingDate >= range.start && meetingDate < range.end;
        });
      }
    }

    // Creator filter
    if (filters.creator !== 'all') {
      filtered = filtered.filter((m) => m.user_id === filters.creator);
    }

    // Team filter
    if (filters.team !== 'all') {
      filtered = filtered.filter((m) => m.team_id === filters.team);
    }

    // Completion status filter
    if (filters.completionStatus !== 'all') {
      filtered = filtered.filter((m) => {
        const pct =
          m.total_tasks > 0
            ? Math.round((m.done_tasks / m.total_tasks) * 100)
            : 0;
        
        switch (filters.completionStatus) {
          case 'completed':
            return pct === 100;
          case 'in-progress':
            return pct > 0 && pct < 100;
          case 'not-started':
            return pct === 0;
          default:
            return true;
        }
      });
    }

    return filtered;
  }, [allMeetings, filters]);

  const hasActiveFilters =
    filters.search ||
    filters.dateRange !== 'all' ||
    filters.creator !== 'all' ||
    filters.team !== 'all' ||
    filters.completionStatus !== 'all';

  const uniqueCreators = useMemo(() => {
    return Array.from(new Set(allMeetings.map((m) => m.user_id)));
  }, [allMeetings]);

  const uniqueTeams = useMemo(() => {
    return Array.from(new Set(allMeetings.map((m) => m.team_id).filter((id): id is string => Boolean(id))));
  }, [allMeetings]);

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

      {/* Search and Filter Bar */}
      <div className="mb-6 space-y-4 rounded-lg border border-gray-200 bg-white p-4">
        {/* Search Input */}
        <div>
          <input
            type="text"
            placeholder="Search meetings by title..."
            value={filters.search}
            onChange={(e) =>
              setFilters({ ...filters, search: e.target.value })
            }
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {/* Date Range Filter */}
          <div>
            <label className="text-xs font-medium text-gray-600">Date</label>
            <select
              value={filters.dateRange}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  dateRange: e.target.value as DateRange,
                })
              }
              className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {/* Custom Date Start (shown when custom range is selected) */}
          {filters.dateRange === 'custom' && (
            <div>
              <label className="text-xs font-medium text-gray-600">From</label>
              <input
                type="date"
                value={filters.customDateStart || ''}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    customDateStart: e.target.value,
                  })
                }
                className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
              />
            </div>
          )}

          {/* Custom Date End (shown when custom range is selected) */}
          {filters.dateRange === 'custom' && (
            <div>
              <label className="text-xs font-medium text-gray-600">To</label>
              <input
                type="date"
                value={filters.customDateEnd || ''}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    customDateEnd: e.target.value,
                  })
                }
                className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
              />
            </div>
          )}

          {/* Creator Filter */}
          {uniqueCreators.length > 1 && (
            <div>
              <label className="text-xs font-medium text-gray-600">Creator</label>
              <select
                value={filters.creator}
                onChange={(e) =>
                  setFilters({ ...filters, creator: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
              >
                <option value="all">All Creators</option>
                {uniqueCreators.map((id) => (
                  <option key={id} value={id}>
                    {id.slice(0, 8)}...
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Team Filter */}
          {uniqueTeams.length > 1 && (
            <div>
              <label className="text-xs font-medium text-gray-600">Team</label>
              <select
                value={filters.team}
                onChange={(e) =>
                  setFilters({ ...filters, team: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
              >
                <option value="all">All Teams</option>
                {uniqueTeams.map((id) => (
                  <option key={id} value={id}>
                    {id.slice(0, 8)}...
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Completion Status Filter */}
          <div>
            <label className="text-xs font-medium text-gray-600">Status</label>
            <select
              value={filters.completionStatus}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  completionStatus: e.target.value as 'all' | 'not-started' | 'in-progress' | 'completed',
                })
              }
              className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="not-started">Not Started</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <div className="flex justify-end">
            <Button
              onClick={() =>
                setFilters({
                  search: '',
                  dateRange: 'all',
                  creator: 'all',
                  team: 'all',
                  completionStatus: 'all',
                })
              }
              className="flex items-center gap-1 bg-gray-200 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-300"
            >
              <X className="h-3 w-3" />
              Clear Filters
            </Button>
          </div>
        )}
      </div>

      {loading ? (

        <LoadingTaskCards count={3} />

      ) : error ? (

        <PageError message={error} />

      ) : allMeetings.length === 0 ? (

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

      ) : meetings.length === 0 ? (

        <EmptyState

          title="No meetings match your filters"

          description="Try adjusting your search or filter criteria."

          action={

            <Button

              onClick={() =>

                setFilters({

                  search: '',

                  dateRange: 'all',

                  creator: 'all',

                  team: 'all',

                  completionStatus: 'all',

                })

              }

              className="bg-blue-600 text-white hover:bg-blue-700"

            >

              <X className="mr-1.5 h-4 w-4" />

              Clear All Filters

            </Button>

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

                      {formatDate(meeting.created_at)} at {formatTime(meeting.created_at)}

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
