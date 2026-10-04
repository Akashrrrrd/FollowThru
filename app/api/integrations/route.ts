import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUserFromRequest } from '@/lib/supabase-server';
import { OAuthManager } from '@/lib/integrations/oauth-manager';
import { errorMessage, isProvider } from '@/lib/integrations/providers';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET(request: NextRequest) {
  try {
    const userResult = await getUserFromRequest(request);
    if (!userResult) {
      return NextResponse.json({ error: 'Unauthorized', success: false }, { status: 401, headers: NO_STORE });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('integration_clients')
      .select('provider, email, connected_at, last_synced') // never return tokens
      .eq('user_id', userResult.userId);
    if (error) throw error;

    // Shape matches what the page reads (camelCase, email included)
    const integrations = (data ?? []).map((row: any) => ({
      provider: row.provider,
      email: row.email ?? undefined,
      lastSync: row.last_synced ?? undefined,
      connectedAt: row.connected_at,
    }));

    return NextResponse.json({ success: true, integrations }, { headers: NO_STORE });
  } catch (error) {
    console.error('Get integrations error:', error);
    return NextResponse.json(
      { error: errorMessage(error, 'Failed to fetch integrations'), success: false },
      { status: 500, headers: NO_STORE },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userResult = await getUserFromRequest(request);
    if (!userResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const provider = body?.provider;
    if (!isProvider(provider)) {
      return NextResponse.json({ error: 'A valid provider is required' }, { status: 400 });
    }

    await new OAuthManager(createServerClient()).disconnect(userResult.userId, provider);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete integration error:', error);
    return NextResponse.json({ error: errorMessage(error, 'Failed to delete integration') }, { status: 500 });
  }
}