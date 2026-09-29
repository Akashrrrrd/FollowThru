'use client';

import { supabase } from '@/lib/supabase-client';

/**
 * Returns an async fetch wrapper that automatically attaches the current
 * Supabase session's access token as a Bearer header, so server routes
 * can identify the user via getUserFromRequest().
 */
export function useAuthFetch() {
  return async (input: string, init?: RequestInit) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const headers = new Headers(init?.headers);
    if (session?.access_token) {
      headers.set('Authorization', `Bearer ${session.access_token}`);
    }
    if (init?.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    return fetch(input, { ...init, headers });
  };
}
