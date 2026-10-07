'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  FileText,
  Sparkles,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { useAuthFetch } from '@/hooks/use-auth-fetch';
import { LoadingExtraction } from '@/components/loading';

const EXAMPLE_TRANSCRIPT = `Priya: Alright, let's talk about the launch timeline. We have 4 weeks to ship the mobile app update.
Vikram: I can have the database migration ready by October 8th. After that, Rahul can start the API integration.
Rahul: Sure, once Vikram finishes the migration, I'll handle the API endpoints. I can knock that out in 3 days, so by October 11th.
Priya: Perfect. Ananya, can you work on the mobile UI components?
Ananya: I'll have the UI components and design system updated by October 10th. But I'll need the final API spec by October 9th at the latest.
Rahul: I'll send you the API spec by October 9th morning.
Vikram: One more thing — I'll also update the database documentation by end of week.
Priya: Great. We'll schedule a final integration test meeting for October 15th to verify everything works together.`;

const DEMO_TITLE = 'Q4 Mobile App Launch - Technical Planning';
const SUPPORTED_TYPES = ['.txt', '.vtt', '.srt'];
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MIN_TRANSCRIPT_CHARS = 50;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/** Speaker name -> number of lines they speak. Lines look like "Priya: ...". */
function countSpeakers(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  const regex = /^([A-Za-z]+):\s/gm;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    counts.set(match[1], (counts.get(match[1]) ?? 0) + 1);
  }
  return counts;
}

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const getInitials = (name: string) => name.slice(0, 2).toUpperCase();

type Step = 'input' | 'participant-select';
type FieldErrors = { title?: string; transcript?: string };
type LoadedFile = { name: string; size: number };

/* -------------------------------------------------------------------------- */
/* Stepper                                                                    */
/* -------------------------------------------------------------------------- */

const STEPS = ['Add transcript', 'Choose your name', 'Extract'];

