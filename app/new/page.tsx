'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Sparkles, AlertCircle, Users, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuthFetch } from '@/hooks/use-auth-fetch';
import { Badge } from '@/components/ui/badge';
import { LoadingExtraction } from '@/components/loading';
import type { ExtractedCommitment } from '@/lib/types';

const EXAMPLE_TRANSCRIPT = `Priya: Alright, let's talk about the launch timeline. We have 4 weeks to ship the mobile app update.
Vikram: I can have the database migration ready by October 8th. After that, Rahul can start the API integration.
Rahul: Sure, once Vikram finishes the migration, I'll handle the API endpoints. I can knock that out in 3 days, so by October 11th.
Priya: Perfect. Ananya, can you work on the mobile UI components?
Ananya: I'll have the UI components and design system updated by October 10th. But I'll need the final API spec by October 9th at the latest.
Rahul: I'll send you the API spec by October 9th morning.
Vikram: One more thing — I'll also update the database documentation by end of week.
Priya: Great. We'll schedule a final integration test meeting for October 15th to verify everything works together.`;

function NewMeetingContent() {
  const router = useRouter();
  const authFetch = useAuthFetch();
  const [title, setTitle] = useState('');
  const [transcript, setTranscript] = useState('');
  const [selectedParticipant, setSelectedParticipant] = useState<string>('');
  const [extractedCommitments, setExtractedCommitments] = useState<ExtractedCommitment[]>([]);
  const [participants, setParticipants] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'input' | 'participant-select'>('input');
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Extract unique participants from transcript
  const extractParticipants = (text: string): string[] => {
    const participantRegex = /^([A-Za-z]+):\s/gm;
    const found = new Set<string>();
    let match;
    while ((match = participantRegex.exec(text)) !== null) {
      found.add(match[1]);
    }
    return Array.from(found).sort();
  };

  const handleAnalyzeTranscript = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setError('Please enter a meeting title.');
      return;
    }
    if (!transcript.trim()) {
      setError('Please paste a meeting transcript.');
      return;
    }

    setError(null);
    
    // Extract participants from transcript
    const extractedParticipants = extractParticipants(transcript);
    setParticipants(extractedParticipants);
    
    if (extractedParticipants.length === 0) {
      setError('No participants found in transcript.');
      return;
    }

    // Move to participant selection step
    setStep('participant-select');
  };

  const handleSubmitWithParticipant = async () => {
    if (!selectedParticipant) {
      setError('Please select which participant is you.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      // Validate transcript length (minimum 50 characters to avoid trivial inputs)
      const trimmedTranscript = transcript.trim();
      if (trimmedTranscript.length < 50) {
        setError(
          'Transcript is too short. Please provide a more detailed meeting transcript with at least a few exchanges between participants.',
        );
        setLoading(false);
        return;
      }

      // For demo mode, use a simple extract endpoint that doesn't require auth
      // For authenticated mode, use the full extraction pipeline
      const endpoint = isDemoMode ? '/api/meetings/extract-demo' : '/api/meetings/extract';

      const res = await authFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          transcript: trimmedTranscript,
          your_name: selectedParticipant,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMessage =
          data.error ||
          (res.status === 429 ? 'Too many requests. Please wait a moment and try again.' : 'Something went wrong. Please try again.');

        setError(errorMessage);
        setLoading(false);
        return;
      }

      // For demo mode, store results and show them
      if (isDemoMode && data.demo) {
        // Store demo data in sessionStorage to pass to results display
        sessionStorage.setItem('demoMeetingTitle', title.trim());
        sessionStorage.setItem('demoCommitments', JSON.stringify(data.commitments));
        sessionStorage.setItem('demoYourName', selectedParticipant);
        
        // Redirect to demo results page
        router.push('/demo-results');
        return;
      }

      // Check if extraction warning exists (extraction failed, but meeting was saved)
      if (data.warning) {
        console.warn('Extraction warning:', data.warning);
        setError(data.warning);
        setLoading(false);
        return;
      }

      // Success: redirect to meeting detail
      router.push(`/meetings/${data.meeting.id}`);
    } catch (err) {
      console.error('Extract error:', err);

      // Handle different types of errors
      if (err instanceof TypeError) {
        setError('Network error. Please check your connection and try again.');
      } else {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(`Failed to extract commitments: ${message}`);
      }

      setLoading(false);
    }
  };

  const handleBackToInput = () => {
    setStep('input');
    setSelectedParticipant('');
    setParticipants([]);
    setError(null);
    setIsDemoMode(false);
  };

  const handleTryDemo = () => {
    // Simply populate form fields - do NOT advance to participant selection
    // This allows user to see the demo data and decide to analyze it
    setIsDemoMode(true);
    setTitle('Q4 Mobile App Launch - Technical Planning');
    setTranscript(EXAMPLE_TRANSCRIPT);
    setError(null);
    // Keep step as 'input' so user can see populated form
    setStep('input');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadingFile(true);
    setError(null);

    const file = e.target.files?.[0];
    if (!file) {
      setUploadingFile(false);
      return;
    }

    try {
      // Validate file type
      const supportedTypes = ['.txt', '.vtt', '.srt'];
      const fileName = file.name.toLowerCase();
      const isSupported = supportedTypes.some((type) => fileName.endsWith(type));

      if (!isSupported) {
        setError(
          `File format not supported. Supported formats: TXT, VTT, SRT. You uploaded: ${file.name}`,
        );
        setUploadingFile(false);
        return;
      }

      // Validate file size (max 5 MB)
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        setError(`File is too large. Maximum size is 5 MB, but your file is ${(file.size / 1024 / 1024).toFixed(1)} MB.`);
        setUploadingFile(false);
        return;
      }

      // Read file content
      const fileContent = await file.text();

      // Validate file is not empty
      if (!fileContent.trim()) {
        setError('File is empty. Please provide a transcript file with content.');
        setUploadingFile(false);
        return;
      }

      // Set transcript and auto-generate title from filename
      setTranscript(fileContent);
      if (!title.trim()) {
        const titleFromFilename = file.name.replace(/\.(txt|vtt|srt)$/i, '').replace(/[-_]/g, ' ');
        setTitle(titleFromFilename);
      }

      setUploadingFile(false);
    } catch (err) {
      console.error('File upload error:', err);
      setError('Failed to read file. Please try again.');
      setUploadingFile(false);
    }
  };

  // Show extraction progress screen during loading
  if (loading && step === 'participant-select') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingExtraction />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {step === 'input' ? (
        <>
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">New Meeting</h1>
            <p className="mt-1 text-sm text-gray-500">
              Paste a transcript and FollowThru will extract every commitment
              automatically.
            </p>
          </div>

          {/* Demo Button */}
          <div className="mb-6 rounded-lg border-2 border-dashed border-blue-300 bg-blue-50 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Try with a sample transcript</h3>
                <p className="mt-1 text-sm text-gray-600">
                  See FollowThru in action with a realistic multi-person meeting showing commitment tracking and continuity.
                </p>
              </div>
              <Button
                type="button"
                onClick={handleTryDemo}
                disabled={loading}
                className="ml-4 shrink-0 bg-blue-600 text-white hover:bg-blue-700"
              >
                Load Demo
              </Button>
            </div>
          </div>

          <form onSubmit={handleAnalyzeTranscript} className="space-y-6">
            <div>
              <label
                htmlFor="title"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Meeting Title
              </label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Weekly Team Sync — Sept 22"
                disabled={loading}
                className="border-gray-200"
              />
            </div>

            <div>
              <label
                htmlFor="transcript"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Transcript
              </label>
              <Textarea
                id="transcript"
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder={EXAMPLE_TRANSCRIPT}
                disabled={loading}
                className="min-h-[300px] resize-y border-gray-200 font-mono text-sm leading-relaxed"
              />
              <p className="mt-2 text-xs text-gray-500">
                Or upload a transcript file:
              </p>
              <div className="mt-2 flex items-center gap-2">
                <Input
                  id="transcript-file"
                  type="file"
                  accept=".txt,.vtt,.srt"
                  onChange={handleFileUpload}
                  disabled={loading || uploadingFile}
                  className="border-gray-200"
                />
                {uploadingFile && (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Supported: TXT, VTT, SRT (max 5 MB)
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="flex items-center gap-4">
              <Button
                type="submit"
                disabled={loading}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Analyze Transcript
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={loading}
                onClick={() => {
                  setTitle('');
                  setTranscript('');
                  setError(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                Clear
              </Button>
            </div>
          </form>
        </>
      ) : (
        <>
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Who are you in this meeting?</h1>
            <p className="mt-1 text-sm text-gray-500">
              Select which participant is you so we can identify your commitments correctly.
            </p>
            {isDemoMode && (
              <div className="mt-3 inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                📋 Demo Mode
              </div>
            )}
          </div>

          <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
                <Users className="h-5 w-5" />
                Meeting Participants
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {participants.map((participant) => (
                  <button
                    key={participant}
                    onClick={() => setSelectedParticipant(participant)}
                    className={`rounded-lg border-2 p-4 text-center transition-all ${
                      selectedParticipant === participant
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="text-lg font-semibold text-gray-900">{participant}</div>
                    {selectedParticipant === participant && (
                      <Badge className="mt-2 bg-blue-600">That's me</Badge>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="mb-6 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={handleSubmitWithParticipant}
                disabled={loading || !selectedParticipant}
                className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Extracting...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Extract Commitments
                  </>
                )}
              </Button>
              <Button
                onClick={handleBackToInput}
                disabled={loading}
                variant="outline"
                className="border-gray-200"
              >
                Back
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function NewMeetingPage() {
  return <NewMeetingContent />;
}
