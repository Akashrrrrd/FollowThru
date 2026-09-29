'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageError } from '@/components/page-loading';
import { ProtectedRoute } from '@/components/protected-route';
import { useAuth } from '@/components/auth-provider';
import { useAuthFetch } from '@/hooks/use-auth-fetch';

interface ProfileSetupForm {
  full_name: string;
  display_name: string;
  job_title: string;
}

function OnboardingContent() {
  const router = useRouter();
  const { user } = useAuth();
  const authFetch = useAuthFetch();
  
  const [formData, setFormData] = useState<ProfileSetupForm>({
    full_name: '',
    display_name: '',
    job_title: '',
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileExists, setProfileExists] = useState<boolean | null>(null);

  // Check if profile already exists
  useEffect(() => {
    const checkProfile = async () => {
      try {
        const res = await authFetch('/api/profile');
        const data = await res.json();
        
        if (data.profile?.full_name) {
          // Profile already set up, redirect to dashboard
          router.push('/dashboard');
        } else {
          setProfileExists(false);
        }
      } catch (err) {
        console.error('Error checking profile:', err);
        setProfileExists(false);
      }
    };

    checkProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!formData.full_name.trim()) {
      setError('Full name is required.');
      setLoading(false);
      return;
    }

    // Auto-generate display_name from first name if not provided
    const display_name = formData.display_name.trim() || formData.full_name.trim().split(' ')[0];

    try {
      const res = await authFetch('/api/profile', {
        method: 'POST',
        body: JSON.stringify({
          full_name: formData.full_name.trim(),
          display_name,
          job_title: formData.job_title.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to save profile.');
        setLoading(false);
        return;
      }

      // Profile created successfully, redirect to dashboard
      router.push('/dashboard');
    } catch (err) {
      console.error('Profile setup error:', err);
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  if (profileExists === null) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (profileExists === true) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="mx-auto flex h-screen max-w-md flex-col items-center justify-center px-4">
      <Card className="w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Complete Your Profile</CardTitle>
          <CardDescription>
            Help us identify you in meetings. This information will be used to track your commitments
            and accountability metrics.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="full_name" className="block text-sm font-medium text-gray-700">
                Full Name *
              </label>
              <Input
                id="full_name"
                name="full_name"
                type="text"
                value={formData.full_name}
                onChange={handleChange}
                placeholder="e.g., Akash R"
                className="mt-1 border-gray-200"
                disabled={loading}
              />
              <p className="mt-1 text-xs text-gray-500">
                Your complete name for profile identification.
              </p>
            </div>

            <div>
              <label htmlFor="display_name" className="block text-sm font-medium text-gray-700">
                Display Name (Optional)
              </label>
              <Input
                id="display_name"
                name="display_name"
                type="text"
                value={formData.display_name}
                onChange={handleChange}
                placeholder="e.g., Akash"
                className="mt-1 border-gray-200"
                disabled={loading}
              />
              <p className="mt-1 text-xs text-gray-500">
                How you&apos;ll be identified in meetings. Defaults to your first name.
              </p>
            </div>

            <div>
              <label htmlFor="job_title" className="block text-sm font-medium text-gray-700">
                Job Title (Optional)
              </label>
              <Input
                id="job_title"
                name="job_title"
                type="text"
                value={formData.job_title}
                onChange={handleChange}
                placeholder="e.g., Software Engineer"
                className="mt-1 border-gray-200"
                disabled={loading}
              />
              <p className="mt-1 text-xs text-gray-500">
                Your role or job title for additional context.
              </p>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white hover:bg-blue-700"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Complete Profile'
              )}
            </Button>

            <p className="text-center text-xs text-gray-500">
              You can update this information later in your profile settings.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <ProtectedRoute>
      <OnboardingContent />
    </ProtectedRoute>
  );
}
