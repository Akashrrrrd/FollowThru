'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthFetch } from '@/hooks/use-auth-fetch';
import { useAuth } from '@/components/auth-provider';

interface InvitationDetails {
  email: string;
  team: {
    id: string;
    name: string;
  };
  inviterName: string;
  expiresAt: string;
}

type Status = 'loading' | 'details' | 'success' | 'error' | 'expired' | 'unauthorized' | 'accepting';

export default function AcceptTeamInvitationPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const authFetch = useAuthFetch();
  const { user, loading: authLoading } = useAuth();

  const token = searchParams.get('token');

  const [status, setStatus] = useState<Status>('loading');
  const [details, setDetails] = useState<InvitationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch invitation details
  useEffect(() => {
    const fetchDetails = async () => {
      if (!token) {
        setStatus('error');
        setError('No invitation token provided');
        return;
      }

      try {
        const res = await fetch(
          `/api/teams/invitations/accept?token=${encodeURIComponent(token)}`,
        );
        const data = await res.json();

        if (!res.ok) {
          if (res.status === 404) {
            setStatus('expired');
            setError('This invitation is invalid or has expired');
          } else {
            setStatus('error');
            setError(data.error || 'Failed to load invitation');
          }
          return;
        }

        setDetails(data);
        setStatus('details');
      } catch (err) {
        console.error('Error fetching invitation:', err);
        setStatus('error');
        setError('Failed to load invitation details');
      }
    };

    // Only fetch if we have a token and auth is ready
    if (token) {
      fetchDetails();
    }
  }, [token]);

  // Check if user is authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      setStatus('unauthorized');
      setError('Please sign in to accept this invitation');
    }
  }, [user, authLoading]);

  // Handle acceptance
  const handleAccept = async () => {
    if (!token || !user) {
      return;
    }

    setStatus('accepting');

    try {
      const res = await authFetch('/api/teams/invitations/accept', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus('error');
        setError(data.error || 'Failed to accept invitation');
        return;
      }

      setStatus('success');

      // Redirect to teams page after 2 seconds
      setTimeout(() => {
        router.push('/teams');
      }, 2000);
    } catch (err) {
      console.error('Error accepting invitation:', err);
      setStatus('error');
      setError('An error occurred while accepting the invitation');
    }
  };

  const handleRedirect = () => {
    router.push('/teams');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 px-4">
      <div className="w-full max-w-md">
        {status === 'loading' && (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading invitation...</p>
          </div>
        )}

        {status === 'unauthorized' && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="flex justify-center mb-4">
              <AlertCircle className="h-12 w-12 text-orange-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
              Sign In Required
            </h1>
            <p className="text-gray-600 text-center mb-6">
              Please sign in to your FollowThru account to accept this team invitation.
            </p>
            <Button
              onClick={() => router.push('/auth/login')}
              className="w-full"
            >
              Sign In
            </Button>
          </div>
        )}

        {status === 'details' && details && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-center mb-6">
              <div className="inline-block p-3 bg-blue-100 rounded-full mb-4">
                <Loader2 className="h-6 w-6 text-blue-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Team Invitation
              </h1>
            </div>

            <div className="space-y-4 mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Team</p>
                <p className="text-lg font-semibold text-gray-900">
                  {details.team.name}
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Invited by</p>
                <p className="text-lg font-semibold text-gray-900">
                  {details.inviterName}
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Your Email</p>
                <p className="text-lg font-semibold text-gray-900">
                  {details.email}
                </p>
              </div>
            </div>

            <p className="text-sm text-gray-600 text-center mb-6">
              Accept this invitation to join the team and start collaborating.
            </p>

            <div className="space-y-3">
              <Button
                onClick={handleAccept}
                disabled={status !== 'details'}
                className="w-full"
              >
                {status === 'details' ? (
                  'Accept Invitation'
                ) : (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Accepting...
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push('/teams')}
                className="w-full"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {status === 'success' && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-center">
              <div className="inline-block p-3 bg-green-100 rounded-full mb-4">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Invitation Accepted!
              </h1>
              <p className="text-gray-600 mb-6">
                You've successfully joined the team. Redirecting you to the teams page...
              </p>
              <Button onClick={handleRedirect} className="w-full">
                Go to Teams
              </Button>
            </div>
          </div>
        )}

        {status === 'expired' && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-center">
              <div className="inline-block p-3 bg-red-100 rounded-full mb-4">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Invitation Expired
              </h1>
              <p className="text-gray-600 mb-6">
                This invitation is no longer valid. It may have expired or already been used.
                Please ask the team manager to send you a new invitation.
              </p>
              <Button onClick={handleRedirect} className="w-full">
                Go to Teams
              </Button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-center">
              <div className="inline-block p-3 bg-red-100 rounded-full mb-4">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Something Went Wrong
              </h1>
              <p className="text-gray-600 mb-6">
                {error || 'Failed to process your invitation'}
              </p>
              <Button onClick={handleRedirect} className="w-full">
                Go to Teams
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
