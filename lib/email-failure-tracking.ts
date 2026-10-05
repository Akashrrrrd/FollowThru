/**
 * Email Failure Tracking Service
 * 
 * Tracks, monitors, and helps debug email delivery failures
 * Provides utilities for logging failures, analyzing patterns, and retrying
 */

import { SupabaseClient } from '@supabase/supabase-js';

export type EmailFailureReason =
  | 'provider_unavailable'
  | 'invalid_email'
  | 'auth_failed'
  | 'rate_limited'
  | 'timeout'
  | 'user_opted_out'
  | 'quiet_hours'
  | 'preferences_disabled'
  | 'unknown';

export interface EmailFailureData {
  notificationId: string;
  reason: EmailFailureReason;
  error: string;
  retriable: boolean; // Whether this failure might succeed on retry
  metadata?: Record<string, any>;
}

/**
 * Record an email delivery failure in the notification
 */
export async function recordEmailFailure(
  supabase: SupabaseClient,
  data: EmailFailureData
): Promise<boolean> {
  try {
    const now = new Date().toISOString();
    const errorMessage = `[${data.reason}] ${data.error}`;

    const { error } = await supabase
      .from('notifications')
      .update({
        email_failed_at: now,
        email_error: errorMessage,
        updated_at: now,
      })
      .eq('id', data.notificationId);

    if (error) {
      console.error('[EmailFailureTracking] Error recording failure:', error);
      return false;
    }

    console.log(`[EmailFailureTracking] Recorded email failure: ${data.notificationId} - ${data.reason}`);
    return true;
  } catch (err) {
    console.error('[EmailFailureTracking] Exception recording failure:', err);
    return false;
  }
}

/**
 * Record successful email delivery
 */
export async function recordEmailSuccess(
  supabase: SupabaseClient,
  notificationId: string
): Promise<boolean> {
  try {
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('notifications')
      .update({
        email_sent_at: now,
        updated_at: now,
      })
      .eq('id', notificationId);

    if (error) {
      console.error('[EmailFailureTracking] Error recording success:', error);
      return false;
    }

    console.log(`[EmailFailureTracking] Recorded email success: ${notificationId}`);
    return true;
  } catch (err) {
    console.error('[EmailFailureTracking] Exception recording success:', err);
    return false;
  }
}

/**
 * Get failure statistics for a time window
 * Useful for monitoring and alerting
 */
