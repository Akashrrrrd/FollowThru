'use client';

import { useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from './auth-provider';
import { useAuthFetch } from '@/hooks/use-auth-fetch';
import { Loader2 } from 'lucide-react';

interface ProfileCheckProps {
  children: ReactNode;
}

/**
 * ProfileCheck component
 * 
 * Checks if the authenticated user has completed their profile.
 * If not, redirects to /onboarding.
 * 
 * Skips check for:
 * - /onboarding
 * - /login
 * - /signup
 * - /logout
 */
export function ProfileCheck({ children }: ProfileCheckProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();
  const authFetch = useAuthFetch();
  
  const [profileChecked, setProfileChecked] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  // Routes that don't require profile completion
  const skipProfileCheckRoutes = ['/onboarding', '/login', '/signup', '/logout'];
  const shouldSkipCheck = skipProfileCheckRoutes.some((route) => pathname?.startsWith(route));

  useEffect(() => {
    if (authLoading || shouldSkipCheck || !user) {
      setProfileChecked(true);
      return;
    }

    const checkProfile = async () => {
      try {
        const res = await authFetch('/api/profile');
        const data = await res.json();

        if (res.ok && data.profile?.full_name) {
          // Profile is complete
          setNeedsOnboarding(false);
        } else {
          // Profile is incomplete
          setNeedsOnboarding(true);
        }
      } catch (err) {
        console.error('Error checking profile:', err);
        // On error, assume needs onboarding to be safe
        setNeedsOnboarding(true);
      }
      setProfileChecked(true);
    };

    checkProfile();
  }, [authLoading, user, shouldSkipCheck, authFetch, pathname]);

  // Redirect to onboarding if needed
  useEffect(() => {
    if (profileChecked && needsOnboarding && !shouldSkipCheck && user) {
      router.push('/onboarding');
    }
  }, [profileChecked, needsOnboarding, shouldSkipCheck, user, router]);

  // Show loading spinner while checking
  if (authLoading || !profileChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return <>{children}</>;
}
