import { createClient, SupabaseClient } from '@supabase/supabase-js';

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
 * Extracts the user's JWT from an incoming request and returns the user id.
 * Returns null if no valid session is found.
 */
export async function getUserFromRequest(
  req: Request,
): Promise<{ userId: string; token: string } | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);

  const client = createUserClient(token);
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) return null;
  return { userId: user.id, token };
}
