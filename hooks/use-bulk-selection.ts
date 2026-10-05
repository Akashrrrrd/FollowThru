/**
 * useBulkSelection Hook
 *
 * Manages bulk commitment selection state and actions.
 *
 * Features:
 * - Individual commitment selection/deselection
 * - Select all visible commitments
 * - Clear all selections
 * - Track selection count
 * - Bulk action execution
 */

'use client';

import { useState, useCallback } from 'react';

export interface BulkSelectionState {
  selectedIds: Set<string>;
  selectAllMode: boolean;
  totalVisible: number;
  isLoading: boolean;
  lastError?: string;
}

export function useBulkSelection(initialTotalVisible: number = 0) {
  const [state, setState] = useState<BulkSelectionState>({
    selectedIds: new Set(),
    selectAllMode: false,
    totalVisible: initialTotalVisible,
    isLoading: false,
  });

  /**
   * Toggle selection of a single commitment
   */
  const toggleSelection = useCallback(
    (commitmentId: string) => {
      setState(prev => {
        const newSelectedIds = new Set(prev.selectedIds);
        if (newSelectedIds.has(commitmentId)) {
          newSelectedIds.delete(commitmentId);
        } else {
          newSelectedIds.add(commitmentId);
        }

        return {
          ...prev,
          selectedIds: newSelectedIds,
          selectAllMode: false, // User manually selecting disables select-all mode
        };
      });
    },
    []
  );

  /**
   * Toggle select all visible commitments
   */
  const toggleSelectAll = useCallback(
    (visibleIds: string[]) => {
      setState(prev => {
        const newSelectedIds = new Set(prev.selectedIds);

        if (prev.selectAllMode) {
          // Deselect all
          newSelectedIds.clear();
          return { ...prev, selectedIds: newSelectedIds, selectAllMode: false };
        } else {
          // Select all visible
          visibleIds.forEach(id => newSelectedIds.add(id));
          return { ...prev, selectedIds: newSelectedIds, selectAllMode: true };
        }
      });
    },
    []
  );

  /**
   * Clear all selections
   */
  const clearSelection = useCallback(() => {
    setState(prev => ({
      ...prev,
      selectedIds: new Set(),
      selectAllMode: false,
      lastError: undefined,
    }));
  }, []);

  /**
   * Update total visible count (called when filter changes)
   */
  const setTotalVisible = useCallback((total: number) => {
    setState(prev => ({
      ...prev,
      totalVisible: total,
    }));
  }, []);

  /**
   * Set loading state
   */
  const setLoading = useCallback((isLoading: boolean) => {
    setState(prev => ({
      ...prev,
      isLoading,
    }));
  }, []);

  /**
   * Set error message
   */
  const setError = useCallback((error: string | undefined) => {
    setState(prev => ({
      ...prev,
      lastError: error,
    }));
  }, []);

  /**
   * Check if a commitment is selected
   */
  const isSelected = useCallback(
    (commitmentId: string): boolean => {
      return state.selectedIds.has(commitmentId);
    },
    [state.selectedIds]
  );

  /**
   * Get selected IDs as array
   */
  const getSelectedIds = useCallback((): string[] => {
    return Array.from(state.selectedIds);
  }, [state.selectedIds]);

  return {
    // State
    selectedIds: state.selectedIds,
    selectAllMode: state.selectAllMode,
    totalVisible: state.totalVisible,
    selectionCount: state.selectedIds.size,
    isLoading: state.isLoading,
    lastError: state.lastError,
    isEmpty: state.selectedIds.size === 0,

    // Actions
    toggleSelection,
    toggleSelectAll,
    clearSelection,
    setTotalVisible,
    setLoading,
    setError,
    isSelected,
    getSelectedIds,
  };
}

/**
 * Execute a bulk action with the selected commitments
 */
export async function executeBulkActionRequest(
  action: string,
  commitmentIds: string[],
  value: any
): Promise<{
  success: boolean;
  message: string;
  successCount?: number;
  failureCount?: number;
  failures?: Array<{ commitmentId: string; reason: string; severity: string }>;
}> {
  if (commitmentIds.length === 0) {
    return {
      success: false,
      message: 'No commitments selected',
    };
  }

  try {
    const response = await fetch('/api/commitments/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        commitmentIds,
        value,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      if (data.error) {
        return {
          success: false,
          message: data.error,
        };
      }
      return {
        success: false,
        message: `API error: ${response.statusText}`,
      };
    }

    // Partial failure (422)
    if (response.status === 422) {
      return {
        success: false,
        message: `${data.successCount} updated, ${data.failedCount} failed`,
        successCount: data.successCount,
        failureCount: data.failedCount,
        failures: data.failures,
      };
    }

    // Success (200)
    return {
      success: true,
      message: `Successfully updated ${data.successCount} ${action === 'priority' ? 'commitment' : 'commitments'}`,
      successCount: data.successCount,
      failureCount: data.failedCount,
    };
  } catch (err) {
    return {
      success: false,
      message: `Request failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
