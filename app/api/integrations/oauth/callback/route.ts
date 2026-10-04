import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUserFromRequest } from '@/lib/supabase-server';
import { OAuthManager } from '@/lib/integrations/oauth-manager';
import {
  OAUTH_COOKIE,
  OAUTH_COOKIE_PATH,
  PROVIDER_LABELS,
  errorMessage,
  exchangeCodeForToken,
  getBaseUrl,
  getProviderCredentials,
  getRedirectUri,
  isProvider,
} from '@/lib/integrations/providers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;

  const finish = (query: string) => {
    const res = NextResponse.redirect(new URL(`/integrations?${query}`, getBaseUrl(origin)));
    res.cookies.set(OAUTH_COOKIE, '', { path: OAUTH_COOKIE_PATH, maxAge: 0 }); // one-time use
    return res;
  };
  const fail = (message: string) => finish(`error=${encodeURIComponent(message.slice(0, 200))}`);

  try {
    const user = await getUserFromRequest(request);
    if (!user) return fail('Your session expired. Please sign in and try again.');

    // Provider + nonce were stored by /connect (the redirect URI itself carries no provider)
    const cookie = request.cookies.get(OAUTH_COOKIE)?.value ?? '';
    const dot = cookie.indexOf('.');
    const provider = dot > 0 ? cookie.slice(0, dot) : '';
    const nonce = dot > 0 ? cookie.slice(dot + 1) : '';
    if (!isProvider(provider) || !nonce) {
      return fail('The connection request expired. Please try connecting again.');
    }

    const params = request.nextUrl.searchParams;
    const label = PROVIDER_LABELS[provider];

    const providerError = params.get('error');
    if (providerError) {
      return fail(`${label} authorization was not completed: ${params.get('error_description') || providerError}`);
    }

    // CSRF check. ClickUp doesn't reliably echo `state`; the cookie still binds the flow to this browser.
    const state = params.get('state');
    if (state ? state !== nonce : provider !== 'clickup') {
      return fail('Invalid OAuth state. Please try connecting again.');
    }

    const code = params.get('code');
    if (!code) return fail(`${label} did not return an authorization code.`);

    const creds = getProviderCredentials(provider);
    if (!creds) return fail(`${label} isn't configured on the server.`);

    const token = await exchangeCodeForToken(provider, code, getRedirectUri(origin), creds);
    if (!token.accessToken) throw new Error(`${label} did not return an access token.`);

    await new OAuthManager(createServerClient()).saveCredentials(user.userId, provider, token);

    return finish(`success=${provider}`);
  } catch (error) {
    console.error('OAuth callback error:', error);
    return fail(errorMessage(error, 'OAuth callback failed'));
  }
}