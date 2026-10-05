/**
 * Realtime hook for accountability dashboard
 * 
 * Subscribes to commitment changes and triggers targeted refetches
 * of accountability metrics when relevant changes occur.
 */

import { useEffect, useCallback, useRef } from 'react';
import { useRealtimeCommitments } from './use-realtime-commitments';

type RefreshCallback = () => Promise<void>;

interface UseAccountabilityRealtimeOptions {
  enabled?: boolean;
  onRefresh?: RefreshCallback;
}

/**
 * Hook to integrate realtime commitment updates with accountability dashboard.
 * 
 * Listens for commitment changes (status, due_date, overdue status)
 * and triggers a refresh of accountability metrics.
 * 
 * Uses debouncing to avoid excessive API calls when multiple
 * commitments change rapidly.
 * 
 * @param onRefresh - Callback to refresh accountability data
 * @param enabled - Whether to enable realtime listening (default: true)
 */
export function useAccountabilityRealtime({
  onRefresh,
  enabled = true,
}: UseAccountabilityRealtimeOptions) {
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstRenderRef = useRef(true);

  const handleCommitmentChange = useCallback(async () => {
    if (!enabled || !onRefresh) {
      return;
    }

    // Clear any pending debounce
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce the refresh for 1 second to batch multiple changes
    debounceTimerRef.current = setTimeout(async () => {
      try {
        await onRefresh();
      } catch (err) {
        console.error('[useAccountabilityRealtime] Refresh failed:', err);
      }
    }, 1000);
  }, [enabled, onRefresh]);

  // Subscribe to realtime commitment changes
  useRealtimeCommitments(
    useCallback(
      (event, commitment) => {
        // Skip the first render to avoid unnecessary refresh
        if (isFirstRenderRef.current) {
          isFirstRenderRef.current = false;
          return;
        }

        // Relevant changes that affect accountability metrics:
        // - Status change (affects completion rate, overdue)
        // - Due date change (affects overdue status)
        // - Overdue status update (already affects status via cron)
        // 
        // We don't need to filter by specific fields; any change
        // to a commitment could affect accountability, so we always refresh.

        handleCommitmentChange();
      },
      [handleCommitmentChange],
    ),
  );

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);
}
