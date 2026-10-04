'use client';

import { useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronRight, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuthFetch } from '@/hooks/use-auth-fetch';
import { cn } from '@/lib/utils';

export interface AmbiguityData {
  ambiguity_type: 'owner_ambiguous' | 'team_ambiguous' | 'lead_ambiguous';
  candidates: Array<{
    userId?: string;
    displayName: string;
    fullName?: string;
    jobTitle?: string;
    matchConfidence?: number;
    matchReason?: string;
    teamId?: string;
    teamName?: string;
    memberCount?: number;
  }>;
  reason: string;
}

export interface AssignmentTask {
  id: string;
  description: string;
  owner: string;
  source_quote: string;
  assigned_to_user_id?: string;
  team_id?: string;
  team_lead_id?: string;
  needs_assignment_review: boolean;
  assignment_ambiguity_data: AmbiguityData | null;
  meeting_title: string;
  meeting_id: string;
}

interface AssignmentReviewPanelProps {
  taskId: string;
  taskDescription: string;
  owner: string;
  sourceQuote: string;
  meetingTitle: string;
  ambiguityData: AmbiguityData | null;
  onResolved?: (taskId: string) => void;
}

export function AssignmentReviewPanel({
  taskId,
  taskDescription,
  owner,
  sourceQuote,
  meetingTitle,
  ambiguityData,
  onResolved,
}: AssignmentReviewPanelProps) {
  const authFetch = useAuthFetch();
  const [selectedOwner, setSelectedOwner] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!ambiguityData) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-600">No ambiguity data available for this task.</p>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!selectedOwner && !selectedTeam && !selectedLead) {
      setError('Please select at least one option.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = { reason: reason || 'Manually confirmed by user' };

      if (selectedOwner) {
        payload.assigned_to_user_id = selectedOwner;
      }
      if (selectedTeam) {
        payload.team_id = selectedTeam;
      }
      if (selectedLead) {
        payload.team_lead_id = selectedLead;
      }

      const res = await authFetch(`/api/tasks/${taskId}/assign-owner`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to confirm assignment.');
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        onResolved?.(taskId);
      }, 1500);
    } catch (err) {
      console.error('Assignment submission error:', err);
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <Alert className="border-emerald-200 bg-emerald-50">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        <AlertDescription className="text-emerald-800">Assignment confirmed successfully.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-4">
        <h3 className="font-semibold text-slate-900">Assignment Review</h3>
        <p className="mt-1 text-sm text-slate-600">{meetingTitle}</p>
      </div>

      <div className="space-y-6 px-6 py-4">
        {/* Task Details */}
        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium text-slate-500">COMMITMENT</p>
            <p className="mt-1 text-sm text-slate-900">{taskDescription}</p>
          </div>

          {sourceQuote && (
            <div>
              <p className="text-xs font-medium text-slate-500">SOURCE QUOTE</p>
              <p className="mt-1 rounded bg-slate-50 p-2.5 font-mono text-xs text-slate-700 italic">
                {sourceQuote}
              </p>
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-slate-500">EXTRACTED OWNER</p>
            <p className="mt-1 text-sm text-slate-900">{owner}</p>
          </div>
        </div>

        {/* Ambiguity Resolution */}
        <div className="space-y-4 border-t border-slate-200 pt-4">
          <p className="text-sm font-medium text-slate-900">Please confirm the correct assignment:</p>

          {/* Owner Selection */}
          {ambiguityData.ambiguity_type === 'owner_ambiguous' && ambiguityData.candidates.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-slate-600">SELECT OWNER</p>
              <div className="space-y-2">
                {ambiguityData.candidates.map((candidate) => (
                  <button
                    key={candidate.userId}
                    type="button"
                    onClick={() => setSelectedOwner(candidate.userId || null)}
                    className={cn(
                      'w-full rounded border px-3 py-2 text-left text-sm transition-colors',
                      selectedOwner === candidate.userId
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-900 hover:border-slate-300',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{candidate.displayName}</p>
                        {candidate.fullName && candidate.fullName !== candidate.displayName && (
                          <p className="text-xs text-slate-500">{candidate.fullName}</p>
                        )}
                        {candidate.jobTitle && (
                          <p className="mt-0.5 text-xs text-slate-500">{candidate.jobTitle}</p>
                        )}
                      </div>
                      {candidate.matchConfidence !== undefined && (
                        <div className="shrink-0 rounded bg-slate-100 px-2 py-1 text-xs font-medium">
                          {Math.round(candidate.matchConfidence * 100)}%
                        </div>
                      )}
                    </div>
                    {candidate.matchReason && (
                      <p className="mt-1 text-xs text-slate-500">Match: {candidate.matchReason}</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Team Selection */}
          {ambiguityData.ambiguity_type === 'team_ambiguous' && ambiguityData.candidates.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-slate-600">SELECT TEAM</p>
              <div className="space-y-2">
                {ambiguityData.candidates.map((candidate) => (
                  <button
                    key={candidate.teamId}
                    type="button"
                    onClick={() => setSelectedTeam(candidate.teamId || null)}
                    className={cn(
                      'w-full rounded border px-3 py-2 text-left text-sm transition-colors',
                      selectedTeam === candidate.teamId
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-900 hover:border-slate-300',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{candidate.teamName}</p>
                      <span className="text-xs text-slate-500">{candidate.memberCount} members</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Team Lead Selection */}
          {ambiguityData.ambiguity_type === 'lead_ambiguous' && ambiguityData.candidates.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-slate-600">SELECT TEAM LEAD</p>
              <div className="space-y-2">
                {ambiguityData.candidates.map((candidate) => (
                  <button
                    key={candidate.userId}
                    type="button"
                    onClick={() => setSelectedLead(candidate.userId || null)}
                    className={cn(
                      'w-full rounded border px-3 py-2 text-left text-sm transition-colors',
                      selectedLead === candidate.userId
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-900 hover:border-slate-300',
                    )}
                  >
                    <div>
                      <p className="font-medium">{candidate.displayName}</p>
                      {candidate.fullName && candidate.fullName !== candidate.displayName && (
                        <p className="text-xs text-slate-500">{candidate.fullName}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Ambiguity Reason */}
          <div className="rounded bg-amber-50 p-3">
            <div className="flex gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-xs text-amber-800">{ambiguityData.reason}</p>
            </div>
          </div>

          {/* Optional Reason Input */}
          <div>
            <label className="text-xs font-medium text-slate-600">
              Notes (optional)
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why did you choose this assignment?"
                className="mt-1 block w-full rounded border border-slate-200 px-3 py-2 text-sm placeholder-slate-400 focus:border-slate-900 focus:outline-none"
                rows={2}
              />
            </label>
          </div>
        </div>

        {/* Error */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Actions */}
        <div className="flex gap-2 border-t border-slate-200 pt-4">
          <Button
            onClick={handleSubmit}
            disabled={submitting || (!selectedOwner && !selectedTeam && !selectedLead)}
            className="flex-1"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Confirming...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Confirm Assignment
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
