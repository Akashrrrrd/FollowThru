import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { getUserFromRequest } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const userResult = await getUserFromRequest(request);
    if (!userResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const provider = searchParams.get('provider');
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(
        new URL(
          `/integrations?error=${encodeURIComponent(
            `${provider} OAuth failed: ${error}`,
          )}`,
          request.url,
        ),
      );
    }

    if (!provider || !code) {
      return NextResponse.redirect(
        new URL('/integrations?error=Missing provider or code', request.url),
      );
    }

    const supabase = createServerClient();

    // Exchange code for access token (provider-specific)
    let accessToken: string | null = null;
    let refreshToken: string | null = null;
    let expiresAt: Date | null = null;
    let userEmail: string | null = null;

    if (provider === 'jira') {
      // Jira OAuth token exchange
      const tokenRes = await fetch('https://auth.atlassian.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          client_id: process.env.JIRA_CLIENT_ID,
          client_secret: process.env.JIRA_CLIENT_SECRET,
          code,
          redirect_uri: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/integrations/oauth/callback?provider=jira`,
        }),
      });

      if (!tokenRes.ok) throw new Error('Jira token exchange failed');

      const tokenData = await tokenRes.json();
      accessToken = tokenData.access_token;
      refreshToken = tokenData.refresh_token;

      if (tokenData.expires_in) {
        expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
      }

      // Get user info from Jira
      const userRes = await fetch('https://api.atlassian.com/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (userRes.ok) {
        const userData = await userRes.json();
        userEmail = userData.email;
      }
    }

    // Save integration credentials
    if (accessToken) {
      const { error: saveError } = await supabase.from('integration_clients').insert({
        user_id: userResult.userId,
        provider,
        client_id: process.env[`${provider.toUpperCase()}_CLIENT_ID`] || '',
        client_secret: process.env[`${provider.toUpperCase()}_CLIENT_SECRET`] || '',
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt,
        connected_at: new Date(),
      });

      if (saveError) throw saveError;

      return NextResponse.redirect(
        new URL(
          `/integrations?success=${provider}`,
          request.url,
        ),
      );
    }

    throw new Error('Failed to obtain access token');
  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(
      new URL(
        `/integrations?error=${encodeURIComponent(
          error instanceof Error ? error.message : 'OAuth callback failed',
        )}`,
        request.url,
      ),
    );
  }
}
