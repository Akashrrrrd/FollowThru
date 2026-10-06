'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase-client';

export interface OrganizationInfo {
  organizationId: string;
  role: 'owner' | 'manager' | 'member';
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  organization: OrganizationInfo | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  organization: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [organization, setOrganization] = useState<OrganizationInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Tracks which user's organization has been loaded, to avoid duplicate requests
  // (getSession + INITIAL_SESSION + SIGNED_IN can all fire for the same user).
  const loadedOrgForUser = useRef<string | null>(null);

  /**
   * Loads the organization using the access token we already have.
   * IMPORTANT: do NOT call supabase.auth.* methods in here — this runs from inside
   * onAuthStateChange, and calling auth methods there can deadlock the auth lock.
   */
  const loadOrganization = useCallback(async (userId: string, accessToken: string) => {
    if (loadedOrgForUser.current === userId) return;
    loadedOrgForUser.current = userId;

    try {
      const response = await fetch('/api/organizations/current', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const responseData = await response.json();
        // Handle both old and new response formats
        const data = responseData.data || responseData;
        setOrganization(data);
      } else {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error?.message || errorData.error || errorData.reason || 'Failed to load organization';
        console.error(`[auth-provider] Failed to load organization (${response.status}): ${errorMsg}`);
        loadedOrgForUser.current = null;
        setOrganization(null);
      }
    } catch (err) {
      console.error('[auth-provider] Failed to load organization context (network error):', err);
      loadedOrgForUser.current = null;
      setOrganization(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user?.id && data.session.access_token) {
        await loadOrganization(data.session.user.id, data.session.access_token);
      }
      if (!cancelled) setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      // Not awaited on purpose: keep the callback synchronous to avoid auth-lock deadlocks.
      void (async () => {
        setSession(nextSession);
        setUser(nextSession?.user ?? null);

        if (nextSession?.user?.id && nextSession.access_token) {
          if (event !== 'TOKEN_REFRESHED') {
            await loadOrganization(nextSession.user.id, nextSession.access_token);
          }
        } else {
          loadedOrgForUser.current = null;
          setOrganization(null);
        }
        setLoading(false);
      })();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [loadOrganization]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    loadedOrgForUser.current = null;
    setSession(null);
    setUser(null);
    setOrganization(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, organization, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}