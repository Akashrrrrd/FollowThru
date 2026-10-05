'use client';

/**
 * useAnalytics Hook
 *
 * Fetches and caches analytics data for commitments.
 * Handles loading, error states, and automatic refetching.
 *
 * Usage:
 * const { data, loading, error, refetch } = useAnalytics({
 *   startDate: '2024-09-01',
 *   endDate: '2024-10-01',
 *   status: 'completed,done'
 * });
 */

import { useEffect, useState, useCallback } from 'react';
import type { AnalyticsData } from '@/lib/analytics-service';

export interface AnalyticsQueryParams {
  startDate?: string;
  endDate?: string;
  status?: string; // comma-separated
  teamId?: string;
  userId?: string;
}

export interface AnalyticsResponse {
  analytics: AnalyticsData;
  trends: {
    escalation: Array<{ date: string; escalations: number }>;
    completion: Array<{
      week: string;
      completionRate: number;
      totalTasks: number;
      completed: number;
    }>;
  };
}

interface UseAnalyticsOptions {
  params?: AnalyticsQueryParams;
  skip?: boolean;
  refetchInterval?: number; // ms
}

export function useAnalytics(options: UseAnalyticsOptions = {}) {
  const { params = {}, skip = false, refetchInterval } = options;
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(!skip);
  const [error, setError] = useState<string | null>(null);

  // Memoized fetch function
  const fetchAnalytics = useCallback(async () => {
    if (skip) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const searchParams = new URLSearchParams();

      if (params.startDate) searchParams.set('startDate', params.startDate);
      if (params.endDate) searchParams.set('endDate', params.endDate);
      if (params.status) searchParams.set('status', params.status);
      if (params.teamId) searchParams.set('teamId', params.teamId);
      if (params.userId) searchParams.set('userId', params.userId);

      const url = `/api/analytics/commitments?${searchParams.toString()}`;
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || 'Failed to fetch analytics'
        );
      }

      const result: AnalyticsResponse = await response.json();
      setData(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('[useAnalytics] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [skip, params]);

  // Initial fetch
  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Auto-refetch interval
  useEffect(() => {
    if (!refetchInterval || skip) return;

    const interval = setInterval(fetchAnalytics, refetchInterval);
    return () => clearInterval(interval);
  }, [refetchInterval, fetchAnalytics, skip]);

  return {
    data,
    loading,
    error,
    refetch: fetchAnalytics,
  };
}

/**
 * useAnalyticsForTeam Hook
 *
 * Convenience hook for fetching analytics for a specific team.
 */
export function useAnalyticsForTeam(
  teamId: string | undefined,
  options: UseAnalyticsOptions = {}
) {
  return useAnalytics({
    ...options,
    params: {
      ...options.params,
      teamId,
    },
  });
}

/**
 * useAnalyticsForUser Hook
 *
 * Convenience hook for fetching analytics for a specific user.
 */
export function useAnalyticsForUser(
  userId: string | undefined,
  options: UseAnalyticsOptions = {}
) {
  return useAnalytics({
    ...options,
    params: {
      ...options.params,
      userId,
    },
  });
}
