export const PROVIDERS = ['jira', 'asana', 'monday', 'clickup', 'slack', 'teams'] as const;
export type Provider = (typeof PROVIDERS)[number];

/** Providers that sync tasks in both directions (Slack/Teams are notification-only). */
export const SYNC_PROVIDERS = ['jira', 'asana'] as const;
export type SyncProvider = (typeof SYNC_PROVIDERS)[number];

export const PROVIDER_LABELS: Record<Provider, string> = {
  jira: 'Jira',
  asana: 'Asana',
  monday: 'Monday.com',
  clickup: 'ClickUp',
  slack: 'Slack',
  teams: 'Microsoft Teams',
};

export const OAUTH_COOKIE = 'ft_oauth';
export const OAUTH_COOKIE_PATH = '/api/integrations/oauth';
export const MONDAY_API_VERSION = '2025-04';

export const isProvider = (v: unknown): v is Provider =>
  typeof v === 'string' && (PROVIDERS as readonly string[]).includes(v);

export const isSyncProvider = (v: unknown): v is SyncProvider =>
  typeof v === 'string' && (SYNC_PROVIDERS as readonly string[]).includes(v);

export function errorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err) return String((err as any).message);
  return fallback;
}

// ---------------------------------------------------------------------------
// URLs / credentials
// ---------------------------------------------------------------------------

export function getBaseUrl(origin?: string): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || origin || 'http://localhost:3000';
  return raw.replace(/\/+$/, '');
}

/**
 * ONE redirect URI for every provider. Register exactly this URL in each
 * provider's developer console. Provider identity travels in the state cookie.
 */
export function getRedirectUri(origin?: string): string {
  return `${getBaseUrl(origin)}/api/integrations/oauth/callback`;
}

export interface ProviderCredentials {
  clientId: string;
  clientSecret: string;
}

export function getProviderCredentials(provider: Provider): ProviderCredentials | null {
  const key = provider.toUpperCase();
  const clientId = process.env[`${key}_CLIENT_ID`];
  const clientSecret = process.env[`${key}_CLIENT_SECRET`];
  if (!clientId || !clientSecret) return null;
  if (clientId.startsWith('your_') || clientSecret.startsWith('your_')) return null;
  return { clientId, clientSecret };
}

function scopeFor(provider: Provider): string {
  switch (provider) {
    case 'jira':
      return process.env.JIRA_SCOPE || 'read:jira-work write:jira-work read:me offline_access';
    case 'monday':
      return process.env.MONDAY_SCOPE || 'me:read boards:read boards:write';
    case 'slack':
      return process.env.SLACK_SCOPE || 'chat:write commands incoming-webhook users:read users:read.email';
    case 'teams':
      return process.env.TEAMS_SCOPE || 'offline_access User.Read';
    default:
      return '';
  }
}

const teamsTenant = () => process.env.TEAMS_TENANT || 'common';

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

export async function requestJson<T = any>(url: string, init: RequestInit, label: string): Promise<T> {
  const res = await fetch(url, init);
  const text = await res.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }
  if (!res.ok) {
    const detail =
      data?.error_description ||
      data?.errors?.[0]?.message ||
      data?.message ||
      data?.err ||
      data?.error ||
      data?.raw ||
      res.statusText;
    const msg = typeof detail === 'string' ? detail : JSON.stringify(detail);
    throw new Error(`${label} failed (${res.status}): ${msg.slice(0, 200)}`);
  }
  return data as T;
}

export const jsonInit = (body: unknown, headers: Record<string, string> = {}): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify(body),
});

export const formInit = (params: Record<string, string>): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams(params).toString(),
});

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

async function optional<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch (err) {
    console.warn('[integrations] optional lookup failed:', errorMessage(err));
    return null;
  }
}

const expiresIn = (seconds?: number): Date | null =>
  seconds ? new Date(Date.now() + Number(seconds) * 1000) : null;

// ---------------------------------------------------------------------------
// Authorize URL
// ---------------------------------------------------------------------------

