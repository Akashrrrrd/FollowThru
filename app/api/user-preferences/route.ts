import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { getUserFromRequest } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const userResult = await getUserFromRequest(request);
    if (!userResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();

    const { data: prefs, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userResult.userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows found, which is okay for new users
      throw error;
    }

    return NextResponse.json({
      preferences: prefs || {
        user_id: userResult.userId,
        nudge_channel: 'email',
      },
    });
  } catch (error) {
    console.error('Get preferences error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch preferences' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userResult = await getUserFromRequest(request);
    if (!userResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      // Integration settings
      nudge_channel,
      slack_channel_id,
      slack_team_id,
      teams_webhook_url,
      teams_channel_id,
      zoom_account_id,
      // Phase 5: Email notification toggles per type
      email_notifications_assignment,
      email_notifications_due_soon,
      email_notifications_due_1h,
      email_notifications_overdue,
      email_notifications_escalation,
      email_notifications_status_change,
      email_notifications_completion,
      // Phase 5: In-app notification toggles per type
      inapp_notifications_assignment,
      inapp_notifications_due_soon,
      inapp_notifications_due_1h,
      inapp_notifications_overdue,
      inapp_notifications_escalation,
      inapp_notifications_status_change,
      inapp_notifications_completion,
      // Phase 5: Email digest preferences
      email_digest_enabled,
      email_digest_time,
      // Phase 5: Global notification settings
      notifications_enabled,
      quiet_hours_enabled,
      quiet_hours_start,
      quiet_hours_end,
    } = body;

    const supabase = createServerClient();

    // Check if preference exists
    const { data: existing } = await supabase
      .from('user_preferences')
      .select('id')
      .eq('user_id', userResult.userId)
      .single();

    const updates: Record<string, any> = {
      user_id: userResult.userId,
    };

    // Only add fields that were provided in request body
    if (nudge_channel !== undefined) updates.nudge_channel = nudge_channel;
    if (slack_channel_id !== undefined) updates.slack_channel_id = slack_channel_id;
    if (slack_team_id !== undefined) updates.slack_team_id = slack_team_id;
    if (teams_webhook_url !== undefined) updates.teams_webhook_url = teams_webhook_url;
    if (teams_channel_id !== undefined) updates.teams_channel_id = teams_channel_id;
    if (zoom_account_id !== undefined) updates.zoom_account_id = zoom_account_id;

    // Phase 5 email notification toggles
    if (email_notifications_assignment !== undefined) updates.email_notifications_assignment = email_notifications_assignment;
    if (email_notifications_due_soon !== undefined) updates.email_notifications_due_soon = email_notifications_due_soon;
    if (email_notifications_due_1h !== undefined) updates.email_notifications_due_1h = email_notifications_due_1h;
    if (email_notifications_overdue !== undefined) updates.email_notifications_overdue = email_notifications_overdue;
    if (email_notifications_escalation !== undefined) updates.email_notifications_escalation = email_notifications_escalation;
    if (email_notifications_status_change !== undefined) updates.email_notifications_status_change = email_notifications_status_change;
    if (email_notifications_completion !== undefined) updates.email_notifications_completion = email_notifications_completion;

    // Phase 5 in-app notification toggles
    if (inapp_notifications_assignment !== undefined) updates.inapp_notifications_assignment = inapp_notifications_assignment;
    if (inapp_notifications_due_soon !== undefined) updates.inapp_notifications_due_soon = inapp_notifications_due_soon;
    if (inapp_notifications_due_1h !== undefined) updates.inapp_notifications_due_1h = inapp_notifications_due_1h;
    if (inapp_notifications_overdue !== undefined) updates.inapp_notifications_overdue = inapp_notifications_overdue;
    if (inapp_notifications_escalation !== undefined) updates.inapp_notifications_escalation = inapp_notifications_escalation;
    if (inapp_notifications_status_change !== undefined) updates.inapp_notifications_status_change = inapp_notifications_status_change;
    if (inapp_notifications_completion !== undefined) updates.inapp_notifications_completion = inapp_notifications_completion;

    // Phase 5 email digest preferences
    if (email_digest_enabled !== undefined) updates.email_digest_enabled = email_digest_enabled;
    if (email_digest_time !== undefined) {
      // Validate time format (HH:MM)
      if (!/^\d{2}:\d{2}$/.test(email_digest_time)) {
        return NextResponse.json(
          { error: 'Invalid email_digest_time format. Must be HH:MM (24-hour format)' },
          { status: 400 }
        );
      }
      updates.email_digest_time = email_digest_time;
    }

    // Phase 5 global notification settings
    if (notifications_enabled !== undefined) updates.notifications_enabled = notifications_enabled;
    if (quiet_hours_enabled !== undefined) updates.quiet_hours_enabled = quiet_hours_enabled;
    if (quiet_hours_start !== undefined) {
      if (!/^\d{2}:\d{2}$/.test(quiet_hours_start)) {
        return NextResponse.json(
          { error: 'Invalid quiet_hours_start format. Must be HH:MM (24-hour format)' },
          { status: 400 }
        );
      }
      updates.quiet_hours_start = quiet_hours_start;
    }
    if (quiet_hours_end !== undefined) {
      if (!/^\d{2}:\d{2}$/.test(quiet_hours_end)) {
        return NextResponse.json(
          { error: 'Invalid quiet_hours_end format. Must be HH:MM (24-hour format)' },
          { status: 400 }
        );
      }
      updates.quiet_hours_end = quiet_hours_end;
    }

    let result;

    if (existing) {
      // Update existing
      result = await supabase
        .from('user_preferences')
        .update(updates)
        .eq('user_id', userResult.userId)
        .select()
        .single();
    } else {
      // Insert new
      result = await supabase
        .from('user_preferences')
        .insert(updates)
        .select()
        .single();
    }

    if (result.error) throw result.error;

    return NextResponse.json({
      preferences: result.data,
      message: 'Preferences updated successfully',
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update preferences' },
      { status: 500 },
    );
  }
}
