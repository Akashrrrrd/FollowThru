'use client';

/**
 * Current User Context
 * 
 * Provides a single source of truth for the authenticated user's identity.
 * Combines Supabase Auth user (id, email) with custom profile data (full_name, display_name, etc.)
 * 
 * This ensures:
 * - Consistent identity access across all components
 * - Type-safe user data
 * - Single point of profile synchronization
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from '@/components/auth-provider';
import { useAuthFetch } from '@/hooks/use-auth-fetch';
import type { CurrentUser } from './types';

interface CurrentUserContextValue {
  user: CurrentUser | null;
  loading: boolean;
  error: string | null;
  refreshUser: () => Promise<void>;
}

const CurrentUserContext = createContext<CurrentUserContextValue>({
  user: null,
  loading: true,
  error: null,
  refreshUser: async () => {},
});

/**
 * Provider component - wrap your app with this
 */
export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const { user: authUser, loading: authLoading } = useAuth();
  const authFetch = useAuthFetch();
  
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCurrentUser = async () => {
    if (!authUser) {
      setUser(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await authFetch('/api/profile');
      const data = await res.json();

      if (res.ok && data.profile) {
        // Combine auth user with profile data
        const currentUser: CurrentUser = {
          id: authUser.id,
          email: authUser.email || '',
          full_name: data.profile.full_name || '',
          display_name: data.profile.display_name || '',
          job_title: data.profile.job_title || null,
          avatar_url: data.profile.avatar_url || null,
          created_at: data.profile.created_at || '',
          updated_at: data.profile.updated_at || '',
        };
        setUser(currentUser);
      } else {
        // Profile not found, create a minimal user object
        const currentUser: CurrentUser = {
          id: authUser.id,
          email: authUser.email || '',
          full_name: '',
          display_name: '',
          job_title: null,
          avatar_url: null,
          created_at: authUser.created_at || '',
          updated_at: new Date().toISOString(),
        };
        setUser(currentUser);
      }
    } catch (err) {
      console.error('Error fetching current user:', err);
      setError('Failed to load user profile');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // Fetch user profile when auth user changes
  useEffect(() => {
    fetchCurrentUser();
  }, [authUser?.id]); // Only re-fetch when user ID changes

  const refreshUser = async () => {
    await fetchCurrentUser();
  };

  return (
    <CurrentUserContext.Provider value={{ user, loading, error, refreshUser }}>
      {children}
    </CurrentUserContext.Provider>
  );
}

/**
 * Hook to access current user
 * 
 * Usage:
 * const { user, loading, error } = useCurrentUser();
 * 
 * if (loading) return <Loading />;
 * if (error) return <Error message={error} />;
 * if (!user) return <NotAuthenticated />;
 * 
 * // Use user:
 * console.log(user.id);           // UUID
 * console.log(user.email);         // Email
 * console.log(user.full_name);     // Full name
 * console.log(user.display_name);  // Display name
 */
export function useCurrentUser() {
  return useContext(CurrentUserContext);
}
