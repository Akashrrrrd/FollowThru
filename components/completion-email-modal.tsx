'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  Loader2,
  Mail,
  Pencil,
  RefreshCw,
  Send,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuthFetch } from '@/hooks/use-auth-fetch';

interface CompletionEmailModalProps {
  open: boolean;
  taskId: string;
  taskDescription: string;
  onClose: () => void;
  onSend?: () => Promise<void>;
  defaultRecipients?: string[];
}

type Phase = 'idle' | 'loading' | 'ready' | 'error' | 'sent';
type Mode = 'edit' | 'preview';

/** Fallback when the API only returns HTML: convert to readable plain text. */
function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** The AI often returns Markdown (**bold**, * bullets). Emails should be plain text. */
function stripMarkdown(text: string): string {
  return text
    .replace(/^\s*[*•]\s+/gm, '- ') // "* item" -> "- item"
    .replace(/^#{1,6}\s+/gm, '') // headings
    .replace(/\*\*(.+?)\*\*/g, '$1') // **bold**
    .replace(/__(.+?)__/g, '$1') // __bold__
    .replace(/\*(?!\s)(.+?)\*/g, '$1') // *italic*
    .replace(/`([^`]+)`/g, '$1') // `code`
    .replace(/\*/g, '') // any stray asterisks
    .trim();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function RecipientInput({
  recipients,
  onChange,
}: {
  recipients: string[];
  onChange: (r: string[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const [invalid, setInvalid] = useState<string | null>(null);

  const commit = (raw: string) => {
    const parts = raw.split(/[\s,;]+/).map((p) => p.trim()).filter(Boolean);
    if (!parts.length) return;
    const bad = parts.find((p) => !EMAIL_RE.test(p));
    if (bad) {
      setInvalid(`"${bad}" is not a valid email address.`);
      return;
    }
    onChange(Array.from(new Set([...recipients, ...parts.map((p) => p.toLowerCase())])));
    setDraft('');
    setInvalid(null);
  };

  return (
    <div className="border-b border-slate-100 px-5 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-16 text-xs font-medium uppercase tracking-wider text-slate-500">To</span>
        {recipients.map((email) => (
          <span
            key={email}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 py-0.5 pl-2.5 pr-1 text-xs font-medium text-slate-700"
          >
            {email}
            <button
              type="button"
              aria-label={`Remove ${email}`}
              onClick={() => onChange(recipients.filter((r) => r !== email))}
              className="rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setInvalid(null);
          }}
          onKeyDown={(e) => {
            if (['Enter', ',', ';', ' '].includes(e.key) && draft.trim()) {
              e.preventDefault();
              commit(draft);
            } else if (e.key === 'Backspace' && !draft && recipients.length) {
              onChange(recipients.slice(0, -1));
            }
          }}
          onBlur={() => draft.trim() && commit(draft)}
          onPaste={(e) => {
            e.preventDefault();
            commit(e.clipboardData.getData('text'));
          }}
          placeholder={recipients.length ? 'Add another…' : 'name@company.com'}
          aria-label="Add recipient email"
          className="min-w-[180px] flex-1 border-0 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
        />
      </div>
      {invalid ? (
        <p className="ml-[72px] mt-1.5 text-xs text-red-600">{invalid}</p>
      ) : (
        !recipients.length && (
          <p className="ml-[72px] mt-1.5 text-xs text-slate-500">
            Optional. Leave empty to use the default: HR and the responsible parties.
          </p>
        )
      )}
    </div>
  );
}

export function CompletionEmailModal({
  open,
  taskId,
  taskDescription,
  onClose,
  onSend,
  defaultRecipients = [],
}: CompletionEmailModalProps) {
  const authFetch = useAuthFetch();
  // Latest authFetch kept in a ref so it never retriggers effects.
  const authFetchRef = useRef(authFetch);
  useEffect(() => {
    authFetchRef.current = authFetch;
  }, [authFetch]);

  const [phase, setPhase] = useState<Phase>('idle');
  const [mode, setMode] = useState<Mode>('edit');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [recipients, setRecipients] = useState<string[]>(defaultRecipients);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const generateEmail = useCallback(async () => {
    setPhase('loading');
    setError(null);
    try {
      const res = await authFetchRef.current('/api/completion-notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: taskId,
          action: 'generate_email',
          recipient_name: 'Team',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate email');

      const text: string =
        data.body ||
        data.email_text ||
        (data.email_html ? htmlToText(data.email_html) : '') ||
        'No content generated';

      setSubject(stripMarkdown(data.subject || 'Completion Confirmation'));
      setBody(stripMarkdown(text));
      setPhase('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate email');
      setPhase('error');
    }
  }, [taskId]);

  // Auto-generate once when the modal first opens (and nothing exists yet).
  useEffect(() => {
    if (open && phase === 'idle') generateEmail();
  }, [open, phase, generateEmail]);

  // Auto-grow the textarea so the whole email is visible without inner scrolling.
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [body, mode, phase, open]);

  const handleSendEmail = async () => {
    if (!subject.trim() || !body.trim()) {
      setError('Subject and message cannot be empty.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await authFetchRef.current('/api/completion-notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: taskId,
          status: 'sent',
          // Edited content; only used if your PATCH handler reads these fields.
          subject: subject.trim(),
          body: body.trim(),
          recipients, // empty = server default (HR + responsible parties)
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send email');

      setPhase('sent');
      if (onSend) await onSend();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  const words = body.trim() ? body.trim().split(/\s+/).length : 0;
  const isLoading = phase === 'idle' || phase === 'loading';

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !sending && onClose()}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="space-y-1.5 border-b border-slate-200 px-6 py-5 text-left">
          <DialogTitle className="text-xl font-semibold tracking-tight text-slate-900">
            Completion Notification
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-600">
            Review and edit the AI-generated email before it is sent.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto bg-slate-50/60 px-6 py-5">
          {/* Task summary */}
          <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50/70 px-4 py-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Completed task</p>
              <p className="mt-0.5 text-sm font-medium text-slate-900">{taskDescription}</p>
            </div>
          </div>

          {isLoading && (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-6" aria-busy="true">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Drafting your email…
              </div>
              {[100, 92, 96, 70, 84].map((w, i) => (
                <div key={i} className="h-3 animate-pulse rounded bg-slate-100" style={{ width: `${w}%` }} />
              ))}
            </div>
          )}

          {phase === 'error' && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-5">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-900">Couldn&apos;t generate the draft</p>
                  <p className="mt-1 text-sm text-red-700">{error}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={generateEmail}
                    className="mt-3 border-red-200 text-red-700"
                  >
                    <RefreshCw className="mr-2 h-3.5 w-3.5" aria-hidden />
                    Try again
                  </Button>
                </div>
              </div>
            </div>
          )}

          {phase === 'sent' && (
            <div className="flex flex-col items-center rounded-lg border border-emerald-200 bg-white py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                <Check className="h-6 w-6 text-emerald-600" aria-hidden />
              </div>
              <p className="mt-4 text-base font-semibold text-slate-900">Email sent</p>
              <p className="mt-1 text-sm text-slate-600">HR and the responsible parties have been notified.</p>
            </div>
          )}

          {phase === 'ready' && (
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Email draft</span>
                <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5">
                  {(['edit', 'preview'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMode(m)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors',
                        mode === m ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900',
                      )}
                    >
                      {m === 'edit' ? (
                        <Pencil className="h-3 w-3" aria-hidden />
                      ) : (
                        <Eye className="h-3 w-3" aria-hidden />
                      )}
                      {m === 'edit' ? 'Edit' : 'Preview'}
                    </button>
                  ))}
                </div>
              </div>

              <RecipientInput recipients={recipients} onChange={setRecipients} />

              {mode === 'edit' ? (
                <>
                  <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-2">
                    <label
                      htmlFor="email-subject"
                      className="w-16 text-xs font-medium uppercase tracking-wider text-slate-500"
                    >
                      Subject
                    </label>
                    <Input
                      id="email-subject"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="border-0 px-0 text-sm font-medium shadow-none focus-visible:ring-0"
                    />
                  </div>
                  <textarea
                    ref={bodyRef}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    aria-label="Email body"
                    className="block max-h-[50vh] min-h-[280px] w-full resize-none overflow-y-auto border-0 bg-white px-5 py-4 text-[15px] leading-7 text-slate-800 outline-none focus:ring-0"
                  />
                </>
              ) : (
                <div className="max-h-[55vh] overflow-y-auto px-5 py-5">
                  <p className="text-base font-semibold text-slate-900">{subject || '(No subject)'}</p>
                  <hr className="my-4 border-slate-200" />
                  <div className="whitespace-pre-wrap break-words font-serif text-[15px] leading-7 text-slate-800">
                    {body}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-5 py-2 text-xs text-slate-500">
                <span>{words} words</span>
                <span>
                  {recipients.length
                    ? `${recipients.length} recipient${recipients.length > 1 ? 's' : ''}`
                    : 'Default: HR and responsible parties'}
                </span>
              </div>
            </div>
          )}

          {phase === 'ready' && error && (
            <p className="flex items-center gap-2 text-sm text-red-600" role="alert">
              <AlertCircle className="h-4 w-4" aria-hidden />
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 border-t border-slate-200 bg-white px-6 py-4 sm:justify-between">
          {phase === 'sent' ? (
            <Button onClick={onClose} className="ml-auto bg-emerald-600 text-white hover:bg-emerald-700">
              Close
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                disabled={phase !== 'ready'}
                className="text-slate-600"
              >
                {copied ? <Check className="mr-2 h-4 w-4" aria-hidden /> : <Copy className="mr-2 h-4 w-4" aria-hidden />}
                {copied ? 'Copied' : 'Copy email'}
              </Button>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={phase !== 'ready'}
                  onClick={() => {
                    const href = `mailto:${recipients.join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                    window.location.href = href;
                  }}
                >
                  <Mail className="mr-2 h-4 w-4" aria-hidden />
                  Open in email app
                </Button>
                <Button type="button" variant="outline" onClick={onClose} disabled={sending}>
                  Skip
                </Button>
                <Button
                  type="button"
                  onClick={handleSendEmail}
                  disabled={phase !== 'ready' || sending}
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  {sending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Send className="mr-2 h-4 w-4" aria-hidden />
                  )}
                  {sending ? 'Sending…' : 'Send email'}
                </Button>
              </div>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}