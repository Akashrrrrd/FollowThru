'use client';

/**
 * useOrganizationContext Hook
 * 
 * Provides access to user's organization context.
 * Returns organization ID and user's role within the organization.
 * 
 * Usage:
 * const { organizationId, role, isManager, loading } = useOrganizationContext();
 */

import { useEffect, useState } from 'react';
import { useAuthFetch } from './use-auth-fetch';

export interface OrganizationContextData {
  id: string;
  role: 'owner' | 'manager' | 'member';
}

interface UseOrganizationContextResult {
  organization: OrganizationContextData | null;
  loading: boolean;
  error: string | null;
  isManager: boolean;
}

export function useOrganizationContext(): UseOrganizationContextResult {
  const authFetch = useAuthFetch();
  const [organization, setOrganization] = useState<OrganizationContextData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrganizationContext = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await authFetch('/api/profile');
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'Failed to load organization context');
          setLoading(false);
          return;
        }

        if (data.organization) {
          setOrganization(data.organization);
        }
      } catch (err) {
        console.error('Error loading organization context:', err);
        setError('Failed to load organization context');
      } finally {
        setLoading(false);
      }
    };

    fetchOrganizationContext();
  }, [authFetch]);

  const isManager = organization?.role === 'owner' || organization?.role === 'manager';

  return { organization, loading, error, isManager };
}

/**
 * Helper hook to check if user is manager/owner.
 */
export function useIsManager(): boolean {
  const { isManager } = useOrganizationContext();
  return isManager;
}

/**
 * Helper hook to get organization ID.
 */
export function useOrganizationId(): string | null {
  const { organization } = useOrganizationContext();
  return organization?.id ?? null;
}
