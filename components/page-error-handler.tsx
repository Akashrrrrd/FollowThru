'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import MaintenancePage from '@/app/maintenance/page';

interface PageErrorHandlerProps {
  children: React.ReactNode;
  onError?: (error: Error) => void;
}

/**
 * Wrapper component that catches errors in pages and shows maintenance page
 * Use this to wrap page content that might error
 */
export function PageErrorHandler({ children, onError }: PageErrorHandlerProps) {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const router = useRouter();

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('Uncaught error:', event.error);
      setHasError(true);
      setError(event.error);
      onError?.(event.error);
    };

    const handlePromiseRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);
      setHasError(true);
      setError(new Error(event.reason?.toString() || 'Unknown error'));
      onError?.(event.reason);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handlePromiseRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handlePromiseRejection);
    };
  }, [onError]);

  if (hasError) {
    return (
      <MaintenancePage />
    );
  }

  return <>{children}</>;
}
