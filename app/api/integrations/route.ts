import { NextRequest } from 'next/server';
import { createServerClient, getUserFromRequest } from '@/lib/supabase-server';
import { OAuthManager } from '@/lib/integrations/oauth-manager';
import { errorMessage, isProvider } from '@/lib/integrations/providers';
import { successResponse, unauthorized, internalError, validationError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return unauthorized('You must be signed in');
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('integration_clients')
      .select('provider, email, connected_at, last_synced')
      .eq('user_id', user.userId);
    
    if (error) throw error;

    const integrations = (data ?? []).map((row: any) => ({
      provider: row.provider,
      email: row.email ?? undefined,
      lastSync: row.last_synced ?? undefined,
      connectedAt: row.connected_at,
    }));

    return successResponse({ integrations }, { timestamp: true });
  } catch (error) {
    console.error('Get integrations error:', error);
    return internalError(errorMessage(error, 'Failed to fetch integrations'));
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return unauthorized('You must be signed in');
    }

    const body = await request.json().catch(() => ({}));
    const provider = body?.provider;
    
    if (!isProvider(provider)) {
      return validationError('A valid provider is required', { field: 'provider' });
    }

    await new OAuthManager(createServerClient()).disconnect(user.userId, provider);
    return successResponse({ message: 'Integration disconnected successfully' });
  } catch (error) {
    console.error('Delete integration error:', error);
    return internalError(errorMessage(error, 'Failed to delete integration'));
  }
}
