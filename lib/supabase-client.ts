'use client';

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Extract project ID from URL for cookie naming
const projectId = supabaseUrl.split('//')[1]?.split('.')[0] || 'supabase';
const sessionCookieName = `sb-${projectId}-auth-token`;

/**
 * Custom storage implementation that uses localStorage with a fallback strategy
 * for server-side cookie extraction.
 */
const getStorage = () => {
  if (typeof window === 'undefined') {
    // Server-side: cannot access localStorage
    return undefined;
  }

  return {
    getItem: (key: string) => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    setItem: (key: string, value: string) => {
      try {
        localStorage.setItem(key, value);
        // Also set a cookie for server-side access
        if (key === sessionCookieName || key.includes('auth-token')) {
          document.cookie = `${sessionCookieName}=${encodeURIComponent(value)}; path=/; samesite=lax`;
        }
      } catch {
        // Fail silently if localStorage is not available
      }
    },
    removeItem: (key: string) => {
      try {
        localStorage.removeItem(key);
        // Also remove the cookie
        if (key === sessionCookieName || key.includes('auth-token')) {
          document.cookie = `${sessionCookieName}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; samesite=lax`;
        }
      } catch {
        // Fail silently if localStorage is not available
      }
    },
  };
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: getStorage(),
  },
});
