'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';

export interface MaintenanceOptions {
  title?: string;
  description?: string;
  redirectDelay?: number;
}

/**
 * Hook to trigger maintenance mode and redirect to maintenance page
 * Useful for handling errors, API failures, or scheduled maintenance
 */
export function useMaintenance() {
  const router = useRouter();

  const goToMaintenance = useCallback(
    (options: MaintenanceOptions = {}) => {
      const {
        title = 'Under Maintenance',
        description = 'We\'re performing scheduled maintenance. We\'ll be back online shortly.',
        redirectDelay = 0,
      } = options;

      // Store maintenance info in session storage so the maintenance page can access it
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(
          'maintenance-info',
          JSON.stringify({
            title,
            description,
            timestamp: new Date().toISOString(),
          })
        );
      }

      if (redirectDelay > 0) {
        setTimeout(() => {
          router.push('/maintenance');
        }, redirectDelay);
      } else {
        router.push('/maintenance');
      }
    },
    [router]
  );

  return { goToMaintenance };
}
