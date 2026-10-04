import { NextRequest, NextResponse } from 'next/server';

import {
  createServerClient,
  getUserFromRequest,
} from '@/lib/supabase-server';
import { getUserOrganizationContext } from '@/lib/organization-context';

export const dynamic = 'force-dynamic';

type TaskRow = {
  id: string;
  meeting_id: string | null;
  description: string | null;
  status: string | null;
  created_at: string | null;
  completed_at: string | null;
};

type MeetingRow = {
  id: string;
  title: string | null;
  created_at: string;
};

type ContinuityRow = {
  id: string;
  parent_task_id: string;
  child_task_id: string;
  event_type: string;
  confidence: string | null;
  source_quote_original: string | null;
  created_at: string | null;
};

function isCompleted(status: string | null) {
  return status === 'completed' || status === 'done';
}

function startOfWeek(date: Date) {
  const value = new Date(date);
  const day = value.getDay();

  // Monday as the first day of the week.
  const diff = day === 0 ? -6 : 1 - day;

  value.setDate(value.getDate() + diff);
  value.setHours(0, 0, 0, 0);

  return value;
}

function formatWeekLabel(date: Date) {
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);

    if (!user) {
      return NextResponse.json(
        { error: 'You must be signed in.' },
        { status: 401 },
      );
    }

    const supabase = createServerClient();

    /*
     * Get the current user's organization.
     */
    const orgContext = await getUserOrganizationContext(
      supabase,
      user.userId,
    );

    if (!orgContext) {
      return NextResponse.json(
        { error: 'User has no organization membership' },
        { status: 403 },
      );
    }

    /*
     * -------------------------------------------------------------
     * 1. Load organization tasks
     * -------------------------------------------------------------
     *
     * Tasks already contain organization_id, so this gives us the
     * organization boundary for the entire history response.
     */
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select(
        'id, meeting_id, description, status, created_at, completed_at',
      )
      .eq('organization_id', orgContext.organizationId);

    if (tasksError) {
      console.error(
        'Accountability history tasks error:',
        tasksError,
      );

      return NextResponse.json(
        { error: 'Failed to load accountability history.' },
        { status: 500 },
      );
    }

    /*
     * -------------------------------------------------------------
     * 2. Load organization meetings
     * -------------------------------------------------------------
     */
    const { data: meetings, error: meetingsError } = await supabase
      .from('meetings')
      .select('id, title, created_at')
      .eq('organization_id', orgContext.organizationId)
      .order('created_at', { ascending: false });

    if (meetingsError) {
      console.error(
        'Accountability history meetings error:',
        meetingsError,
      );

      return NextResponse.json(
        { error: 'Failed to load meeting history.' },
        { status: 500 },
      );
    }

    /*
     * -------------------------------------------------------------
     * 3. Load continuity events
     * -------------------------------------------------------------
     *
     * IMPORTANT:
     * commitment_continuity_events does NOT have organization_id
     * in the current production database.
     *
     * Therefore we intentionally DO NOT do:
     *
     * .eq('organization_id', orgContext.organizationId)
     *
     * Instead, we load the events and later keep only events whose
     * parent or child task belongs to the current organization.
     */
    const { data: continuityEvents, error: continuityError } =
      await supabase
        .from('commitment_continuity_events')
        .select(
          `
            id,
            parent_task_id,
            child_task_id,
            event_type,
            confidence,
            source_quote_original,
            created_at
          `,
        )
        .order('created_at', { ascending: false })
        .limit(200);

    if (continuityError) {
      console.error(
        'Accountability history continuity error:',
        continuityError,
      );

      return NextResponse.json(
        { error: 'Failed to load commitment continuity.' },
        { status: 500 },
      );
    }

    const taskRows = (tasks ?? []) as TaskRow[];
    const meetingRows = (meetings ?? []) as MeetingRow[];
    const allContinuityRows =
      (continuityEvents ?? []) as ContinuityRow[];

    /*
     * -------------------------------------------------------------
     * Organization-safe task lookup
     * -------------------------------------------------------------
     */
    const taskById = new Map(
      taskRows.map((task) => [task.id, task]),
    );

    const meetingById = new Map(
      meetingRows.map((meeting) => [meeting.id, meeting]),
    );

    /*
     * Only keep continuity events where at least one side of the
     * relationship belongs to an organization task.
     *
     * This prevents history from another organization from being
     * returned even though continuity_events itself has no
     * organization_id column.
     */
    const continuityRows = allContinuityRows.filter((event) => {
      return (
        taskById.has(event.parent_task_id) ||
        taskById.has(event.child_task_id)
      );
    });

    /*
     * -------------------------------------------------------------
     * 4. Count continuity events by meeting
     * -------------------------------------------------------------
     */
    const continuityByMeeting = new Map<string, number>();

    for (const event of continuityRows) {
      const parentTask = taskById.get(event.parent_task_id);
      const childTask = taskById.get(event.child_task_id);

      const meetingId =
        childTask?.meeting_id ?? parentTask?.meeting_id;

      if (!meetingId) {
        continue;
      }

      continuityByMeeting.set(
        meetingId,
        (continuityByMeeting.get(meetingId) ?? 0) + 1,
      );
    }

    /*
     * -------------------------------------------------------------
     * 5. Group tasks by meeting
     * -------------------------------------------------------------
     */
    const tasksByMeeting = new Map<string, TaskRow[]>();

    for (const task of taskRows) {
      if (!task.meeting_id) {
        continue;
      }

      const existing = tasksByMeeting.get(task.meeting_id) ?? [];

      existing.push(task);

      tasksByMeeting.set(task.meeting_id, existing);
    }

    /*
     * -------------------------------------------------------------
     * 6. Build meeting history
     * -------------------------------------------------------------
     */
    const meetingsHistory = meetingRows
      .filter((meeting) => tasksByMeeting.has(meeting.id))
      .map((meeting) => {
        const meetingTasks =
          tasksByMeeting.get(meeting.id) ?? [];

        const completed = meetingTasks.filter((task) =>
          isCompleted(task.status),
        ).length;

        const inProgress = meetingTasks.filter(
          (task) => task.status === 'in_progress',
        ).length;

        const blocked = meetingTasks.filter(
          (task) => task.status === 'blocked',
        ).length;

        const overdue = meetingTasks.filter(
          (task) => task.status === 'overdue',
        ).length;

        const open = meetingTasks.filter(
          (task) =>
            task.status === 'open' ||
            task.status === 'overdue' ||
            task.status === null,
        ).length;

        return {
          meetingId: meeting.id,
          title: meeting.title ?? 'Untitled meeting',
          createdAt: meeting.created_at,
          total: meetingTasks.length,
          completed,
          open,
          inProgress,
          blocked,
          overdue,
          continuity:
            continuityByMeeting.get(meeting.id) ?? 0,
        };
      });

    /*
     * -------------------------------------------------------------
     * 7. Build six-week follow-through trend
     * -------------------------------------------------------------
     */
    const now = new Date();
    const currentWeek = startOfWeek(now);

    const weeklyBuckets = Array.from(
      { length: 6 },
      (_, index) => {
        const date = new Date(currentWeek);

        date.setDate(
          currentWeek.getDate() - (5 - index) * 7,
        );

        return {
          start: date,
          label: formatWeekLabel(date),
          total: 0,
          completed: 0,
        };
      },
    );

    for (const task of taskRows) {
      if (!task.created_at) {
        continue;
      }

      const created = new Date(task.created_at);
      const taskWeek = startOfWeek(created);

      const bucket = weeklyBuckets.find(
        (item) =>
          item.start.getTime() === taskWeek.getTime(),
      );

      if (!bucket) {
        continue;
      }

      bucket.total += 1;

      if (isCompleted(task.status)) {
        bucket.completed += 1;
      }
    }

    const weeklyTrend = weeklyBuckets.map((bucket) => ({
      label: bucket.label,
      total: bucket.total,
      completed: bucket.completed,
      rate:
        bucket.total > 0
          ? Math.round(
              (bucket.completed / bucket.total) * 100,
            )
          : 0,
    }));

    /*
     * -------------------------------------------------------------
     * 8. Build continuity history
     * -------------------------------------------------------------
     */
    const historyEvents = continuityRows.map((event) => {
      const parentTask = taskById.get(
        event.parent_task_id,
      );

      const childTask = taskById.get(
        event.child_task_id,
      );

      const parentMeeting = parentTask?.meeting_id
        ? meetingById.get(parentTask.meeting_id)
        : undefined;

      const childMeeting = childTask?.meeting_id
        ? meetingById.get(childTask.meeting_id)
        : undefined;

      return {
        id: event.id,
        eventType: event.event_type,
        confidence: event.confidence,
        sourceQuoteOriginal:
          event.source_quote_original,
        createdAt: event.created_at,

        parentTaskId: event.parent_task_id,
        childTaskId: event.child_task_id,

        parentDescription:
          parentTask?.description ?? null,

        childDescription:
          childTask?.description ?? null,

        parentMeetingId:
          parentTask?.meeting_id ?? null,

        childMeetingId:
          childTask?.meeting_id ?? null,

        parentMeetingTitle:
          parentMeeting?.title ?? null,

        childMeetingTitle:
          childMeeting?.title ?? null,
      };
    });

    /*
     * -------------------------------------------------------------
     * 9. Return complete history payload
     * -------------------------------------------------------------
     */
    return NextResponse.json({
      meetings: meetingsHistory,
      continuityEvents: historyEvents,
      weeklyTrend,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error(
      'Accountability history GET error:',
      err,
    );

    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 },
    );
  }
}