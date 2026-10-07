'use client';

import { useEffect, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Calendar,
  Pencil,
  Mail,
  Loader2,
  Copy,
  X,
  AlertCircle,
  AlertTriangle,
  Link2,
  Shield,
  Users,
  UserCheck,
  GitBranch,
  Ban,
  Hourglass,
  Clock,
  CircleDot,
  CheckCircle2,
  Circle,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CompletionEmailModal } from '@/components/completion-email-modal';
import { isValidTransition, getStatusLabel } from '@/lib/lifecycle';
import { cardStatusOf, relativeDueLabel } from '@/lib/task-status';
import type { CardStatus } from '@/lib/task-status';
import type { Task, ConfidenceLevel, CommitmentType, TaskStatus } from '@/lib/types';

interface TaskCardProps {
  task: Task;
  carriedOver?: boolean;
  meetingTitle?: string;
  onToggleDone?: (id: string, done: boolean) => void;
  onStatusChange?: (id: string, status: TaskStatus) => void;
  onEdit?: (id: string, updates: { description: string; owner: string; due_date: string | null }) => void;
  onNudge?: (id: string) => Promise<string>;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function formatDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const date = new Date(dateStr + 'T00:00:00');
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function toDateInput(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  if (isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

/** "Completed today", "Completed yesterday", or "Completed Oct 5" */
function completedLabel(completedAt: string | null | undefined, justNow: boolean): string {
  if (justNow) return 'Completed just now';
  if (!completedAt) return 'Completed';

  const when = new Date(completedAt);
  if (isNaN(when.getTime())) return 'Completed';

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const days = Math.round(
    (startOfToday.getTime() - new Date(when).setHours(0, 0, 0, 0)) / 86_400_000,
  );

  if (days <= 0) return 'Completed today';
  if (days === 1) return 'Completed yesterday';
  return `Completed ${when.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

// Badge label + icon per visual status. Never rely on color alone.
const statusMeta: Record<CardStatus, { label: (t: Task) => string; icon: typeof Clock }> = {
  overdue: { label: () => 'Overdue', icon: Hourglass },
  soon: { label: () => 'Due soon', icon: Clock },
  progress: { label: () => 'In progress', icon: CircleDot },
  blocked: { label: () => 'Blocked', icon: Ban },
  done: { label: () => 'Completed', icon: CheckCircle2 },
  neutral: { label: () => 'Open', icon: Circle },
};

const confidenceMeta: Record<
  ConfidenceLevel,
  { status: CardStatus; label: string; icon: typeof Shield }
> = {
  high: { status: 'done', label: 'High confidence', icon: Shield },
  medium: { status: 'progress', label: 'Medium confidence', icon: Shield },
  low: { status: 'soon', label: 'Low confidence', icon: AlertCircle },
};

const commitmentTypeIcons: Record<CommitmentType, typeof UserCheck> = {
  explicit: UserCheck,
  collective: Users,
  acceptance: UserCheck,
};

const commitmentTypeLabels: Record<CommitmentType, string> = {
  explicit: 'Explicit',
  collective: 'Collective',
  acceptance: 'Accepted',
};

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export function TaskCard({
  task,
  carriedOver = false,
  meetingTitle,
  onToggleDone,
  onStatusChange,
  onEdit,
  onNudge,
}: TaskCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [statusChanging, setStatusChanging] = useState(false);
  const [optimisticDone, setOptimisticDone] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editDescription, setEditDescription] = useState(task.description);
  const [editOwner, setEditOwner] = useState(task.owner);
  const [editDueDate, setEditDueDate] = useState(toDateInput(task.due_date));
  const [editSaving, setEditSaving] = useState(false);
  const [editTried, setEditTried] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);

  const [nudgeLoading, setNudgeLoading] = useState(false);
  const [nudgeMessage, setNudgeMessage] = useState<string | null>(null);
  const [nudgeError, setNudgeError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // The optimistic flag only bridges the gap until the real status arrives.
  // Without this reset, reopening through the status menu left the card looking done.
  useEffect(() => {
    setOptimisticDone(false);
  }, [task.status]);

  const isDone = task.status === 'done' || task.status === 'completed' || optimisticDone;
  const status = cardStatusOf(task, { done: isDone });
  const StatusIcon = statusMeta[status].icon;

  const dueDate = formatDate(task.due_date);
  const relativeDue = isDone ? null : relativeDueLabel(task.due_date);
  const dueTone: CardStatus | null =
    status === 'overdue' ? 'overdue' : relativeDue && status === 'soon' ? 'soon' : null;

  // Phase 1: confidence and commitment type
  const confidence = task.confidence || 'medium';
  const commitmentType = task.commitment_type || 'explicit';
  const confidenceInfo = confidenceMeta[confidence];
  const ConfidenceIcon = confidenceInfo.icon;
  const CommitmentIcon = commitmentTypeIcons[commitmentType];

  // Phase 4: continuity
  const hasContinuity = task.parent_commitment_id || task.continuity_status;
  const continuityConfidence = task.continuity_confidence || 'medium';

  // Valid next statuses for the current status
  const currentStatus = task.status as TaskStatus;
  const validNextStatuses: TaskStatus[] = (
    ['open', 'in_progress', 'blocked', 'completed'] as const
  ).filter((s) => isValidTransition(currentStatus, s)) as TaskStatus[];

  // Include the current status so it is always selectable
  const allStatusOptions: TaskStatus[] = Array.from(
    new Set([currentStatus, ...validNextStatuses]),
  );

  const canMarkComplete = onStatusChange
    ? validNextStatuses.includes('completed')
    : !!onToggleDone;
  const canReopen = onToggleDone || (onStatusChange && validNextStatuses.includes('open'));

  const completedAt = (task as { completed_at?: string | null }).completed_at;

  /* ------------------------------- Handlers ------------------------------ */

  const handleStatusChange = async (newStatus: TaskStatus) => {
    if (!onStatusChange) return;
    setStatusChanging(true);
    try {
      onStatusChange(task.id, newStatus);

      // Show completion email modal when moving to completed
      if ((newStatus === 'completed' || newStatus === 'done') && task.status !== newStatus) {
        setTimeout(() => setShowCompletionModal(true), 500);
      }
    } catch (err) {
      console.error('Status change error in TaskCard:', err);
    } finally {
      setStatusChanging(false);
    }
  };

  const handleToggle = () => {
    if (!onToggleDone) return;
    const newDone = !isDone;
    setOptimisticDone(newDone);
    onToggleDone(task.id, newDone);
  };

  const handleMarkComplete = () => {
    if (onStatusChange) {
      setOptimisticDone(true);
      handleStatusChange('completed');
    } else {
      handleToggle();
    }
  };

  const handleReopen = () => {
    if (onToggleDone) {
      handleToggle();
    } else if (onStatusChange) {
      handleStatusChange('open');
    }
  };

  const descriptionInvalid = editTried && !editDescription.trim();
  const ownerInvalid = editTried && !editOwner.trim();

  const handleSaveEdit = () => {
    if (!onEdit) return;
    setEditTried(true);
    if (!editDescription.trim() || !editOwner.trim()) return;

    setEditSaving(true);
    onEdit(task.id, {
      description: editDescription.trim(),
      owner: editOwner.trim(),
      due_date: editDueDate || null,
    });
    setEditSaving(false);
    setEditing(false);
    setEditTried(false);
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setEditTried(false);
    setEditDescription(task.description);
    setEditOwner(task.owner);
    setEditDueDate(toDateInput(task.due_date));
  };

  const handleNudge = async () => {
    if (!onNudge) return;
    setNudgeLoading(true);
    setNudgeError(null);
    setNudgeMessage(null);
    try {
      const msg = await onNudge(task.id);
      setNudgeMessage(msg);
    } catch (err) {
      setNudgeError(
        err instanceof Error ? err.message : 'Failed to generate reminder.',
      );
    }
    setNudgeLoading(false);
  };

  const handleCopy = () => {
    if (nudgeMessage) {
      navigator.clipboard.writeText(nudgeMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  /* -------------------------------- Render ------------------------------- */

  return (
    <>
      <div
        data-status={status}
        className={cn(
          'card-classic card-static p-5',
          carriedOver && 'border-status-info/40 bg-status-info-soft/40',
        )}
      >
        {(carriedOver || hasContinuity) && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {carriedOver && (
              <span className="status-badge" data-status="info">
                Carried over{meetingTitle ? ` from "${meetingTitle}"` : ''}
              </span>
            )}

            {hasContinuity && (
              <span className="status-badge" data-status="neutral">
                <GitBranch className="h-3 w-3" />
                {task.continuity_status === 'completed' ? 'Completed earlier' : 'Continued'}
                {continuityConfidence === 'medium' && ' · needs review'}
              </span>
            )}
          </div>
        )}

        {editing ? (
          /* ------------------------------ Edit mode ----------------------------- */
          <div className="space-y-4">
            <div>
              <label htmlFor={`desc-${task.id}`} className="label-classic required-mark">
                Commitment
              </label>
              <input
                id={`desc-${task.id}`}
                className="field"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="What was promised?"
                aria-invalid={descriptionInvalid}
                autoFocus
              />
              {descriptionInvalid && (
                <p className="field-message" data-tone="overdue">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Enter what was promised.
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor={`owner-${task.id}`} className="label-classic required-mark">
                  Owner
                </label>
                <input
                  id={`owner-${task.id}`}
                  className="field"
                  value={editOwner}
                  onChange={(e) => setEditOwner(e.target.value)}
                  placeholder="Who is responsible?"
                  aria-invalid={ownerInvalid}
                />
                {ownerInvalid && (
                  <p className="field-message" data-tone="overdue">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Enter an owner.
                  </p>
                )}
              </div>

              <div>
                <label htmlFor={`due-${task.id}`} className="label-classic">
                  Due date
                </label>
                <input
                  id={`due-${task.id}`}
                  type="date"
                  className="field"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                className="btn-primary btn-sm"
                onClick={handleSaveEdit}
                disabled={editSaving}
                aria-busy={editSaving}
              >
                {!editSaving && <Check className="h-3.5 w-3.5" />}
                {editSaving ? 'Saving...' : 'Save changes'}
              </button>
              <button type="button" className="btn-ghost btn-sm" onClick={handleCancelEdit}>
                <X className="h-3.5 w-3.5" />
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* ------------------------------ Header ----------------------------- */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="status-badge">
                <StatusIcon className="h-3.5 w-3.5" />
                {statusMeta[status].label(task)}
              </span>

              {task.needs_review ? (
                <span className="status-badge" data-status="soon">
                  <AlertCircle className="h-3 w-3" />
                  Needs review
                </span>
              ) : (
                <span className="confidence" data-status={confidenceInfo.status}>
                  <ConfidenceIcon className="h-3 w-3" />
                  {confidenceInfo.label}
                </span>
              )}

              {/* Explicit is the default, so only call out the unusual types */}
              {commitmentType !== 'explicit' && (
                <span className="confidence" data-status="neutral">
                  <CommitmentIcon className="h-3 w-3" />
                  {commitmentTypeLabels[commitmentType]}
                </span>
              )}
            </div>

            {/* ------------------------------- Body ------------------------------ */}
            <p
              className={cn(
                'mt-3 text-[0.9375rem] font-medium leading-snug text-foreground',
                isDone && 'text-muted-foreground line-through decoration-muted-foreground/50',
              )}
            >
              {task.description}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground"
                >
                  {getInitials(task.owner)}
                </span>
                <span className="font-medium text-foreground">{task.owner}</span>
              </span>

              {dueDate && (
                <span
                  className={cn(
                    'flex items-center gap-1.5 font-medium',
                    dueTone === 'overdue' && 'text-status-overdue',
                    dueTone === 'soon' && 'text-status-soon',
                    !dueTone && 'text-muted-foreground',
                  )}
                  title={dueDate}
                >
                  <Calendar className="h-3.5 w-3.5" />
                  {relativeDue ? `${relativeDue} · ${dueDate}` : dueDate}
                </span>
              )}

              {isDone && (
                <span className="flex items-center gap-1.5 font-medium text-status-done">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {completedLabel(completedAt, optimisticDone && task.status !== 'completed' && task.status !== 'done')}
                </span>
              )}
            </div>

            {task.dependency && (
              <div className="mt-3 flex items-start gap-2 rounded-md border border-status-info/30 bg-status-info-soft p-2.5">
                <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-info" />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-status-info">Depends on</p>
                  <p className="text-xs text-foreground/80">{task.dependency}</p>
                </div>
              </div>
            )}

            {task.blocker && (
              <div className="mt-3 flex items-start gap-2 rounded-md border border-status-blocked/30 bg-status-blocked-soft p-2.5">
                <Ban className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-blocked" />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-status-blocked">Blocked by</p>
                  <p className="text-xs text-foreground/80">{task.blocker}</p>
                </div>
              </div>
            )}

            {/* ------------------------------ Footer ----------------------------- */}
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
              {!isDone && canMarkComplete && (
                <button type="button" className="btn-success btn-sm" onClick={handleMarkComplete}>
                  <Check className="h-3.5 w-3.5" />
                  Mark complete
                </button>
              )}

              {isDone && canReopen && (
                <button type="button" className="btn-ghost btn-sm" onClick={handleReopen}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reopen
                </button>
              )}

              {!isDone && onNudge && (
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={handleNudge}
                  disabled={nudgeLoading}
                  aria-busy={nudgeLoading}
                >
                  {!nudgeLoading && <Mail className="h-3.5 w-3.5" />}
                  {nudgeLoading ? 'Drafting...' : 'Draft reminder'}
                </button>
              )}

              {onEdit && (
                <button type="button" className="btn-ghost btn-sm" onClick={() => setEditing(true)}>
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
              )}

              {/* Lifecycle status selector */}
              {onStatusChange && allStatusOptions.length > 0 && (
                <div className="ml-auto">
                  <Select
                    value={task.status}
                    onValueChange={(newStatus) => handleStatusChange(newStatus as TaskStatus)}
                    disabled={statusChanging}
                  >
                    <SelectTrigger className="h-8 w-[136px] text-xs font-medium" aria-label="Change status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {allStatusOptions.map((s) => (
                        <SelectItem key={s} value={s}>
                          {getStatusLabel(s)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Nudge result */}
            {nudgeError && (
              <div
                role="alert"
                className="mt-3 flex items-start gap-2 rounded-md border border-status-overdue/30 bg-status-overdue-soft p-2.5 text-xs text-status-overdue"
              >
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{nudgeError} Try again in a moment.</span>
              </div>
            )}

            {nudgeMessage && (
              <div className="page-enter mt-3 rounded-md border border-border bg-muted/50 p-3">
                <p className="text-sm text-foreground">{nudgeMessage}</p>
                <button type="button" onClick={handleCopy} className="btn-ghost btn-sm mt-2 -ml-2">
                  {copied ? <Check className="h-3.5 w-3.5 text-status-done" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied' : 'Copy reminder'}
                </button>
              </div>
            )}

            {/* Source */}
            {task.source_quote && (
              <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                <CollapsibleTrigger className="mt-3 flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
                  {isOpen ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                  {isOpen ? 'Hide source' : 'View source'}
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <blockquote className="mt-2 border-l-2 border-gold/60 pl-3 font-serif-body text-sm italic leading-relaxed text-muted-foreground">
                    &ldquo;{task.source_quote}&rdquo;
                  </blockquote>
                </CollapsibleContent>
              </Collapsible>
            )}
          </>
        )}
      </div>

      <CompletionEmailModal
        open={showCompletionModal}
        taskId={task.id}
        taskDescription={task.description}
        onClose={() => setShowCompletionModal(false)}
      />
    </>
  );
}