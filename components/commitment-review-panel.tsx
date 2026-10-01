'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, Clock, CheckCircle2, Loader2, Edit3 } from 'lucide-react';

interface CommitmentReviewPanelProps {
  taskId: string;
  taskDescription: string;
  owner: string;
  meetingTitle: string;
  sourceQuote: string;
  hallucinationReason: string;
  confidence: number;
  graceUntil: Date;
}

export function CommitmentReviewPanel({
  taskId,
  taskDescription,
  owner,
  meetingTitle,
  sourceQuote,
  hallucinationReason,
  confidence,
  graceUntil,
}: CommitmentReviewPanelProps) {
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [rephrased, setRephrased] = useState(taskDescription);
  const [action, setAction] = useState<'approve' | 'dismiss' | 'rephrase' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Calculate time remaining in grace period
  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const diff = graceUntil.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining('Grace period expired');
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeRemaining(`${minutes}m ${seconds}s remaining`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [graceUntil]);

  const handleApprove = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/commitments/${taskId}/hallucination-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to approve');
      }

      setSuccess(true);
      setAction('approve');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error approving commitment');
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  const handleDismiss = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/commitments/${taskId}/hallucination-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'dismiss',
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to dismiss');
      }

      setSuccess(true);
      setAction('dismiss');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error dismissing commitment');
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  const handleRephrase = useCallback(async () => {
    if (!rephrased || rephrased === taskDescription) {
      setError('Please enter a different description');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/commitments/${taskId}/hallucination-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rephrase',
          new_description: rephrased,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to rephrase');
      }

      setSuccess(true);
      setAction('rephrase');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error rephrasing commitment');
    } finally {
      setLoading(false);
    }
  }, [taskId, rephrased, taskDescription]);

  if (success) {
    const actionMessages = {
      approve: 'Commitment approved as-is',
      dismiss: 'Commitment dismissed',
      rephrase: 'Commitment rephrased and saved',
    };

    return (
      <Alert className="bg-green-50 border-green-200">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800">
          {action ? actionMessages[action] : 'Action completed'}
        </AlertDescription>
      </Alert>
    );
  }

  const confidenceColor =
    confidence > 0.7 ? 'text-red-600' : confidence > 0.4 ? 'text-yellow-600' : 'text-green-600';

  return (
    <div className="space-y-6">
      <Alert className="bg-blue-50 border-blue-200">
        <AlertCircle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-900">
          This commitment may not exist in the meeting transcript. You have{' '}
          <strong className="flex items-center gap-1 inline">
            <Clock className="h-3 w-3" />
            {timeRemaining}
          </strong>{' '}
          to review and decide.
        </AlertDescription>
      </Alert>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>Hallucination Detection</CardTitle>
              <p className="text-sm text-gray-600 mt-2">Meeting: {meetingTitle}</p>
            </div>
            <div className="text-right">
              <Badge variant={confidence > 0.6 ? 'destructive' : 'outline'}>
                {(confidence * 100).toFixed(0)}% likely hallucination
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Original Commitment */}
          <div>
            <label className="text-sm font-medium text-gray-700">Original Commitment</label>
            <div className="mt-2 p-3 bg-gray-50 rounded border border-gray-200">
              <p className="text-sm font-semibold text-gray-900">{taskDescription}</p>
              <p className="text-xs text-gray-600 mt-2">Owner: {owner}</p>
            </div>
          </div>

          {/* Why It Was Flagged */}
          <div>
            <label className="text-sm font-medium text-gray-700">Why It Was Flagged</label>
            <div className="mt-2 p-3 bg-amber-50 rounded border border-amber-200">
              <p className="text-sm text-gray-700">{hallucinationReason}</p>
            </div>
          </div>

          {/* Source Quote */}
          {sourceQuote && (
            <div>
              <label className="text-sm font-medium text-gray-700">Source Quote from Transcript</label>
              <div className="mt-2 p-3 bg-blue-50 rounded border border-blue-200">
                <p className="text-sm italic text-gray-700">"{sourceQuote}"</p>
              </div>
            </div>
          )}

          {/* Options */}
          <div className="border-t pt-6 space-y-4">
            <p className="text-sm font-medium text-gray-900">What would you like to do?</p>

            {/* Option 1: Approve */}
            <div className="p-4 border rounded-lg hover:bg-green-50 transition">
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  id="approve"
                  name="action"
                  value="approve"
                  checked={action === 'approve' || (!action && false)}
                  onChange={() => setAction('approve')}
                  className="mt-1"
                />
                <div className="flex-1">
                  <label htmlFor="approve" className="font-medium cursor-pointer">
                    Approve as-is ✓
                  </label>
                  <p className="text-sm text-gray-600 mt-1">
                    Keep the commitment exactly as extracted. The system may have been wrong.
                  </p>
                </div>
              </div>
            </div>

            {/* Option 2: Dismiss */}
            <div className="p-4 border rounded-lg hover:bg-red-50 transition">
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  id="dismiss"
                  name="action"
                  value="dismiss"
                  checked={action === 'dismiss' || (!action && false)}
                  onChange={() => setAction('dismiss')}
                  className="mt-1"
                />
                <div className="flex-1">
                  <label htmlFor="dismiss" className="font-medium cursor-pointer">
                    Dismiss ✕
                  </label>
                  <p className="text-sm text-gray-600 mt-1">
                    Delete this commitment. It does not belong in the system.
                  </p>
                </div>
              </div>
            </div>

            {/* Option 3: Rephrase */}
            <div className="p-4 border rounded-lg hover:bg-blue-50 transition">
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  id="rephrase"
                  name="action"
                  value="rephrase"
                  checked={action === 'rephrase'}
                  onChange={() => setAction('rephrase')}
                  className="mt-1"
                />
                <div className="flex-1">
                  <label htmlFor="rephrase" className="font-medium cursor-pointer">
                    Rephrase ✎
                  </label>
                  <p className="text-sm text-gray-600 mt-1">
                    Edit the description to better match what was actually committed.
                  </p>
                  {action === 'rephrase' && (
                    <Textarea
                      value={rephrased}
                      onChange={(e) => setRephrased(e.target.value)}
                      placeholder="Enter the corrected commitment description"
                      rows={3}
                      className="mt-3"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <Button onClick={handleApprove} disabled={action !== 'approve' || loading}>
              {loading && action === 'approve' ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Approving...
                </>
              ) : (
                'Approve'
              )}
            </Button>
            <Button onClick={handleDismiss} variant="destructive" disabled={action !== 'dismiss' || loading}>
              {loading && action === 'dismiss' ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Dismissing...
                </>
              ) : (
                'Dismiss'
              )}
            </Button>
            <Button onClick={handleRephrase} variant="outline" disabled={action !== 'rephrase' || loading}>
              {loading && action === 'rephrase' ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Edit3 className="h-4 w-4 mr-2" />
                  Rephrase
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