export async function getEmailFailureStats(
  supabase: SupabaseClient,
  organizationId: string,
  hoursBack: number = 24
): Promise<{
  total_failures: number;
  unique_users: number;
  failure_reasons: Record<EmailFailureReason, number>;
  most_recent_failures: Array<{
    notification_id: string;
    user_id: string;
    error: string;
    failed_at: string;
  }>;
}> {
  try {
    const cutoffTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

    // Get all failures in time window
    const { data: failures, error } = await supabase
      .from('notifications')
      .select('id, user_id, email_error, email_failed_at')
      .eq('organization_id', organizationId)
      .gte('email_failed_at', cutoffTime)
      .is('email_sent_at', null)
      .order('email_failed_at', { ascending: false })
      .limit(1000);

    if (error) {
      console.error('[EmailFailureTracking] Error fetching failure stats:', error);
      return {
        total_failures: 0,
        unique_users: 0,
        failure_reasons: {
          provider_unavailable: 0,
          invalid_email: 0,
          auth_failed: 0,
          rate_limited: 0,
          timeout: 0,
          user_opted_out: 0,
          quiet_hours: 0,
          preferences_disabled: 0,
          unknown: 0,
        },
        most_recent_failures: [],
      };
    }

    // Parse failure reasons from error messages
    const failure_reasons: Record<EmailFailureReason, number> = {
      provider_unavailable: 0,
      invalid_email: 0,
      auth_failed: 0,
      rate_limited: 0,
      timeout: 0,
      user_opted_out: 0,
      quiet_hours: 0,
      preferences_disabled: 0,
      unknown: 0,
    };

    const unique_users = new Set<string>();
    const most_recent: typeof failures = [];

    if (failures) {
      failures.forEach((f) => {
        unique_users.add(f.user_id);

        // Extract reason from error message prefix
        let reason: EmailFailureReason = 'unknown';
        if (f.email_error) {
          if (f.email_error.includes('provider_unavailable'))
            reason = 'provider_unavailable';
          else if (f.email_error.includes('invalid_email')) reason = 'invalid_email';
          else if (f.email_error.includes('auth_failed')) reason = 'auth_failed';
          else if (f.email_error.includes('rate_limited')) reason = 'rate_limited';
          else if (f.email_error.includes('timeout')) reason = 'timeout';
          else if (f.email_error.includes('user_opted_out'))
            reason = 'user_opted_out';
          else if (f.email_error.includes('quiet_hours')) reason = 'quiet_hours';
          else if (f.email_error.includes('preferences_disabled'))
            reason = 'preferences_disabled';
        }

        failure_reasons[reason]++;

        if (most_recent.length < 10) {
          most_recent.push(f);
        }
      });
    }

    return {
      total_failures: failures?.length || 0,
      unique_users: unique_users.size,
      failure_reasons,
      most_recent_failures: most_recent.map((f) => ({
        notification_id: f.id,
        user_id: f.user_id,
        error: f.email_error || 'Unknown error',
        failed_at: f.email_failed_at || '',
      })),
    };
  } catch (err) {
    console.error('[EmailFailureTracking] Exception fetching stats:', err);
    return {
      total_failures: 0,
      unique_users: 0,
      failure_reasons: {
        provider_unavailable: 0,
        invalid_email: 0,
        auth_failed: 0,
        rate_limited: 0,
        timeout: 0,
        user_opted_out: 0,
        quiet_hours: 0,
        preferences_disabled: 0,
        unknown: 0,
      },
      most_recent_failures: [],
    };
  }
}

/**
 * Find notifications that failed due to retriable errors
 * Candidates for retry logic
 */
export async function getRetriableFailures(
  supabase: SupabaseClient,
  organizationId: string,
  minAgeMinutes: number = 5 // Don't retry failures younger than this
): Promise<
  Array<{
    id: string;
    user_id: string;
    type: string;
    title: string;
    email_error: string;
  }>
