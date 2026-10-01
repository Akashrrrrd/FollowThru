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

    // Get all connected integrations for this user
    const { data: integrations, error } = await supabase
      .from('integration_clients')
      .select('provider, connected_at, expires_at, last_synced')
      .eq('user_id', userResult.userId);

    if (error) throw error;

    return NextResponse.json({ integrations: integrations || [] });
  } catch (error) {
    console.error('Get integrations error:', error);
    return NextResponse.json({ error: 'Failed to fetch integrations' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userResult = await getUserFromRequest(request);
    if (!userResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { provider } = body;

    if (!provider) {
      return NextResponse.json({ error: 'provider required' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Delete the integration
    const { error } = await supabase
      .from('integration_clients')
      .delete()
      .eq('user_id', userResult.userId)
      .eq('provider', provider);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete integration error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete integration' },
      { status: 500 },
    );
  }
}