export function buildAuthorizeUrl(provider: Provider, clientId: string, redirectUri: string, state: string): string {
  const q = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, state });

  switch (provider) {
    case 'jira':
      q.set('audience', 'api.atlassian.com');
      q.set('scope', scopeFor('jira'));
      q.set('response_type', 'code');
      q.set('prompt', 'consent');
      return `https://auth.atlassian.com/authorize?${q}`;

    case 'asana':
      q.set('response_type', 'code');
      return `https://app.asana.com/-/oauth_authorize?${q}`;

    case 'monday':
      q.set('scope', scopeFor('monday'));
      return `https://auth.monday.com/oauth2/authorize?${q}`;

    case 'clickup':
      return `https://app.clickup.com/api?${q}`;

    case 'slack':
      q.set('scope', scopeFor('slack'));
      return `https://slack.com/oauth/v2/authorize?${q}`;

    case 'teams':
      q.set('response_type', 'code');
      q.set('response_mode', 'query');
      q.set('scope', scopeFor('teams'));
      return `https://login.microsoftonline.com/${teamsTenant()}/oauth2/v2.0/authorize?${q}`;
  }
}

// ---------------------------------------------------------------------------
// Code -> token
// ---------------------------------------------------------------------------

export interface TokenResult {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  email: string | null;
  metadata: Record<string, unknown>;
}

