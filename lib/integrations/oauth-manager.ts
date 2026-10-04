import {
  getProviderCredentials,
  isProvider,
  refreshAccessToken,
  type Provider,
  type TokenResult,
} from './providers';

export interface IntegrationRow {
  id: string;
  user_id: string;
  provider: string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  email?: string | null;
  metadata?: Record<string, any> | null;
  last_synced?: string | null;
}

const REFRESH_BUFFER_MS = 60_000;

export class OAuthManager {
  private supabase: any;

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  /** Save (or replace) the connection for a user+provider. */
  async saveCredentials(userId: string, provider: Provider, token: TokenResult): Promise<void> {
    const { error } = await this.supabase.from('integration_clients').upsert(
      {
        user_id: userId,
        provider,
        access_token: token.accessToken,
        refresh_token: token.refreshToken,
        expires_at: token.expiresAt ? token.expiresAt.toISOString() : null,
        email: token.email,
        metadata: token.metadata,
        connected_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,provider' },
    );
    if (error) throw error;
  }

  async getCredentials(userId: string, provider: string): Promise<IntegrationRow | null> {
    const { data, error } = await this.supabase
      .from('integration_clients')
      .select('id, user_id, provider, access_token, refresh_token, expires_at, email, metadata, last_synced')
      .eq('user_id', userId)
      .eq('provider', provider)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  /** Returns a usable access token, refreshing (and persisting) it when it is about to expire. */
  async getValidAccessToken(integration: IntegrationRow): Promise<string> {
    if (!integration.access_token) {
      throw new Error(`No access token stored for ${integration.provider}. Please reconnect.`);
    }

    const expiresAt = integration.expires_at ? new Date(integration.expires_at) : null;
    if (!expiresAt || expiresAt.getTime() - Date.now() > REFRESH_BUFFER_MS) {
      return integration.access_token;
    }

    if (!isProvider(integration.provider)) throw new Error(`Unknown provider: ${integration.provider}`);
    if (!integration.refresh_token) {
      throw new Error(`${integration.provider} token expired and no refresh token is available. Please reconnect.`);
    }

    const creds = getProviderCredentials(integration.provider);
    if (!creds) throw new Error(`${integration.provider} OAuth credentials are not configured.`);

    const refreshed = await refreshAccessToken(integration.provider, integration.refresh_token, creds);

    const update: Record<string, unknown> = {
      access_token: refreshed.accessToken,
      expires_at: refreshed.expiresAt ? refreshed.expiresAt.toISOString() : null,
    };
    // Jira/Teams rotate refresh tokens: the old one stops working, so always persist the new one.
    if (refreshed.refreshToken) update.refresh_token = refreshed.refreshToken;

    const { error } = await this.supabase.from('integration_clients').update(update).eq('id', integration.id);
    if (error) throw error;

    return refreshed.accessToken;
  }

  async disconnect(userId: string, provider: string): Promise<void> {
    const { error } = await this.supabase
      .from('integration_clients')
      .delete()
      .eq('user_id', userId)
      .eq('provider', provider);
    if (error) throw error;
  }
}