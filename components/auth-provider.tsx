'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
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

  // Load organization context when user changes
  const loadOrganization = useCallback(async (userId: string) => {
    try {
      // Get the session token to pass to the API
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.warn('[auth-provider] No access token available for organization load');
        setOrganization(null);
        return;
      }

      const response = await fetch('/api/organizations/current', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setOrganization(data);
      } else {
        // Organization initialization failed
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error || errorData.reason || 'Failed to load organization';
        console.error(`[auth-provider] Failed to load organization (${response.status}): ${errorMsg}`);
        // Log but don't crash - let pages handle missing org context
        setOrganization(null);
        // TODO: Consider showing a toast or banner alerting user to the initialization failure
      }
    } catch (err) {
      console.error('[auth-provider] Failed to load organization context (network error):', err);
      setOrganization(null);
      // TODO: Consider showing a toast or banner alerting user to the network error
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user?.id) {
        loadOrganization(data.session.user.id);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user?.id) {
          await loadOrganization(session.user.id);
        } else {
          setOrganization(null);
        }
        setLoading(false);
      })();
    });

    return () => subscription.unsubscribe();
  }, [loadOrganization]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
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
