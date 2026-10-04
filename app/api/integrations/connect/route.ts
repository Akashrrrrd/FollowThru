import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/supabase-server';
import {
  OAUTH_COOKIE,
  OAUTH_COOKIE_PATH,
  PROVIDER_LABELS,
  buildAuthorizeUrl,
  getBaseUrl,
  getProviderCredentials,
  getRedirectUri,
  isProvider,
} from '@/lib/integrations/providers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;

  // Always send the user back to the page with a readable message instead of raw JSON.
  const back = (message: string) =>
    NextResponse.redirect(new URL(`/integrations?error=${encodeURIComponent(message)}`, getBaseUrl(origin)));

  try {
    const user = await getUserFromRequest(request);
    if (!user) return back('Your session expired. Please sign in again.');

    const provider = request.nextUrl.searchParams.get('provider');
    if (!isProvider(provider)) return back('Unknown integration provider.');

    const creds = getProviderCredentials(provider);
    if (!creds) {
      const key = provider.toUpperCase();
      return back(`${PROVIDER_LABELS[provider]} isn't configured. Set ${key}_CLIENT_ID and ${key}_CLIENT_SECRET.`);
    }

    const nonce = randomBytes(24).toString('hex');
    const authUrl = buildAuthorizeUrl(provider, creds.clientId, getRedirectUri(origin), nonce);

    const response = NextResponse.redirect(authUrl);
    // Provider + CSRF nonce. Lax cookies are sent on the top-level redirect back from the provider.
    response.cookies.set(OAUTH_COOKIE, `${provider}.${nonce}`, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: OAUTH_COOKIE_PATH,
      maxAge: 600,
    });
    return response;
  } catch (error) {
    console.error('Connect error:', error);
    return back('Failed to start the connection. Please try again.');
  }
}