> {
  try {
    const cutoffTime = new Date(Date.now() - minAgeMinutes * 60 * 1000).toISOString();

    // Find failures that look retriable (timeout, rate limit, provider unavailable)
    const { data, error } = await supabase
      .from('notifications')
      .select('id, user_id, type, title, email_error')
      .eq('organization_id', organizationId)
      .lte('email_failed_at', cutoffTime)
      .is('email_sent_at', null)
      .or(
        `email_error.ilike.%timeout%,email_error.ilike.%rate_limit%,email_error.ilike.%provider_unavailable%`
      )
      .order('email_failed_at', { ascending: true })
      .limit(100);

    if (error) {
      console.error('[EmailFailureTracking] Error finding retriable failures:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('[EmailFailureTracking] Exception finding retriable failures:', err);
    return [];
  }
}

/**
 * Analyze failure patterns to detect systemic issues
 */
export async function analyzeFailurePatterns(
  supabase: SupabaseClient,
  organizationId: string,
  hoursBack: number = 24
): Promise<{
  failure_rate: number; // % of emails that failed
  is_healthy: boolean; // > 95% success rate
  detected_issues: string[];
  recommendation: string;
}> {
  try {
    const cutoffTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

    // Get total notifications
    const { count: totalCount } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .gte('created_at', cutoffTime);

    // Get failed notifications
    const { count: failedCount } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .gte('email_failed_at', cutoffTime)
      .is('email_sent_at', null);

    const totalNotifications = totalCount || 1; // Avoid division by zero
    const failedNotifications = failedCount || 0;
    const failure_rate = (failedNotifications / totalNotifications) * 100;
    const is_healthy = failure_rate < 5;

    const detected_issues: string[] = [];
    let recommendation = '';

    // Analyze failure stats to detect patterns
    const stats = await getEmailFailureStats(supabase, organizationId, hoursBack);

    if (stats.failure_reasons.provider_unavailable > 0) {
      detected_issues.push('Email provider temporarily unavailable');
      recommendation = 'Retry failed notifications once provider recovers';
    }

    if (stats.failure_reasons.rate_limited > 0) {
      detected_issues.push('Rate limiting detected from email provider');
      recommendation = 'Reduce email send rate and implement backoff logic';
    }

    if (stats.failure_reasons.invalid_email > 0) {
      detected_issues.push(`${stats.failure_reasons.invalid_email} invalid email addresses detected`);
      recommendation = 'Review user email addresses in user_profiles table';
    }

    if (failure_rate > 10) {
      detected_issues.push(`High failure rate: ${failure_rate.toFixed(1)}%`);
      recommendation = 'Investigation needed - check email provider status and logs';
    }

    if (!is_healthy && !recommendation) {
      recommendation = 'Monitor email delivery and investigate failures';
    }

    if (is_healthy) {
      recommendation = 'Email delivery is healthy';
    }

    return {
      failure_rate: parseFloat(failure_rate.toFixed(2)),
      is_healthy,
      detected_issues,
      recommendation,
    };
  } catch (err) {
    console.error('[EmailFailureTracking] Exception analyzing patterns:', err);
    return {
      failure_rate: 0,
      is_healthy: false,
      detected_issues: ['Error analyzing failure patterns'],
      recommendation: 'Check logs for details',
    };
  }
}

/**
 * Mark a failed notification as retried
 * Clears failure fields to allow retry attempt
 */
export async function markForRetry(
  supabase: SupabaseClient,
  notificationId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({
        email_failed_at: null,
        email_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', notificationId);

    if (error) {
      console.error('[EmailFailureTracking] Error marking for retry:', error);
      return false;
    }

    console.log(`[EmailFailureTracking] Marked for retry: ${notificationId}`);
    return true;
  } catch (err) {
    console.error('[EmailFailureTracking] Exception marking for retry:', err);
    return false;
  }
}

/**
 * Get a summary of email delivery health for admin dashboard
 */
export async function getDeliveryHealthSummary(
  supabase: SupabaseClient,
  organizationId: string
): Promise<{
  last_24h: {
    total_sent: number;
    total_failed: number;
    success_rate: number;
  };
  last_7d: {
    total_sent: number;
    total_failed: number;
    success_rate: number;
  };
  trends: {
    improving: boolean;
    message: string;
  };
}> {
  try {
    const analyze = async (hoursBack: number) => {
      const cutoffTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

      const { count: totalCount } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .gte('created_at', cutoffTime);

      const { count: successCount } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .gte('email_sent_at', cutoffTime);

      const total = totalCount || 0;
      const success = successCount || 0;
      const failed = total - success;
      const success_rate = total > 0 ? (success / total) * 100 : 0;

      return { total_sent: total, total_failed: failed, success_rate: parseFloat(success_rate.toFixed(1)) };
    };

    const last_24h = await analyze(24);
    const last_7d = await analyze(24 * 7);

    // Determine if improving
    const improving = last_24h.success_rate > last_7d.success_rate;
    const message = improving
      ? `Improving trend: ${last_24h.success_rate.toFixed(1)}% (24h) vs ${last_7d.success_rate.toFixed(1)}% (7d)`
      : `Declining trend: ${last_24h.success_rate.toFixed(1)}% (24h) vs ${last_7d.success_rate.toFixed(1)}% (7d)`;

    return {
      last_24h,
      last_7d,
      trends: { improving, message },
    };
  } catch (err) {
    console.error('[EmailFailureTracking] Exception getting health summary:', err);
    return {
      last_24h: { total_sent: 0, total_failed: 0, success_rate: 0 },
      last_7d: { total_sent: 0, total_failed: 0, success_rate: 0 },
      trends: { improving: false, message: 'Error retrieving data' },
    };
  }
}
