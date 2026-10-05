'use client';

import {
  getStatusBadgeClasses,
  getStatusLabel,
  type AccountabilityStatus,
} from '@/lib/accountability-status';
import { AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';

interface AccountabilityBadgeProps {
  status: AccountabilityStatus;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showLabel?: boolean;
}

export function AccountabilityBadge({
  status,
  size = 'md',
  showIcon = true,
  showLabel = true,
}: AccountabilityBadgeProps) {
  const styles = getStatusBadgeClasses(status);
  const label = getStatusLabel(status);

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  const iconClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  const iconMap = {
    ON_TRACK: CheckCircle,
    AT_RISK: AlertTriangle,
    NEEDS_ATTENTION: AlertCircle,
  };

  const IconComponent = iconMap[status];

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border ${styles.container} font-medium ${styles.text} ${sizeClasses[size]}`}
    >
      {showIcon && (
        <IconComponent className={iconClasses[size]} />
      )}
      {showLabel && label}
    </div>
  );
}
