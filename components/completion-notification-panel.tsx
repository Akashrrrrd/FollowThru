'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Send, Edit2, Eye, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';

interface CompletionNotificationPanelProps {
  taskId: string;
  taskDescription: string;
  owner: string;
  completionDate: string;
  meetingContext?: string;
  sourceQuote?: string;
}

interface EmailDraft {
  id: string;
  subject: string;
  body: string;
  recipientName: string;
  recipientEmail: string;
  status: 'draft' | 'sent';
}

export function CompletionNotificationPanel({
  taskId,
  taskDescription,
  owner,
  completionDate,
  meetingContext = '',
  sourceQuote = '',
}: CompletionNotificationPanelProps) {
  const [responsiblePerson, setResponsiblePerson] = useState({ name: '', email: '' });
  const [emailDraft, setEmailDraft] = useState<EmailDraft | null>(null);
  const [editingEmail, setEditingEmail] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSaveResponsiblePerson = useCallback(async () => {
    if (!responsiblePerson.name || !responsiblePerson.email) {
      setError('Name and email are required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/responsible-persons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: taskId,
          name: responsiblePerson.name,
          email: responsiblePerson.email,
        }),
      });

      if (!res.ok) throw new Error('Failed to save responsible person');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error saving responsible person');
    } finally {
      setLoading(false);
    }
  }, [taskId, responsiblePerson]);

  const handleGenerateEmail = useCallback(async () => {
    if (!responsiblePerson.email) {
      setError('Responsible person not set');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Generate email content
      const subject = `Completion Confirmation: ${taskDescription.substring(0, 50)}...`;
      const body = `
Dear ${responsiblePerson.name},

We wanted to confirm that the following commitment has been completed:

**Task:** ${taskDescription}
**Owner:** ${owner}
**Completion Date:** ${completionDate}

${meetingContext ? `**Meeting Context:**\n${meetingContext}\n` : ''}

${sourceQuote ? `**Original Commitment:**\n"${sourceQuote}"\n` : ''}

Thank you for your attention to this matter.

Best regards,
FollowThru Team
      `.trim();

      // Create draft notification
      const res = await fetch('/api/completion-notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: taskId,
          recipient_email: responsiblePerson.email,
          recipient_name: responsiblePerson.name,
          subject,
          email_body: body,
        }),
      });

      if (!res.ok) throw new Error('Failed to create draft');

      const data = await res.json();
      setEmailDraft({
        id: data.id,
        subject,
        body,
        recipientName: responsiblePerson.name,
        recipientEmail: responsiblePerson.email,
        status: 'draft',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error generating email');
    } finally {
      setLoading(false);
    }
  }, [taskId, taskDescription, owner, completionDate, meetingContext, sourceQuote, responsiblePerson]);

  const handleSendEmail = useCallback(async () => {
    if (!emailDraft) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/completion-notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notification_id: emailDraft.id,
          action: 'send',
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to send email');
      }

      setSent(true);
      setEmailDraft({ ...emailDraft, status: 'sent' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error sending email');
    } finally {
      setLoading(false);
    }
  }, [emailDraft]);

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {sent && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Email sent successfully!
          </AlertDescription>
        </Alert>
      )}

      {/* Step 1: Responsible Person */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Step 1: Responsible Person</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Name</label>
            <Input
              value={responsiblePerson.name}
              onChange={(e) => setResponsiblePerson({ ...responsiblePerson, name: e.target.value })}
              placeholder="Enter recipient name"
              disabled={!!emailDraft}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Email</label>
            <Input
              type="email"
              value={responsiblePerson.email}
              onChange={(e) => setResponsiblePerson({ ...responsiblePerson, email: e.target.value })}
              placeholder="Enter recipient email"
              disabled={!!emailDraft}
            />
          </div>
          <Button onClick={handleSaveResponsiblePerson} disabled={loading || !!emailDraft}>
            Save Responsible Person
          </Button>
        </CardContent>
      </Card>

      {/* Step 2: Generate Email Draft */}
      {responsiblePerson.email && !emailDraft && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Step 2: Generate Email</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Generate a professional completion email to {responsiblePerson.name}
            </p>
            <Button onClick={handleGenerateEmail} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Generate Draft Email
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Review & Edit Email */}
      {emailDraft && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Step 3: Review & Send</CardTitle>
              <Badge>{emailDraft.status}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">To</label>
              <p className="text-sm text-gray-600">{emailDraft.recipientEmail}</p>
            </div>

            {editingEmail ? (
              <>
                <div>
                  <label className="text-sm font-medium">Subject</label>
                  <Input
                    value={emailDraft.subject}
                    onChange={(e) =>
                      setEmailDraft({ ...emailDraft, subject: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Email Body</label>
                  <Textarea
                    value={emailDraft.body}
                    onChange={(e) =>
                      setEmailDraft({ ...emailDraft, body: e.target.value })
                    }
                    rows={12}
                  />
                </div>
                <Button onClick={() => setEditingEmail(false)} variant="outline">
                  Done Editing
                </Button>
              </>
            ) : (
              <>
                <div>
                  <label className="text-sm font-medium">Subject</label>
                  <p className="text-sm text-gray-800 p-2 bg-gray-50 rounded">
                    {emailDraft.subject}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Preview</label>
                  <div className="text-sm text-gray-800 p-4 bg-gray-50 rounded whitespace-pre-wrap">
                    {emailDraft.body}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setEditingEmail(true)}
                    variant="outline"
                  >
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit Email
                  </Button>
                  <Button
                    onClick={handleSendEmail}
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Send Email
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
