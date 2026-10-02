'use client';

import { useState } from 'react';
import { Loader2, Send, AlertCircle, CheckCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface CompletionEmailModalProps {
  open: boolean;
  taskId: string;
  taskDescription: string;
  onClose: () => void;
  onSend?: () => Promise<void>;
}

export function CompletionEmailModal({
  open,
  taskId,
  taskDescription,
  onClose,
  onSend,
}: CompletionEmailModalProps) {
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [emailContent, setEmailContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleGenerateEmail = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/completion-notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: taskId,
          action: 'generate_email',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to generate email');
      } else {
        setEmailContent(data.email_html || data.email_text || '');
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to generate email'
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleSendEmail = async () => {
    setSending(true);
    setError(null);
    try {
      const res = await fetch('/api/completion-notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: taskId,
          status: 'sent',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to send email');
      } else {
        setSuccess(true);
        if (onSend) await onSend();
        setTimeout(onClose, 2000);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to send email'
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Completion Notification</DialogTitle>
          <DialogDescription>
            Generate and send a completion notification to HR and responsible parties.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {success ? (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Completion email sent successfully!
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Task
                </label>
                <div className="rounded-md bg-gray-50 p-3 text-sm text-gray-600">
                  {taskDescription}
                </div>
              </div>

              {emailContent ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Email Draft (AI Generated)
                  </label>
                  <Textarea
                    value={emailContent}
                    onChange={(e) => setEmailContent(e.target.value)}
                    className="min-h-64 border-gray-200 font-mono text-xs"
                    placeholder="Email will appear here..."
                  />
                  <p className="text-xs text-gray-500">
                    You can edit the email before sending. It will be sent to the HR department and responsible parties.
                  </p>
                </div>
              ) : (
                <div className="rounded-md border-2 border-dashed border-gray-300 p-8 text-center">
                  <p className="text-sm text-gray-600 mb-4">
                    No email draft yet. Click "Generate Email" to create one using AI.
                  </p>
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={onClose}
                  disabled={generating || sending}
                >
                  Skip
                </Button>
                {!emailContent ? (
                  <Button
                    onClick={handleGenerateEmail}
                    disabled={generating}
                    className="bg-blue-600 text-white hover:bg-blue-700"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      'Generate Email'
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={handleSendEmail}
                    disabled={sending}
                    className="bg-green-600 text-white hover:bg-green-700"
                  >
                    {sending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Send Email
                      </>
                    )}
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
