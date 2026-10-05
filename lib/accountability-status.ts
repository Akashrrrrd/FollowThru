/**
 * Accountability Status Classification
 * 
 * Deterministic, rule-based status determination.
 * No AI, no guessing - only uses existing database metrics.
 * 
 * Status Rules:
 * - ON_TRACK: No overdue, no escalations, completion rate ≥ 75%
 * - AT_RISK: Early warning (overdue, escalations, 50-74% completion)
 * - NEEDS_ATTENTION: Critical (2+ overdue, owner escalation, <50% completion)
 */

export type AccountabilityStatus = 'ON_TRACK' | 'AT_RISK' | 'NEEDS_ATTENTION';

export interface AccountabilityMetrics {
  total: number;
  completed: number;
  overdue: number;
  completion_rate: number;
  escalation_level?: number; // 0 = none, 1 = team lead, 2 = manager, 3 = owner
  recent_escalation_7d?: number;
}

export interface EscalationSummary {
  active_count: number;
  owner_level_count: number;
  recent_7d: number;
}

/**
 * Determine accountability status based on metrics.
 * 
 * ON_TRACK:
 *   - No overdue commitments
 *   - No active escalations (escalation_level = 0)
 *   - Completion rate ≥ 75%
 * 
 * AT_RISK:
 *   - ≥ 1 overdue commitment
 *   - OR: Active escalation (team lead or manager)
 *   - OR: Completion rate 50-74%
 *   - OR: Recent escalation in last 7 days
 * 
 * NEEDS_ATTENTION:
 *   - ≥ 2 overdue commitments
 *   - OR: Escalation to Owner (level 3)
 *   - OR: Completion rate < 50%
 */
export function getAccountabilityStatus(
  metrics: AccountabilityMetrics,
): AccountabilityStatus {
  const {
    overdue,
    completion_rate,
    escalation_level = 0,
    recent_escalation_7d = 0,
  } = metrics;

  // NEEDS_ATTENTION: Critical conditions
  if (
    overdue >= 2 ||
    escalation_level === 3 ||
    completion_rate < 50
  ) {
    return 'NEEDS_ATTENTION';
  }

  // AT_RISK: Early warning signs
  if (
    overdue >= 1 ||
    escalation_level >= 1 ||
    completion_rate < 75 ||
    recent_escalation_7d > 0
  ) {
    return 'AT_RISK';
  }

  // ON_TRACK: Everything is good
  return 'ON_TRACK';
}

/**
 * Get human-readable label for status
 */
export function getStatusLabel(status: AccountabilityStatus): string {
  const labels: Record<AccountabilityStatus, string> = {
    ON_TRACK: 'On Track',
    AT_RISK: 'At Risk',
    NEEDS_ATTENTION: 'Needs Attention',
  };
  return labels[status];
}

/**
 * Get CSS badge classes for status
 */
export function getStatusBadgeClasses(status: AccountabilityStatus): {
  container: string;
  text: string;
  dot: string;
} {
  const styles: Record<
    AccountabilityStatus,
    { container: string; text: string; dot: string }
  > = {
    ON_TRACK: {
      container: 'bg-emerald-50 border-emerald-200',
      text: 'text-emerald-700',
      dot: 'bg-emerald-500',
    },
    AT_RISK: {
      container: 'bg-amber-50 border-amber-200',
      text: 'text-amber-700',
      dot: 'bg-amber-500',
    },
    NEEDS_ATTENTION: {
      container: 'bg-rose-50 border-rose-200',
      text: 'text-rose-700',
      dot: 'bg-rose-500',
    },
  };

  return styles[status];
}

/**
 * Get action priority text based on status
 */
export function getStatusDescription(status: AccountabilityStatus): string {
  const descriptions: Record<AccountabilityStatus, string> = {
    ON_TRACK: 'All commitments are progressing well.',
    AT_RISK: 'Some attention required. Review overdue items and escalations.',
    NEEDS_ATTENTION:
      'Immediate action required. Multiple overdue or critical escalations.',
  };
  return descriptions[status];
}
