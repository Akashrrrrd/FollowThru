/**
 * Pipeline Error Handler
 * 
 * Centralized error handling for extraction pipeline.
 * Logs rejection reasons, tracks error patterns, enables retry logic.
 * 
 * Implements Invariant #8: "Commitment Preservation: No Silent Drops"
 * Every failure is logged with full context for audit trail.
 */

import { PipelineError, PipelineStage } from "./pipeline-validator";

export type RejectionLog = {
  id: string; // UUID
  timestamp: string; // ISO string
  meeting_id: string;
  user_id: string;
  stage: PipelineStage;
  error_code: string;
  error_message: string;
  invariant?: number;
  context: Record<string, any>;
  recoverable: boolean;
  retry_count: number;
  retry_status?: "pending" | "succeeded" | "failed";
  admin_notes?: string;
};

export type ErrorMetrics = {
  total_errors: number;
  errors_by_stage: Record<PipelineStage, number>;
  errors_by_code: Record<string, number>;
  recoverable_count: number;
  non_recoverable_count: number;
  most_common_error?: string;
};

// In-memory rejection log (in production, would be database)
let rejectionLogs: RejectionLog[] = [];

/**
 * Log a pipeline rejection
 */
export function logRejection(
  meeting_id: string,
  user_id: string,
  stage: PipelineStage,
  error: PipelineError,
  context: Record<string, any>
): RejectionLog {
  const rejection: RejectionLog = {
    id: `rejection-${Date.now()}-${Math.random()}`,
    timestamp: new Date().toISOString(),
    meeting_id,
    user_id,
    stage,
    error_code: error.code,
    error_message: error.message,
    invariant: error.invariant,
    context,
    recoverable: error.recoverable,
    retry_count: 0,
  };

  rejectionLogs.push(rejection);

  // In production, also write to database:
  // await supabase.from('rejection_logs').insert(rejection);

  console.warn(`[PIPELINE REJECTION] ${stage}: ${error.code}`, {
    meeting_id,
    error: error.message,
    recoverable: error.recoverable,
  });

  return rejection;
}

/**
 * Log multiple rejections from a validation failure
 */
export function logRejections(
  meeting_id: string,
  user_id: string,
  stage: PipelineStage,
  errors: PipelineError[],
  context: Record<string, any>
): RejectionLog[] {
  return errors.map((error) => logRejection(meeting_id, user_id, stage, error, context));
}

/**
 * Retrieve rejection log for a meeting
 */
export function getRejectionLog(meeting_id: string): RejectionLog[] {
  return rejectionLogs.filter((log) => log.meeting_id === meeting_id);
}

/**
 * Retrieve rejections for a user (admin view)
 */
export function getUserRejections(user_id: string, limit: number = 100): RejectionLog[] {
  return rejectionLogs
    .filter((log) => log.user_id === user_id)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

/**
 * Retrieve all recoverable rejections (candidates for retry)
 */
export function getRecoverableRejections(): RejectionLog[] {
  return rejectionLogs.filter(
    (log) => log.recoverable && (!log.retry_status || log.retry_status === "pending")
  );
}

/**
 * Mark a rejection as retried
 */
export function markRejectionRetried(
  rejectionId: string,
  succeeded: boolean
): RejectionLog | null {
  const log = rejectionLogs.find((l) => l.id === rejectionId);
  if (!log) return null;

  log.retry_count++;
  log.retry_status = succeeded ? "succeeded" : "failed";

  return log;
}

/**
 * Add admin notes to a rejection
 */
export function addRejectionNote(rejectionId: string, note: string): RejectionLog | null {
  const log = rejectionLogs.find((l) => l.id === rejectionId);
  if (!log) return null;

  log.admin_notes = note;
  return log;
}

/**
 * Get error metrics
 */
export function getErrorMetrics(): ErrorMetrics {
  const metrics: ErrorMetrics = {
    total_errors: rejectionLogs.length,
    errors_by_stage: {
      EXTRACTION: 0,
      PARSING: 0,
      LINKING: 0,
      CONTINUITY: 0,
      DATABASE: 0,
    },
    errors_by_code: {},
    recoverable_count: 0,
    non_recoverable_count: 0,
  };

  for (const log of rejectionLogs) {
    metrics.errors_by_stage[log.stage]++;

    metrics.errors_by_code[log.error_code] =
      (metrics.errors_by_code[log.error_code] || 0) + 1;

    if (log.recoverable) {
      metrics.recoverable_count++;
    } else {
      metrics.non_recoverable_count++;
    }
  }

  // Find most common error
  let mostCommon: string | undefined;
  let maxCount = 0;
  for (const [code, count] of Object.entries(metrics.errors_by_code)) {
    if (count > maxCount) {
      mostCommon = code;
      maxCount = count;
    }
  }
  metrics.most_common_error = mostCommon;

  return metrics;
}

/**
 * Format rejection log as report
 */
export function formatRejectionReport(rejectionLog: RejectionLog[]): string {
  if (rejectionLog.length === 0) {
    return "No rejections found.";
  }

  let output = `
╔════════════════════════════════════════════════════════════════════╗
║                    REJECTION LOG REPORT                            ║
╚════════════════════════════════════════════════════════════════════╝

Total Rejections: ${rejectionLog.length}

`;

  for (const log of rejectionLog) {
    output += `
Rejection ID: ${log.id}
Timestamp: ${log.timestamp}
Meeting: ${log.meeting_id}
Stage: ${log.stage}
Error: [${log.error_code}] ${log.error_message}
${log.invariant ? `Invariant: #${log.invariant}\n` : ""}Recoverable: ${log.recoverable ? "Yes" : "No"}
Retry Count: ${log.retry_count}
${log.retry_status ? `Retry Status: ${log.retry_status}\n` : ""}${log.admin_notes ? `Admin Notes: ${log.admin_notes}\n` : ""}────────────────────────────────────────────────────────────────────
`;
  }

  return output;
}

/**
 * Format metrics as report
 */
export function formatMetricsReport(metrics: ErrorMetrics): string {
  return `
╔════════════════════════════════════════════════════════════════════╗
║                    ERROR METRICS REPORT                            ║
╚════════════════════════════════════════════════════════════════════╝

Total Errors: ${metrics.total_errors}
Recoverable: ${metrics.recoverable_count}
Non-Recoverable: ${metrics.non_recoverable_count}

Errors by Stage:
  EXTRACTION: ${metrics.errors_by_stage.EXTRACTION}
  PARSING: ${metrics.errors_by_stage.PARSING}
  LINKING: ${metrics.errors_by_stage.LINKING}
  CONTINUITY: ${metrics.errors_by_stage.CONTINUITY}
  DATABASE: ${metrics.errors_by_stage.DATABASE}

Most Common Error: ${metrics.most_common_error || "None"}

Top Error Codes:
${Object.entries(metrics.errors_by_code)
  .sort(([, a], [, b]) => b - a)
  .slice(0, 5)
  .map(([code, count]) => `  ${code}: ${count}`)
  .join("\n")}
`;
}

/**
 * Clear rejection logs (testing only)
 */
export function clearRejectionLogs(): void {
  rejectionLogs = [];
}

/**
 * Get all rejection logs (for testing)
 */
export function getAllRejectionLogs(): RejectionLog[] {
  return [...rejectionLogs];
}
