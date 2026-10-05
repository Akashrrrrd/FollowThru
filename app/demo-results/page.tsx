'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, LogIn } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ExtractedCommitment } from '@/lib/types';

export default function DemoResultsPage() {
  const router = useRouter();
  const [commitments, setCommitments] = useState<ExtractedCommitment[]>([]);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [yourName, setYourName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Retrieve demo data from sessionStorage
    const storedTitle = sessionStorage.getItem('demoMeetingTitle');
    const storedCommitments = sessionStorage.getItem('demoCommitments');
    const storedYourName = sessionStorage.getItem('demoYourName');

    if (storedTitle && storedCommitments) {
      try {
        setMeetingTitle(storedTitle);
        setCommitments(JSON.parse(storedCommitments));
        setYourName(storedYourName || 'You');
      } catch (err) {
        console.error('Failed to parse demo data:', err);
        router.push('/new');
      }
    } else {
      // No demo data, redirect back
      router.push('/new');
    }

    setLoading(false);
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 text-lg font-semibold text-gray-900">Loading demo results...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.back()}
                  className="text-gray-600 hover:text-gray-900"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{meetingTitle}</h1>
                  <p className="text-sm text-gray-600">Demo mode • {commitments.length} commitments extracted</p>
                </div>
              </div>
              <Badge className="mt-2 bg-blue-100 text-blue-700">📋 Demo Mode - No Sign In Required</Badge>
            </div>
            <Link href="/login">
              <Button className="gap-2 bg-blue-600 text-white hover:bg-blue-700">
                <LogIn className="h-4 w-4" />
                Sign In to Save
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {commitments.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
            <p className="text-gray-500">No commitments extracted. Please try the demo again.</p>
            <Button onClick={() => router.push('/new')} className="mt-4 bg-blue-600 hover:bg-blue-700">
              Back to Demo
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900">
                {commitments.length} Commitments Extracted
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                These commitments were automatically identified from the meeting transcript. You are viewing this as <strong>{yourName}</strong>.
              </p>
            </div>

            {/* Commitments Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {commitments.map((commitment, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* Header */}
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{commitment.description}</h3>
                      <p className="text-sm text-gray-600">Owner: <span className="font-medium">{commitment.owner}</span></p>
                    </div>
                    {commitment.commitment_type && (
                      <Badge className="ml-2 bg-blue-100 text-blue-700 text-xs capitalize">
                        {commitment.commitment_type}
                      </Badge>
                    )}
                  </div>

                  {/* Due Date */}
                  {commitment.due_date && (
                    <p className="mb-3 text-sm text-gray-700">
                      <span className="font-medium">Due:</span> {commitment.due_date}
                    </p>
                  )}

                  {/* Source Quote */}
                  {commitment.source_quote && (
                    <blockquote className="mb-3 border-l-4 border-gray-300 bg-gray-50 px-3 py-2 text-xs italic text-gray-600">
                      "{commitment.source_quote}"
                    </blockquote>
                  )}

                  {/* Dependency */}
                  {commitment.dependency && (
                    <p className="mb-2 text-xs text-gray-500">
                      <span className="font-medium">Depends on:</span> {commitment.dependency}
                    </p>
                  )}

                  {/* Confidence */}
                  {commitment.confidence && (
                    <p className="text-xs text-gray-500">
                      <span className="font-medium">Confidence:</span> {commitment.confidence.toUpperCase()}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* CTA Section */}
            <div className="mt-10 rounded-lg border border-blue-200 bg-blue-50 p-6">
              <h3 className="font-semibold text-blue-900">Ready to save and track these commitments?</h3>
              <p className="mt-2 text-sm text-blue-700">
                Sign in to save this meeting, assign tasks to team members, set reminders, and track progress in real-time.
              </p>
              <div className="mt-4 flex gap-3">
                <Link href="/login">
                  <Button className="gap-2 bg-blue-600 text-white hover:bg-blue-700">
                    <LogIn className="h-4 w-4" />
                    Sign In to Save
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  className="border-blue-300"
                  onClick={() => router.push('/new')}
                >
                  Try Another Demo
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