function Stepper({ current }: { current: number }) {
  return (
    <ol className="mb-8 flex items-center" aria-label="Progress">
      {STEPS.map((label, index) => {
        const done = index < current;
        const active = index === current;

        return (
          <li
            key={label}
            className={`flex items-center ${index < STEPS.length - 1 ? 'flex-1' : ''}`}
            aria-current={active ? 'step' : undefined}
          >
            <span className="flex items-center gap-2.5">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors duration-300 ${
                  done
                    ? 'bg-status-done text-white'
                    : active
                      ? 'bg-primary text-primary-foreground shadow-gold'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span
                className={`hidden text-sm font-medium sm:inline ${
                  active ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                {label}
              </span>
            </span>

            {index < STEPS.length - 1 && (
              <span
                aria-hidden
                className={`mx-3 h-px flex-1 transition-colors duration-300 ${
                  done ? 'bg-status-done' : 'bg-border'
                }`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

function NewMeetingContent() {
  const router = useRouter();
  const authFetch = useAuthFetch();

  const [title, setTitle] = useState('');
  const [transcript, setTranscript] = useState('');
  const [selectedParticipant, setSelectedParticipant] = useState('');
  const [step, setStep] = useState<Step>('input');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [demoLoaded, setDemoLoaded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [fileProgress, setFileProgress] = useState<number | null>(null);
  const [previewExpanded, setPreviewExpanded] = useState(false);

  // Demo mode only applies while the untouched sample transcript is in the box.
  // Previously it stayed on after the sample was edited or replaced.
  const isDemoMode = demoLoaded && transcript === EXAMPLE_TRANSCRIPT;

  const speakers = useMemo(() => countSpeakers(transcript), [transcript]);
  const participants = useMemo(() => Array.from(speakers.keys()).sort(), [speakers]);
  const lineCount = useMemo(
    () => transcript.split('\n').filter((line) => line.trim()).length,
    [transcript],
  );

  const trimmedLength = transcript.trim().length;
  const noSpeakersDetected = trimmedLength >= MIN_TRANSCRIPT_CHARS && participants.length === 0;

  /* ------------------------------- Handlers ------------------------------ */

  const handleAnalyzeTranscript = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const errors: FieldErrors = {};
    if (!title.trim()) errors.title = 'Enter a meeting title.';

    if (!transcript.trim()) {
      errors.transcript = 'Paste a transcript or drop a file.';
    } else if (trimmedLength < MIN_TRANSCRIPT_CHARS) {
      errors.transcript =
        'This transcript is too short. Include at least a few exchanges between participants.';
    } else if (participants.length === 0) {
      errors.transcript =
        'No speakers found. Start each line with a name and a colon, like "Priya: I will send the update."';
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setStep('participant-select');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmitWithParticipant = async () => {
    if (!selectedParticipant) {
      setError('Choose which participant is you.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const trimmedTranscript = transcript.trim();
      if (trimmedTranscript.length < MIN_TRANSCRIPT_CHARS) {
        setError(
          'This transcript is too short. Include at least a few exchanges between participants.',
        );
        setLoading(false);
        return;
      }

      // Demo mode uses a simple endpoint that doesn't require auth.
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
        setError(
          data.error ||
            (res.status === 429
              ? 'Too many requests. Wait a moment, then try again.'
              : 'Extraction failed. Try again, or go back and check the transcript.'),
        );
        setLoading(false);
        return;
      }

      // Demo mode: hand the results to the demo results page.
      if (isDemoMode && data.demo) {
        sessionStorage.setItem('demoMeetingTitle', title.trim());
        sessionStorage.setItem('demoCommitments', JSON.stringify(data.commitments));
        sessionStorage.setItem('demoYourName', selectedParticipant);
        router.push('/demo-results');
        return;
      }

      // Extraction failed but the meeting was saved.
      if (data.warning) {
        console.warn('Extraction warning:', data.warning);
        setError(data.warning);
        setLoading(false);
        return;
      }

      router.push(`/meetings/${data.meeting.id}`);
    } catch (err) {
      console.error('Extract error:', err);

      if (err instanceof TypeError) {
        setError('Network error. Check your connection and try again.');
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
    setError(null);
    setPreviewExpanded(false);
  };

  const handleTryDemo = () => {
    setDemoLoaded(true);
    setTitle(DEMO_TITLE);
    setTranscript(EXAMPLE_TRANSCRIPT);
    setFile(null);
    setError(null);
    setFieldErrors({});
    setStep('input');
  };

  const handleClear = () => {
    setTitle('');
    setTranscript('');
    setFile(null);
    setDemoLoaded(false);
    setError(null);
    setFieldErrors({});
  };

  const processFile = (picked: File) => {
    setError(null);
    setFieldErrors((prev) => ({ ...prev, transcript: undefined }));

    const lowerName = picked.name.toLowerCase();
    if (!SUPPORTED_TYPES.some((type) => lowerName.endsWith(type))) {
      setFieldErrors((prev) => ({
        ...prev,
        transcript: `${picked.name} is not a supported format. Use a TXT, VTT or SRT file.`,
      }));
      return;
    }

    if (picked.size > MAX_FILE_BYTES) {
      setFieldErrors((prev) => ({
        ...prev,
        transcript: `This file is ${formatSize(picked.size)}. The limit is 5 MB.`,
      }));
      return;
    }

    const reader = new FileReader();
    setFileProgress(0);

    reader.onprogress = (event) => {
      if (event.lengthComputable) {
        setFileProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    reader.onerror = () => {
      setFileProgress(null);
      setFieldErrors((prev) => ({
        ...prev,
        transcript: 'The file could not be read. Try again, or paste the text instead.',
      }));
    };

    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      setFileProgress(null);

      if (!content.trim()) {
        setFieldErrors((prev) => ({
          ...prev,
          transcript: 'This file is empty. Choose a transcript with content.',
        }));
        return;
      }

      setTranscript(content);
      setFile({ name: picked.name, size: picked.size });
      setDemoLoaded(false);

      // Fill the title from the file name if the person hasn't typed one.
      if (!title.trim()) {
        setTitle(picked.name.replace(/\.(txt|vtt|srt)$/i, '').replace(/[-_]/g, ' '));
        setFieldErrors((prev) => ({ ...prev, title: undefined }));
      }
    };

    reader.readAsText(picked);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (picked) processFile(picked);
    // Reset so choosing the same file again still fires onChange.
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) processFile(dropped);
  };

  const removeFile = () => {
    setFile(null);
    setTranscript('');
    setFieldErrors((prev) => ({ ...prev, transcript: undefined }));
  };

  /* -------------------------------- Render ------------------------------- */

  // Extraction progress screen
  if (loading && step === 'participant-select') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Stepper current={2} />
        <div className="flex min-h-[50vh] items-center justify-center">
          <LoadingExtraction />
        </div>
      </div>
    );
  }

  const previewLines = transcript.split('\n').filter((line) => line.trim());

  return (
    <div className="page-enter mx-auto max-w-3xl px-4 py-10">
      <Stepper current={step === 'input' ? 0 : 1} />

      {step === 'input' ? (
        <>
          <div className="mb-8">
            <h1 className="text-3xl sm:text-4xl">New meeting</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Add a transcript and FollowThru pulls out every commitment, who made it, and
              when it&apos;s due.
            </p>
          </div>

          {/* Sample transcript */}
          <div className="card-classic card-static mb-8 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-sans text-base font-semibold tracking-tight">
                No transcript handy?
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Load a sample four-person planning meeting to see how commitments are tracked.
              </p>
            </div>
            <button
              type="button"
              onClick={handleTryDemo}
              disabled={loading}
              className="btn-outline shrink-0"
            >
              Load sample
            </button>
          </div>

          <form onSubmit={handleAnalyzeTranscript} className="space-y-6" noValidate>
            {/* Title */}
            <div>
              <label htmlFor="title" className="label-classic required-mark">
                Meeting title
              </label>
              <input
                id="title"
                className="field"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (fieldErrors.title) setFieldErrors((p) => ({ ...p, title: undefined }));
                }}
                placeholder="e.g. Weekly team sync, Sept 22"
                aria-invalid={!!fieldErrors.title}
                aria-describedby={fieldErrors.title ? 'title-error' : undefined}
                data-valid={!fieldErrors.title && title.trim().length > 0}
                disabled={loading}
              />
              {fieldErrors.title && (
                <p id="title-error" className="field-message" data-tone="overdue">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {fieldErrors.title}
                </p>
              )}
            </div>

            {/* Transcript */}
            <div>
              <span className="label-classic required-mark">Transcript</span>

              {file ? (
                <div className="card-classic card-static flex items-center gap-3 p-4" data-status="done">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-status-done-soft text-status-done">
                    <FileText className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-status-done">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Loaded · {formatSize(file.size)} · {lineCount} lines
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={removeFile}
                    className="btn-ghost btn-sm"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="h-4 w-4" />
                    Remove
                  </button>
                </div>
              ) : (
                <label
                  htmlFor="transcript-file"
                  className="dropzone cursor-pointer py-8 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
                  data-dragging={dragging}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
                  }}
                  onDrop={handleDrop}
                >
                  <input
                    id="transcript-file"
                    type="file"
                    accept=".txt,.vtt,.srt"
                    className="sr-only"
                    onChange={handleFileInput}
                    disabled={loading || fileProgress !== null}
                  />
                  <span
                    className={`flex h-12 w-12 items-center justify-center rounded-full bg-gold/15 text-gold-dark dark:text-gold-light ${
                      dragging ? 'animate-bounce-subtle' : ''
                    }`}
                  >
                    <Upload className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {dragging ? 'Drop to upload' : 'Drop a transcript file here, or '}
                    {!dragging && (
                      <span className="underline underline-offset-4">browse</span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    TXT, VTT or SRT · up to 5 MB
                  </span>

                  {fileProgress !== null && (
                    <span className="mt-3 block w-full max-w-xs" role="status">
                      <span className="progress block">
                        <span style={{ width: `${fileProgress}%` }} />
                      </span>
                      <span className="mt-1.5 block text-xs text-muted-foreground">
                        Reading file... {fileProgress}%
                      </span>
                    </span>
                  )}
                </label>
              )}

              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground" aria-hidden>
                <span className="h-px flex-1 bg-border" />
                or paste the text
                <span className="h-px flex-1 bg-border" />
              </div>

              <textarea
                id="transcript"
                aria-label="Transcript text"
                className="field min-h-[280px] resize-y font-mono leading-relaxed"
                value={transcript}
                onChange={(e) => {
                  setTranscript(e.target.value);
                  if (file) setFile(null);
                  if (fieldErrors.transcript) setFieldErrors((p) => ({ ...p, transcript: undefined }));
                }}
                placeholder={EXAMPLE_TRANSCRIPT}
                aria-invalid={!!fieldErrors.transcript}
                aria-describedby="transcript-help"
                disabled={loading}
              />

              <div id="transcript-help">
                {fieldErrors.transcript ? (
                  <p className="field-message" data-tone="overdue">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {fieldErrors.transcript}
                  </p>
                ) : noSpeakersDetected ? (
                  <p className="field-message" data-tone="soon">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    No speakers found yet. Start each line with a name and a colon, like
                    &quot;Priya: ...&quot;.
                  </p>
                ) : participants.length > 0 ? (
                  <p className="field-message" data-tone="done">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    {lineCount} lines · {participants.length}{' '}
                    {participants.length === 1 ? 'speaker' : 'speakers'} found:{' '}
                    {participants.join(', ')}
                  </p>
                ) : (
                  <p className="hint">
                    Each line should start with the speaker&apos;s name, like &quot;Priya: ...&quot;.
                  </p>
                )}
              </div>
            </div>

            {error && (
              <div role="alert" className="alert-classic" data-tone="danger">
                {error}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button type="submit" disabled={loading} className="btn-primary btn-lg">
                Continue
                <ArrowRight className="h-4 w-4" />
              </button>
              <button type="button" disabled={loading} onClick={handleClear} className="btn-ghost">
                Clear
              </button>
            </div>
          </form>
        </>
      ) : (
        <>
          <div className="mb-8">
            <h1 className="text-3xl sm:text-4xl">Which one are you?</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We use this to flag the commitments that are yours. Everyone else&apos;s are still
              tracked.
            </p>
            {isDemoMode && (
              <span className="status-badge mt-3" data-status="info">
                Sample meeting
              </span>
            )}
          </div>

          {/* Transcript preview */}
          <div className="card-classic card-static mb-6 overflow-hidden">
            <button
              type="button"
              onClick={() => setPreviewExpanded((prev) => !prev)}
              aria-expanded={previewExpanded}
              className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-foreground">
                  {title.trim()}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {previewLines.length} lines · {participants.length} speakers
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground">
                {previewExpanded ? 'Hide transcript' : 'Preview transcript'}
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-300 ${
                    previewExpanded ? 'rotate-180' : ''
                  }`}
                />
              </span>
            </button>

            <div className="border-t border-border bg-muted/40 px-5 py-4">
              <pre
                className={`m-0 overflow-auto whitespace-pre-wrap border-0 bg-transparent p-0 font-mono text-xs leading-relaxed text-muted-foreground shadow-none ${
                  previewExpanded ? 'max-h-80' : 'max-h-24'
                }`}
              >
                {(previewExpanded ? previewLines : previewLines.slice(0, 4)).join('\n')}
              </pre>
            </div>
          </div>

          {/* Participants */}
          <div className="card-classic card-static mb-6 p-6">
            <h2 className="mb-4 flex items-center gap-2 font-sans text-base font-semibold tracking-tight">
              <Users className="h-4 w-4 text-muted-foreground" />
              Speakers in this meeting
            </h2>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {participants.map((participant) => {
                const selected = selectedParticipant === participant;
                const lines = speakers.get(participant) ?? 0;

                return (
                  <button
                    key={participant}
                    type="button"
                    onClick={() => {
                      setSelectedParticipant(participant);
                      setError(null);
                    }}
                    aria-pressed={selected}
                    className={`relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all duration-200 hover:-translate-y-0.5 ${
                      selected
                        ? 'border-gold bg-gold/10 shadow-gold'
                        : 'border-border bg-card hover:border-gold/50'
                    }`}
                  >
                    {selected && (
                      <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-status-done text-white">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                    <span
                      aria-hidden
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground"
                    >
                      {getInitials(participant)}
                    </span>
                    <span className="text-base font-semibold text-foreground">{participant}</span>
                    <span className="text-xs text-muted-foreground">
                      {selected ? "That's me" : `${lines} ${lines === 1 ? 'line' : 'lines'}`}
                    </span>
                  </button>
                );
              })}
            </div>

            {error && (
              <div role="alert" className="alert-classic mt-6" data-tone="danger">
                {error}
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleSubmitWithParticipant}
                disabled={loading || !selectedParticipant}
                aria-busy={loading}
                className="btn-primary btn-lg flex-1"
              >
                {!loading && <Sparkles className="h-4 w-4" />}
                {loading ? 'Extracting...' : 'Extract commitments'}
              </button>
              <button
                type="button"
                onClick={handleBackToInput}
                disabled={loading}
                className="btn-outline btn-lg"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
            </div>

            <p className="hint mt-3 text-center">
              {selectedParticipant
                ? "Next, you'll see every commitment we found on the meeting page."
                : 'Choose your name to continue.'}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

export default function NewMeetingPage() {
  return <NewMeetingContent />;
}