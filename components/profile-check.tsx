'use client';

import { useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from './auth-provider';

interface ProfileCheckProps {
  children: ReactNode;
}

/**
 * ProfileCheck component
 * 
 * Redirects authenticated users on home page to dashboard.
 */
export function ProfileCheck({ children }: ProfileCheckProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();

  // Redirect to dashboard if logged in and on home page
  useEffect(() => {
    if (!authLoading && user && pathname === '/') {
      router.push('/dashboard');
    }
  }, [authLoading, user, pathname, router]);

  return <>{children}</>;
}
