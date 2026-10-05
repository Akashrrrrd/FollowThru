'use client';

import { useState, useCallback, useRef } from 'react';
import { useAuthFetch } from './use-auth-fetch';

export interface UserSearchResult {
  userId: string;
  displayName: string;
  fullName: string;
  email: string;
  jobTitle?: string;
  orgRole: 'owner' | 'manager' | 'member';
}

export function useUserSearch() {
  const authFetch = useAuthFetch();
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  const search = useCallback(
    async (query: string) => {
      // Clear existing timer
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      // Clear results if query is empty
      if (!query || query.trim().length === 0) {
        setResults([]);
        setError(null);
        return;
      }

      // Debounce search by 300ms
      debounceTimer.current = setTimeout(async () => {
        setLoading(true);
        setError(null);

        try {
          const response = await authFetch(
            `/api/users/search?q=${encodeURIComponent(query)}`
          );
          const data = await response.json();

          if (!response.ok) {
            setError(data.error || 'Search failed');
            setResults([]);
            return;
          }

          setResults(data.results || []);
        } catch (err) {
          console.error('Search error:', err);
          setError('Failed to search users');
          setResults([]);
        } finally {
          setLoading(false);
        }
      }, 300);
    },
    [authFetch]
  );

  const clear = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    setResults([]);
    setError(null);
    setLoading(false);
  }, []);

  return {
    results,
    loading,
    error,
    search,
    clear,
  };
}
