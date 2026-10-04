import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Creates a Supabase client that runs with the service role key, bypassing RLS.
 * Use this only in server routes that have already verified the user's identity
 * via getUserFromRequest() and that filter by user_id explicitly.
 */
export function createServerClient(): SupabaseClient {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Creates a Supabase client scoped to a specific user's auth token, so RLS
 * policies enforce ownership automatically. Prefer this over the service
 * role client whenever the caller has a valid JWT.
 */
export function createUserClient(authToken: string): SupabaseClient {
  return createClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${authToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

/**
 * Extracts the user's session from Supabase auth cookies.
 * Supabase client stores session tokens in cookies when persistSession is enabled.
 * This function reads those cookies and validates the session server-side.
 * 
 * Returns the user ID and access token if a valid session is found.
 * Returns null if no valid session or cookies are present.
 * 
 * Works across OAuth redirects since cookies are automatically sent by the browser.
 */
export async function getUserFromRequest(
  req: Request,
): Promise<{ userId: string; token: string } | null> {
  // First, try Authorization header (for direct API calls with Bearer token)
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const client = createUserClient(token);
    const {
      data: { user },
      error,
    } = await client.auth.getUser();

    if (!error && user) {
      return { userId: user.id, token };
    }
  }

  // Second, try Supabase session cookies (set by Supabase client with persistSession: true)
  // Supabase stores the session in cookies when the client is configured with cookie-based storage
  const cookieStore = cookies();
  
  // Supabase stores the session in the 'sb-<project-id>-auth-token' cookie
  // Extract project ID from URL (format: https://<project-id>.supabase.co)
  const projectId = supabaseUrl.split('//')[1]?.split('.')[0];
  if (!projectId) return null;

  const sessionCookie = cookieStore.get(`sb-${projectId}-auth-token`);
  if (!sessionCookie?.value) return null;

  try {
    // Parse the session cookie
    const session = JSON.parse(sessionCookie.value);
    if (!session.access_token) return null;

    // Validate the access token with Supabase
    const client = createUserClient(session.access_token);
    const {
      data: { user },
      error,
    } = await client.auth.getUser();

    if (error || !user) return null;
    return { userId: user.id, token: session.access_token };
  } catch (err) {
    // Cookie parsing or validation failed
    return null;
  }
}