export async function exchangeCodeForToken(
  provider: Provider,
  code: string,
  redirectUri: string,
  creds: ProviderCredentials,
): Promise<TokenResult> {
  const client_id = creds.clientId;
  const client_secret = creds.clientSecret;

  switch (provider) {
    case 'jira': {
      const t = await requestJson(
        'https://auth.atlassian.com/oauth/token',
        jsonInit({ grant_type: 'authorization_code', client_id, client_secret, code, redirect_uri: redirectUri }),
        'Jira token exchange',
      );
      const headers = bearer(t.access_token);
      const sites = await requestJson<any[]>(
        'https://api.atlassian.com/oauth/token/accessible-resources',
        { headers },
        'Jira site lookup',
      );
      if (!sites?.length) throw new Error('No accessible Jira site found for this Atlassian account.');
      const me = await optional(requestJson<any>('https://api.atlassian.com/me', { headers }, 'Jira profile'));
      return {
        accessToken: t.access_token,
        refreshToken: t.refresh_token ?? null,
        expiresAt: expiresIn(t.expires_in),
        email: me?.email ?? null,
        metadata: { cloudId: sites[0].id, siteUrl: sites[0].url, siteName: sites[0].name },
      };
    }

    case 'asana': {
      const t = await requestJson(
        'https://app.asana.com/-/oauth_token',
        formInit({ grant_type: 'authorization_code', client_id, client_secret, redirect_uri: redirectUri, code }),
        'Asana token exchange',
      );
      return {
        accessToken: t.access_token,
        refreshToken: t.refresh_token ?? null,
        expiresAt: expiresIn(t.expires_in ?? 3600),
        email: t.data?.email ?? null,
        metadata: { asanaUserId: t.data?.gid ?? t.data?.id ?? null },
      };
    }

    case 'monday': {
      const t = await requestJson(
        'https://auth.monday.com/oauth2/token',
        formInit({ grant_type: 'authorization_code', client_id, client_secret, code, redirect_uri: redirectUri }),
        'Monday token exchange',
      );
      const me = await optional(
        requestJson<any>(
          'https://api.monday.com/v2',
          jsonInit({ query: '{ me { email name } }' }, { Authorization: t.access_token, 'API-Version': MONDAY_API_VERSION }),
          'Monday profile',
        ),
      );
      return {
        accessToken: t.access_token,
        refreshToken: t.refresh_token ?? null,
        expiresAt: expiresIn(t.expires_in),
        email: me?.data?.me?.email ?? null,
        metadata: {},
      };
    }

    case 'clickup': {
      const t = await requestJson(
        'https://api.clickup.com/api/v2/oauth/token',
        jsonInit({ client_id, client_secret, code }),
        'ClickUp token exchange',
      );
      const me = await optional(
        requestJson<any>('https://api.clickup.com/api/v2/user', { headers: { Authorization: t.access_token } }, 'ClickUp profile'),
      );
      return {
        accessToken: t.access_token,
        refreshToken: null, // ClickUp tokens don't expire
        expiresAt: null,
        email: me?.user?.email ?? null,
        metadata: { userId: me?.user?.id ?? null },
      };
    }

    case 'slack': {
      const t = await requestJson(
        'https://slack.com/api/oauth.v2.access',
        formInit({ client_id, client_secret, code, redirect_uri: redirectUri }),
        'Slack token exchange',
      );
      if (!t.ok) throw new Error(`Slack OAuth failed: ${t.error}`);
      let email: string | null = null;
      if (t.authed_user?.id) {
        const u = await optional(
          requestJson<any>(
            `https://slack.com/api/users.info?user=${encodeURIComponent(t.authed_user.id)}`,
            { headers: bearer(t.access_token) },
            'Slack profile',
          ),
        );
        email = u?.user?.profile?.email ?? null;
      }
      return {
        accessToken: t.access_token,
        refreshToken: t.refresh_token ?? null,
        expiresAt: expiresIn(t.expires_in),
        email,
        metadata: {
          teamId: t.team?.id ?? null,
          teamName: t.team?.name ?? null,
          botUserId: t.bot_user_id ?? null,
          slackUserId: t.authed_user?.id ?? null,
          webhookUrl: t.incoming_webhook?.url ?? null,
          channel: t.incoming_webhook?.channel ?? null,
        },
      };
    }

    case 'teams': {
      const t = await requestJson(
        `https://login.microsoftonline.com/${teamsTenant()}/oauth2/v2.0/token`,
        formInit({
          client_id,
          client_secret,
          code,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          scope: scopeFor('teams'),
        }),
        'Teams token exchange',
      );
      const me = await optional(
        requestJson<any>('https://graph.microsoft.com/v1.0/me', { headers: bearer(t.access_token) }, 'Teams profile'),
      );
      return {
        accessToken: t.access_token,
        refreshToken: t.refresh_token ?? null,
        expiresAt: expiresIn(t.expires_in),
        email: me?.mail ?? me?.userPrincipalName ?? null,
        metadata: {},
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Refresh
// ---------------------------------------------------------------------------

export interface RefreshResult {
  accessToken: string;
  /** Present when the provider rotates refresh tokens (Jira, Teams, ...). Must be persisted. */
  refreshToken: string | null;
  expiresAt: Date | null;
}

export async function refreshAccessToken(
  provider: Provider,
  refreshToken: string,
  creds: ProviderCredentials,
): Promise<RefreshResult> {
  const client_id = creds.clientId;
  const client_secret = creds.clientSecret;
  let t: any;

  switch (provider) {
    case 'jira':
      t = await requestJson(
        'https://auth.atlassian.com/oauth/token',
        jsonInit({ grant_type: 'refresh_token', client_id, client_secret, refresh_token: refreshToken }),
        'Jira token refresh',
      );
      break;
    case 'asana':
      t = await requestJson(
        'https://app.asana.com/-/oauth_token',
        formInit({ grant_type: 'refresh_token', client_id, client_secret, refresh_token: refreshToken }),
        'Asana token refresh',
      );
      break;
    case 'monday':
      t = await requestJson(
        'https://auth.monday.com/oauth2/token',
        formInit({ grant_type: 'refresh_token', client_id, client_secret, refresh_token: refreshToken }),
        'Monday token refresh',
      );
      break;
    case 'slack':
      t = await requestJson(
        'https://slack.com/api/oauth.v2.access',
        formInit({ grant_type: 'refresh_token', client_id, client_secret, refresh_token: refreshToken }),
        'Slack token refresh',
      );
      if (!t.ok) throw new Error(`Slack token refresh failed: ${t.error}`);
      break;
    case 'teams':
      t = await requestJson(
        `https://login.microsoftonline.com/${teamsTenant()}/oauth2/v2.0/token`,
        formInit({
          grant_type: 'refresh_token',
          client_id,
          client_secret,
          refresh_token: refreshToken,
          scope: scopeFor('teams'),
        }),
        'Teams token refresh',
      );
      break;
    case 'clickup':
      throw new Error('ClickUp tokens do not expire and cannot be refreshed.');
  }

  return {
    accessToken: t.access_token,
    refreshToken: t.refresh_token ?? null,
    expiresAt: expiresIn(t.expires_in ?? 3600),
  };
}