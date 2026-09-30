import { NextRequest, NextResponse } from 'next/server';

import { createServerClient, getUserFromRequest } from '@/lib/supabase-server';

import { isValidTransition } from '@/lib/lifecycle';

import { addHistoryEntry } from '@/lib/history';

import type { TaskStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function PATCH(

  req: NextRequest,

  { params }: { params: { id: string } },

) {

  try {

    const user = await getUserFromRequest(req);

    if (!user) {

      return NextResponse.json(

        { error: 'You must be signed in.' },

        { status: 401 },

      );

    }

    const { id } = params;

    const body = await req.json();

    const { status, description, owner, due_date } = body as {

      status?: string;

      description?: string;

      owner?: string;

      due_date?: string | null;

    };

    const supabase = createServerClient();

    // Verify ownership
    const { data: existing, error: checkError } = await supabase
      .from('tasks')
      .select('id, status, description, owner, due_date')
      .eq('id', id)
      .eq('user_id', user.userId)
      .maybeSingle();

    if (checkError || !existing) {
      return NextResponse.json(
        { error: 'Task not found.' },
        { status: 404 },
      );
    }

    const updates: Record<string, unknown> = {};

    if (status !== undefined) {
      const validStatuses: TaskStatus[] = ['open', 'in_progress', 'blocked', 'completed', 'done', 'overdue'];
      
      if (!validStatuses.includes(status as TaskStatus)) {
        return NextResponse.json(
          { error: `Status must be one of: ${validStatuses.join(', ')}` },
          { status: 400 },
        );
      }

      // Check if transition is valid
      let currentStatus = existing.status as TaskStatus;
      // Treat 'overdue' as 'open' for validation purposes
      if (currentStatus === 'overdue') {
        currentStatus = 'open';
      }
      
      if (!isValidTransition(currentStatus, status as TaskStatus)) {
        return NextResponse.json(
          { error: `Cannot transition from "${existing.status}" to "${status}".` },
          { status: 400 },
        );
      }

      updates.status = status;
      
      // If transitioning to 'completed', set completed_at timestamp
      if (status === 'completed') {
        updates.completed_at = new Date().toISOString();
      }

      // Log status change to history
      await addHistoryEntry(
        id,
        user.userId,
        'status_changed',
        existing.status,
        status,
      );
    }

    if (description !== undefined) {

      if (!description.trim()) {

        return NextResponse.json(

          { error: 'Description cannot be empty.' },

          { status: 400 },

        );

      }

      updates.description = description.trim();

      // Log description change to history
      await addHistoryEntry(
        id,
        user.userId,
        'updated',
        existing.description || '',
        description.trim(),
        'Description updated',
      );

    }

    if (owner !== undefined) {

      if (!owner.trim()) {

        return NextResponse.json(

          { error: 'Owner cannot be empty.' },

          { status: 400 },

        );

      }

      updates.owner = owner.trim();

    }

    if (due_date !== undefined) {

      updates.due_date = due_date || null;

      // Log date change to history
      await addHistoryEntry(
        id,
        user.userId,
        'date_changed',
        existing.due_date || null,
        due_date || null,
        'Due date updated',
      );

    }

    if (Object.keys(updates).length === 0) {

      return NextResponse.json(

        { error: 'No fields to update.' },

        { status: 400 },

      );

    }

    const { data: task, error } = await supabase

      .from('tasks')

      .update(updates)

      .eq('id', id)

      .eq('user_id', user.userId)

      .select()

      .single();

    if (error || !task) {

      return NextResponse.json(

        { error: 'Failed to update task.' },

        { status: 500 },

      );

    }

    return NextResponse.json({ task });

  } catch (err) {

    console.error('Task PATCH error:', err);

    return NextResponse.json(

      { error: 'An unexpected error occurred.' },

      { status: 500 },

    );

  }

}
