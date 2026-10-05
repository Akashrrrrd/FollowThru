'use client';

/**
 * Bulk Selection Checkbox Components
 *
 * Individual and "select all" checkboxes for commitment selection in list/table views.
 * Integrates with the useBulkSelection hook. Props are unchanged.
 */

import { Checkbox } from '@/components/ui/checkbox';

const checkboxClass =
  'h-4 w-4 rounded-[4px] border-slate-300 bg-white shadow-sm transition-colors ' +
  'data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 ' +
  'data-[state=indeterminate]:border-blue-600 data-[state=indeterminate]:bg-blue-600 ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600';

interface BulkSelectionCheckboxProps {
  commitmentId: string;
  isSelected: boolean;
  onToggle: (commitmentId: string) => void;
  disabled?: boolean;
  aria?: string;
}

export function BulkSelectionCheckbox({
  commitmentId,
  isSelected,
  onToggle,
  disabled = false,
  aria,
}: BulkSelectionCheckboxProps) {
  return (
    <div className="flex items-center justify-center">
      <Checkbox
        checked={isSelected}
        onCheckedChange={() => onToggle(commitmentId)}
        disabled={disabled}
        aria-label={aria || `Select commitment ${commitmentId}`}
        className={checkboxClass}
      />
    </div>
  );
}

/**
 * Master "Select All" Checkbox
 *
 * Toggles selection of all currently visible commitments.
 * Shows the indeterminate state if some-but-not-all are selected.
 */

interface MasterCheckboxProps {
  isIndeterminate: boolean;
  isChecked: boolean;
  onToggle: () => void;
  disabled?: boolean;
  visibleCount: number;
  selectedCount: number;
}

export function MasterCheckbox({
  isIndeterminate,
  isChecked,
  onToggle,
  disabled = false,
  visibleCount,
  selectedCount,
}: MasterCheckboxProps) {
  return (
    <div className="flex items-center justify-center">
      <Checkbox
        // Radix supports a real "indeterminate" value (the old ref/.indeterminate hack had no effect on it)
        checked={isIndeterminate ? 'indeterminate' : isChecked}
        onCheckedChange={() => onToggle()}
        disabled={disabled || visibleCount === 0}
        aria-label={`Select all ${visibleCount} visible commitments (${selectedCount} currently selected)`}
        className={checkboxClass}
      />
    </div>
  );
}