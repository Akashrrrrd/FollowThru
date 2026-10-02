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
      nudge_channel,
      slack_channel_id,
      slack_team_id,
      teams_webhook_url,
      teams_channel_id,
      zoom_account_id,
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

    if (nudge_channel) updates.nudge_channel = nudge_channel;
    if (slack_channel_id) updates.slack_channel_id = slack_channel_id;
    if (slack_team_id) updates.slack_team_id = slack_team_id;
    if (teams_webhook_url) updates.teams_webhook_url = teams_webhook_url;
    if (teams_channel_id) updates.teams_channel_id = teams_channel_id;
    if (zoom_account_id) updates.zoom_account_id = zoom_account_id;

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
