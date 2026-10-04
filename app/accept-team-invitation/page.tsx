'use client';

import { Suspense, useEffect, useState } from 'react';
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

// Fixes vs. previous version:
//  - 'unauthorized' was a status that raced with the details fetch (whichever
//    finished last won). Auth state is now derived at render time instead.
//  - The "accepting" state rendered nothing (the details card only showed for
//    status === 'details'). It now stays visible with a spinner.
//  - useSearchParams() needs a <Suspense> boundary or `next build` fails.
//  - Sign-in button now returns the user to this invitation afterwards.
type Status = 'loading' | 'ready' | 'accepting' | 'success' | 'error' | 'expired';

function AcceptTeamInvitationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const authFetch = useAuthFetch();
  const { user, loading: authLoading } = useAuth();

  const token = searchParams.get('token');

  const [status, setStatus] = useState<Status>(token ? 'loading' : 'error');
  const [details, setDetails] = useState<InvitationDetails | null>(null);
  const [error, setError] = useState<string | null>(
    token ? null : 'No invitation token provided',
  );

  // Fetch invitation details (public endpoint, no auth needed)
  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    const fetchDetails = async () => {
      try {
        const res = await fetch(
          `/api/teams/invitations/accept?token=${encodeURIComponent(token)}`,
        );
        const data = await res.json();
        if (cancelled) return;

        if (!res.ok) {
          if (res.status === 404) {
            setStatus('expired');
          } else {
            setStatus('error');
            setError(data.error || 'Failed to load invitation');
          }
          return;
        }

        setDetails(data);
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        console.error('Error fetching invitation:', err);
        setStatus('error');
        setError('Failed to load invitation details');
      }
    };

    fetchDetails();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleAccept = async () => {
    if (!token || !user) return;

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
      
      // Allow 1 second for database writes to complete, then redirect
      // This ensures the invited user's org/team membership is queryable
      setTimeout(() => router.push('/teams'), 1000);
    } catch (err) {
      console.error('Error accepting invitation:', err);
      setStatus('error');
      setError('An error occurred while accepting the invitation');
    }
  };

  const goToTeams = () => router.push('/teams');

  // NOTE: adjust the query param name to whatever your login page reads
  // for post-login redirects.
  const goToLogin = () => {
    const returnTo = `/accept-team-invitation?token=${encodeURIComponent(token ?? '')}`;
    router.push(`/auth/login?redirect=${encodeURIComponent(returnTo)}`);
  };

  if (authLoading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading invitation...</p>
        </div>
      </div>
    );
  }

  const showDetails = (status === 'ready' || status === 'accepting') && details;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 px-4">
      <div className="w-full max-w-md">
        {showDetails && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Team Invitation</h1>
            </div>

            <div className="space-y-4 mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Team</p>
                <p className="text-lg font-semibold text-gray-900">{details.team.name}</p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Invited by</p>
                <p className="text-lg font-semibold text-gray-900">{details.inviterName}</p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Invited email</p>
                <p className="text-lg font-semibold text-gray-900">{details.email}</p>
              </div>
            </div>

            {user ? (
              <>
                <p className="text-sm text-gray-600 text-center mb-6">
                  Accept this invitation to join the team and start collaborating.
                </p>
                <div className="space-y-3">
                  <Button
                    onClick={handleAccept}
                    disabled={status === 'accepting'}
                    className="w-full"
                  >
                    {status === 'accepting' ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Accepting...
                      </>
                    ) : (
                      'Accept Invitation'
                    )}
                  </Button>
                  <Button variant="outline" onClick={goToTeams} className="w-full">
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 justify-center text-orange-700 mb-4">
                  <AlertCircle className="h-5 w-5" />
                  <p className="text-sm">
                    Sign in with <strong>{details.email}</strong> to accept this invitation.
                  </p>
                </div>
                <Button onClick={goToLogin} className="w-full">
                  Sign In
                </Button>
              </>
            )}
          </div>
        )}

        {status === 'success' && (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="inline-block p-3 bg-green-100 rounded-full mb-4">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Invitation Accepted!</h1>
            <p className="text-gray-600 mb-6">
              You've successfully joined the team. Redirecting you to the teams page...
            </p>
            <Button onClick={goToTeams} className="w-full">
              Go to Teams
            </Button>
          </div>
        )}

        {status === 'expired' && (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="inline-block p-3 bg-red-100 rounded-full mb-4">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Invitation Expired</h1>
            <p className="text-gray-600 mb-6">
              This invitation is no longer valid. It may have expired or already been used.
              Please ask the team manager to send you a new invitation.
            </p>
            <Button onClick={goToTeams} className="w-full">
              Go to Teams
            </Button>
          </div>
        )}

        {status === 'error' && (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="inline-block p-3 bg-red-100 rounded-full mb-4">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Something Went Wrong</h1>
            <p className="text-gray-600 mb-6">
              {error || 'Failed to process your invitation'}
            </p>
            <Button onClick={goToTeams} className="w-full">
              Go to Teams
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AcceptTeamInvitationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <AcceptTeamInvitationContent />
    </Suspense>
  );
}