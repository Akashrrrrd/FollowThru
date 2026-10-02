'use client';

import { useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Calendar,
  User,
  Pencil,
  Mail,
  Loader2,
  Copy,
  X,
  AlertCircle,
  Link2,
  Shield,
  Users,
  UserCheck,
  GitBranch,
  History,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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

const statusStyles: Record<Task['status'], string> = {
  open: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  blocked: 'bg-red-100 text-red-700',
  completed: 'bg-green-100 text-green-700',
  done: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
};

const statusLabels: Record<Task['status'], string> = {
  open: 'Open',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  completed: 'Completed',
  done: 'Done',
  overdue: 'Overdue',
};

const confidenceStyles: Record<ConfidenceLevel, { bg: string; text: string; icon: typeof Shield }> = {
  high: { bg: 'bg-green-100', text: 'text-green-700', icon: Shield },
  medium: { bg: 'bg-blue-100', text: 'text-blue-700', icon: Shield },
  low: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: AlertCircle },
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
  const [showCompletionModal, setShowCompletionModal] = useState(false);

  const [nudgeLoading, setNudgeLoading] = useState(false);
  const [nudgeMessage, setNudgeMessage] = useState<string | null>(null);
  const [nudgeError, setNudgeError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const isDone = task.status === 'done' || task.status === 'completed' || optimisticDone;
  const dueDate = formatDate(task.due_date);
  
  // Phase 1: Get confidence and commitment type
  const confidence = task.confidence || 'medium';
  const commitmentType = task.commitment_type || 'explicit';
  const ConfidenceIcon = confidenceStyles[confidence].icon;
  const CommitmentIcon = commitmentTypeIcons[commitmentType];
  
  // Phase 4: Continuity status
  const hasContinuity = task.parent_commitment_id || task.continuity_status;
  const continuityConfidence = task.continuity_confidence || 'medium';

  // Get valid next statuses for current status
  const currentStatus = task.status as TaskStatus;
  const validNextStatuses: TaskStatus[] = (
    ['open', 'in_progress', 'blocked', 'completed'] as const
  ).filter((s) => isValidTransition(currentStatus, s)) as TaskStatus[];
  
  // Include current status in options so it's always selectable
  const allStatusOptions: TaskStatus[] = Array.from(
    new Set([currentStatus, ...validNextStatuses])
  );

  const handleStatusChange = async (newStatus: TaskStatus) => {
    if (!onStatusChange) return;
    setStatusChanging(true);
    try {
      console.log('Changing status from', task.status, 'to', newStatus);
      onStatusChange(task.id, newStatus);
      
      // Show completion email modal if transitioning to completed
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

  const handleSaveEdit = () => {
    if (!onEdit) return;
    if (!editDescription.trim() || !editOwner.trim()) return;
    setEditSaving(true);
    onEdit(task.id, {
      description: editDescription.trim(),
      owner: editOwner.trim(),
      due_date: editDueDate || null,
    });
    setEditSaving(false);
    setEditing(false);
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

  return (
    <>
      <div
        className={cn(
          'rounded-lg border bg-white p-5 shadow-sm transition-shadow hover:shadow-md',
          carriedOver ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200',
          isDone && 'opacity-75',
        )}
      >
      {carriedOver && (
        <div className="mb-2">
          <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
            Carried over
            {meetingTitle ? ` from "${meetingTitle}"` : ''}
          </span>
        </div>
      )}

      {/* Phase 4: Continuity indicator */}
      {hasContinuity && (
        <div className="mb-2">
          <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
            <GitBranch className="mr-1 h-3 w-3" />
            {task.continuity_status === 'completed' ? 'Completed' : 'Continued'}
            {continuityConfidence === 'medium' && ' (review)'}
          </span>
        </div>
      )}

      {editing ? (
        <div className="space-y-3">
          <Input
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            placeholder="Description"
            className="border-gray-200"
          />
          <div className="flex gap-2">
            <Input
              value={editOwner}
              onChange={(e) => setEditOwner(e.target.value)}
              placeholder="Owner"
              className="border-gray-200"
            />
            <Input
              type="date"
              value={editDueDate}
              onChange={(e) => setEditDueDate(e.target.value)}
              className="border-gray-200"
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleSaveEdit}
              disabled={editSaving}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              {editSaving ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="mr-1 h-3.5 w-3.5" />
              )}
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setEditDescription(task.description);
                setEditOwner(task.owner);
                setEditDueDate(toDateInput(task.due_date));
              }}
            >
              <X className="mr-1 h-3.5 w-3.5" />
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                    statusStyles[isDone ? 'completed' : task.status],
                  )}
                >
                  {statusLabels[isDone ? 'completed' : task.status]}
                </span>
                
                {/* Phase 1: Confidence Badge */}
                {!task.needs_review && (
                  <Badge
                    variant="outline"
                    className={cn(
                      'gap-1 border-0',
                      confidenceStyles[confidence].bg,
                      confidenceStyles[confidence].text,
                    )}
                  >
                    <ConfidenceIcon className="h-3 w-3" />
                    {confidence.toUpperCase()}
                  </Badge>
                )}
                
                {/* Phase 1: Needs Review Flag */}
                {task.needs_review && (
                  <Badge variant="outline" className="gap-1 border-yellow-300 bg-yellow-50 text-yellow-700">
                    <AlertCircle className="h-3 w-3" />
                    Needs Review
                  </Badge>
                )}
                
                {/* Phase 1: Commitment Type */}
                <Badge variant="outline" className="gap-1">
                  <CommitmentIcon className="h-3 w-3" />
                  {commitmentTypeLabels[commitmentType]}
                </Badge>
                
                {dueDate && (
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Calendar className="h-3.5 w-3.5" />
                    {dueDate}
                  </span>
                )}
              </div>

              <p
                className={cn(
                  'text-sm font-medium text-gray-900',
                  isDone && 'line-through',
                )}
              >
                {task.description}
              </p>
              
              {/* Phase 1: Dependency Label */}
              {task.dependency && (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2">
                  <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-amber-900">Depends on:</p>
                    <p className="text-xs text-amber-700">{task.dependency}</p>
                  </div>
                </div>
              )}
              
              {/* Phase 1: Blocker Label */}
              {task.blocker && (
                <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-red-900">Blocked by:</p>
                    <p className="text-xs text-red-700">{task.blocker}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600">
                  {getInitials(task.owner)}
                </span>
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <User className="h-3 w-3" />
                  {task.owner}
                </span>
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1.5">
              {/* Lifecycle Status Selector */}
              {onStatusChange && allStatusOptions.length > 0 && (
                <Select
                  value={task.status}
                  onValueChange={(newStatus) =>
                    handleStatusChange(newStatus as TaskStatus)
                  }
                  disabled={statusChanging}
                >
                  <SelectTrigger className="w-[140px] border-gray-200 bg-white text-xs font-medium text-gray-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allStatusOptions.map((status) => (
                      <SelectItem key={status} value={status}>
                        {getStatusLabel(status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Fallback: Mark Done button (for backward compatibility) */}
              {!onStatusChange && onToggleDone && (
                <>
                  {!isDone && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleToggle}
                      className="border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                    >
                      <Check className="mr-1 h-4 w-4" />
                      Mark Done
                    </Button>
                  )}
                  {isDone && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleToggle}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      Reopen
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Action buttons row */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {onEdit && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditing(true)}
                className="h-7 gap-1 px-2 text-xs text-gray-500 hover:text-gray-700"
              >
                <Pencil className="h-3 w-3" />
                Edit
              </Button>
            )}
            {!isDone && onNudge && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleNudge}
                disabled={nudgeLoading}
                className="h-7 gap-1 px-2 text-xs text-blue-600 hover:text-blue-700"
              >
                {nudgeLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Mail className="h-3 w-3" />
                )}
                Draft reminder
              </Button>
            )}
          </div>

          {/* Nudge result */}
          {nudgeError && (
            <div className="mt-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
              {nudgeError}
            </div>
          )}
          {nudgeMessage && (
            <div className="mt-2 rounded-md border border-gray-200 bg-gray-50 p-3">
              <p className="text-sm text-gray-700">{nudgeMessage}</p>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCopy}
                className="mt-2 h-7 gap-1 px-2 text-xs text-blue-600 hover:text-blue-700"
              >
                <Copy className="h-3 w-3" />
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          )}

          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CollapsibleTrigger className="mt-3 flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700">
              {isOpen ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
              View source
            </CollapsibleTrigger>
            <CollapsibleContent>
              <blockquote className="mt-2 border-l-2 border-gray-200 pl-3 text-sm italic text-gray-500">
                &ldquo;{task.source_quote}&rdquo;
              </blockquote>
            </CollapsibleContent>
          </Collapsible>
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
