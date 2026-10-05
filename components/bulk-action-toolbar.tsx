'use client';

/**
 * Bulk Action Toolbar Component
 *
 * Appears when commitments are selected.
 * Provides action buttons (assign, reassign, status, due-date, priority).
 * Shows selection count and clear button.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { AlertCircle, CheckCircle, Loader, X } from 'lucide-react';
import { executeBulkActionRequest } from '@/hooks/use-bulk-selection';

interface BulkActionToolbarProps {
  selectionCount: number;
  selectedIds: string[];
  onClearSelection: () => void;
  onActionComplete?: () => void;
  isLoading?: boolean;
  /**
   * People that commitments can be (re)assigned to. Pass real organization members here.
   * (The old version showed two hard-coded placeholder users, whose fake IDs the API
   * could never accept.)
   */
  members?: Array<{ id: string; name: string }>;
}

type ActionKey = 'assign' | 'reassign' | 'status' | 'due-date' | 'priority';

const ACTIONS: Record<
  ActionKey,
  {
    label: string;
    title: string;
    description: string;
    submit: string;
    busy: string;
    request: string;
    payload: (value: string) => Record<string, string>;
  }
> = {
  assign: {
    label: 'Assign',
    title: 'Assign commitments',
    description: 'Select a person to assign the selected commitments to.',
    submit: 'Assign',
    busy: 'Assigning...',
    request: 'assign',
    payload: (v) => ({ targetUserId: v }),
  },
  reassign: {
    label: 'Reassign',
    title: 'Reassign commitments',
    description: 'Select a new owner for the selected commitments.',
    submit: 'Reassign',
    busy: 'Reassigning...',
    request: 'reassign',
    payload: (v) => ({ targetUserId: v }),
  },
  status: {
    label: 'Status',
    title: 'Update status',
    description: 'Select a new status for the selected commitments.',
    submit: 'Update',
    busy: 'Updating...',
    request: 'status',
    payload: (v) => ({ newStatus: v }),
  },
  'due-date': {
    label: 'Due date',
    title: 'Update due date',
    description: 'Set a new due date for the selected commitments.',
    submit: 'Update',
    busy: 'Updating...',
    request: 'due_date',
    payload: (v) => ({ newDueDate: v }),
  },
  priority: {
    label: 'Priority',
    title: 'Update priority',
    description: 'Set a new priority level for the selected commitments.',
    submit: 'Update',
    busy: 'Updating...',
    request: 'priority',
    payload: (v) => ({ newPriority: v }),
  },
};

const ACTION_ORDER: ActionKey[] = ['assign', 'reassign', 'status', 'due-date', 'priority'];

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'completed', label: 'Completed' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export function BulkActionToolbar({
  selectionCount,
  selectedIds,
  onClearSelection,
  onActionComplete,
  isLoading = false,
  members = [],
}: BulkActionToolbarProps) {
  const [activeDialog, setActiveDialog] = useState<ActionKey | null>(null);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [dialogSuccess, setDialogSuccess] = useState<string | null>(null);
  // Only one dialog is open at a time, so a single value is enough.
  const [value, setValue] = useState('');
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const openDialog = (key: ActionKey) => {
    setValue('');
    setDialogError(null);
    setDialogSuccess(null);
    setActiveDialog(key);
  };

  const closeDialog = () => {
    setActiveDialog(null);
    setValue('');
    setDialogError(null);
    setDialogSuccess(null);
  };

  const handleSubmit = async () => {
    if (!activeDialog || !value) return;
    const config = ACTIONS[activeDialog];

    setDialogLoading(true);
    setDialogError(null);
    setDialogSuccess(null);

    const result = await executeBulkActionRequest(config.request, selectedIds, config.payload(value));

    setDialogLoading(false);

    if (result.success) {
      setDialogSuccess(result.message);
      closeTimer.current = setTimeout(() => {
        closeDialog();
        onClearSelection();
        onActionComplete?.();
      }, 1500);
    } else {
      setDialogError(result.message);
    }
  };

  if (selectionCount === 0) return null;

  const busy = isLoading || dialogLoading;
  const config = activeDialog ? ACTIONS[activeDialog] : null;

  const renderInput = (key: ActionKey): ReactNode => {
    if (key === 'assign' || key === 'reassign') {
      if (members.length === 0) {
        return (
          <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600">
            No people available to assign to yet.
          </p>
        );
      }
      return (
        <OptionSelect
          value={value}
          onChange={setValue}
          placeholder="Select a person..."
          options={members.map((m) => ({ value: m.id, label: m.name }))}
        />
      );
    }
    if (key === 'status') {
      return <OptionSelect value={value} onChange={setValue} placeholder="Select a status..." options={STATUS_OPTIONS} />;
    }
    if (key === 'priority') {
      return <OptionSelect value={value} onChange={setValue} placeholder="Select a priority..." options={PRIORITY_OPTIONS} />;
    }
    return <Input type="date" value={value} onChange={(e) => setValue(e.target.value)} disabled={dialogLoading} />;
  };

  return (
    <>
      {/* Sticky action bar */}
      <div className="sticky bottom-4 z-20 mx-auto w-full max-w-5xl px-4">
        <div
          role="toolbar"
          aria-label="Bulk actions"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#2A4A75] bg-[#1F3A5F] px-4 py-3 text-white shadow-[0_8px_24px_-8px_rgba(16,24,40,0.45)]"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-white/15 px-2 text-sm font-semibold">
              {selectionCount}
            </span>
            <span className="text-sm font-medium">
              {selectionCount === 1 ? 'commitment' : 'commitments'} selected
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {ACTION_ORDER.map((key) => (
              <Button
                key={key}
                size="sm"
                variant="outline"
                onClick={() => openDialog(key)}
                disabled={busy}
                className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                {ACTIONS[key].label}
              </Button>
            ))}
            <Button
              size="sm"
              variant="ghost"
              onClick={onClearSelection}
              disabled={busy}
              className="gap-1 text-white/80 hover:bg-white/10 hover:text-white"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Clear
            </Button>
          </div>
        </div>
      </div>

      {/* One shared dialog for every action */}
      <Dialog open={activeDialog !== null} onOpenChange={(open: boolean) => !open && !dialogLoading && closeDialog()}>
        <DialogContent>
          {config && activeDialog && (
            <>
              <DialogHeader>
                <DialogTitle className="font-serif text-xl">{config.title}</DialogTitle>
                <DialogDescription>
                  {config.description} {selectionCount} selected.
                </DialogDescription>
              </DialogHeader>

              {dialogSuccess && (
                <div role="status" className="flex gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{dialogSuccess}</span>
                </div>
              )}

              {dialogError && (
                <div role="alert" className="flex gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{dialogError}</span>
                </div>
              )}

              {!dialogSuccess && (
                <>
                  {renderInput(activeDialog)}

                  <DialogFooter>
                    <Button variant="outline" onClick={closeDialog} disabled={dialogLoading} className="border-slate-300">
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      disabled={!value || dialogLoading}
                      className="bg-blue-600 text-white hover:bg-blue-700"
                    >
                      {dialogLoading ? (
                        <>
                          <Loader className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                          {config.busy}
                        </>
                      ) : (
                        config.submit
                      )}
                    </Button>
                  </DialogFooter>
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function OptionSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="border-slate-300">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}