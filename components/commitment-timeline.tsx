'use client';

import { format, parseISO } from 'date-fns';
import { GitBranch, CheckCircle, AlertCircle, Calendar, MessageCircle } from 'lucide-react';
import type { ContinuityEvent } from '@/lib/types';

interface CommitmentTimelineProps {
  events: ContinuityEvent[];
  originalSourceQuote: string;
  originalMeetingDate: string;
  originalOwner: string;
}

export function CommitmentTimeline({
  events,
  originalSourceQuote,
  originalMeetingDate,
  originalOwner,
}: CommitmentTimelineProps) {
  if (events.length === 0) {
    return null;
  }

  const eventTypeLabels: Record<string, { label: string; color: string; icon: any }> = {
    linked: { label: 'Linked', color: 'bg-blue-100 text-blue-700', icon: GitBranch },
    completed: { label: 'Completed', color: 'bg-green-100 text-green-700', icon: CheckCircle },
    rescheduled: { label: 'Rescheduled', color: 'bg-yellow-100 text-yellow-700', icon: Calendar },
    blocked: { label: 'Blocked', color: 'bg-red-100 text-red-700', icon: AlertCircle },
    unblocked: { label: 'Unblocked', color: 'bg-green-100 text-green-700', icon: CheckCircle },
    progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700', icon: MessageCircle },
    updated: { label: 'Updated', color: 'bg-gray-100 text-gray-700', icon: MessageCircle },
  };

  // Sort events by date
  const sortedEvents = [...events].sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return (
    <div className="mt-4 space-y-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
        <GitBranch className="h-4 w-4" />
        Follow-Through History
      </h3>

      <div className="space-y-3 border-l-2 border-gray-200 pl-4">
        {/* Original commitment */}
        <div className="relative -left-5 flex gap-3">
          <div className="mt-1 h-3 w-3 rounded-full bg-gray-400" />
          <div className="flex-1 pb-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">
                {format(parseISO(originalMeetingDate), 'MMM dd, yyyy')}
              </span>
            </div>
            <p className="mt-1 text-sm font-medium text-gray-900">Original commitment</p>
            <blockquote className="mt-1 border-l-2 border-gray-300 pl-2 text-xs italic text-gray-600">
              "{originalSourceQuote}"
            </blockquote>
            <p className="mt-1 text-xs text-gray-500">by {originalOwner}</p>
          </div>
        </div>

        {/* Continuity events */}
        {sortedEvents.map((event) => {
          const eventInfo = eventTypeLabels[event.event_type] || eventTypeLabels.updated;
          const Icon = eventInfo.icon;

          return (
            <div key={event.id} className="relative -left-5 flex gap-3">
              <div className={`mt-1 h-3 w-3 rounded-full ${eventInfo.color}`} />
              <div className="flex-1 pb-3">
                <div className="flex items-center justify-between gap-2">
                  <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${eventInfo.color}`}>
                    <Icon className="mr-1 inline h-3 w-3" />
                    {eventInfo.label}
                  </span>
                  <span className="text-xs font-medium text-gray-500">
                    {format(parseISO(event.created_at), 'MMM dd, yyyy')}
                  </span>
                </div>

                <blockquote className="mt-2 border-l-2 border-gray-300 pl-2 text-xs italic text-gray-600">
                  "{event.source_quote_followup}"
                </blockquote>

                {/* Show matching confidence and evidence for linked events */}
                {event.event_type === 'linked' && event.evidence && (
                  <div className="mt-2 rounded bg-gray-50 p-2 text-xs text-gray-700">
                    <p className="font-medium">
                      Matched with {event.confidence.toUpperCase()} confidence ({(event.evidence.final_score * 100).toFixed(0)}%)
                    </p>
                    <p className="mt-1 text-gray-600">{event.evidence.reasoning}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
