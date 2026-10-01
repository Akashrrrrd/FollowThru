import { createClient } from '@supabase/supabase-js';

interface OAuthConfig {
  provider: 'jira' | 'asana' | 'monday' | 'clickup' | 'slack' | 'teams' | 'zoom';
  clientId: string;
  clientSecret: string;
}

export class OAuthManager {
  private supabase: any;

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  /**
   * Save OAuth credentials
   */
  async saveCredentials(
    userId: string,
    config: OAuthConfig,
    accessToken: string,
    refreshToken?: string,
    expiresAt?: Date,
  ): Promise<void> {
    await this.supabase.from('integration_clients').insert({
      user_id: userId,
      provider: config.provider,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt,
      connected_at: new Date(),
    });
  }

  /**
   * Get OAuth credentials
   */
  async getCredentials(userId: string, provider: string): Promise<any> {
    const { data } = await this.supabase
      .from('integration_clients')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', provider)
      .single();

    return data;
  }

  /**
   * Check if token is expired
   */
  async refreshTokenIfNeeded(credentials: any): Promise<string> {
    if (!credentials.expires_at || new Date(credentials.expires_at) > new Date()) {
      return credentials.access_token;
    }

    // Token expired, would call refresh endpoint here
    // This is placeholder for actual OAuth refresh logic
    return credentials.access_token;
  }

  /**
   * Disconnect integration
   */
  async disconnect(userId: string, provider: string): Promise<void> {
    await this.supabase
      .from('integration_clients')
      .delete()
      .eq('user_id', userId)
      .eq('provider', provider);
  }
}
