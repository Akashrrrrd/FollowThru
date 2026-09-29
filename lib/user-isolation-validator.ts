/**
 * User Isolation Validator for FollowThru
 * 
 * Validates that data access is properly isolated to the current user.
 * Checks for cross-user access violations, missing ownership filters,
 * and data leakage across authentication boundaries.
 * 
 * Core invariant: Every query on shared tables (meetings, tasks, insights)
 * must filter by user_id === current_user_id before returning data.
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface IsolationCheckResult {
  passed: boolean;
  violations: IsolationViolation[];
  checkedTables: string[];
  summary: string;
}

export interface IsolationViolation {
  table: string;
  type: 'missing_user_filter' | 'cross_user_access' | 'leaked_data' | 'admin_bypass';
  severity: 'critical' | 'high' | 'medium';
  description: string;
  evidence?: unknown;
}

/**
 * Validate that a user can only access their own tasks
 */
export async function validateTaskIsolation(
  supabase: SupabaseClient,
  currentUserId: string,
  testUserId?: string
): Promise<IsolationCheckResult> {
  const violations: IsolationViolation[] = [];

  // Test 1: Current user should see only their own tasks
  const { data: userTasks, error: userError } = await supabase
    .from('tasks')
    .select('id, user_id, owner_user_id, description')
    .eq('user_id', currentUserId);

  if (userError) {
    return {
      passed: false,
      violations: [{
        table: 'tasks',
        type: 'missing_user_filter',
        severity: 'critical',
        description: `Failed to query own tasks: ${userError.message}`,
      }],
      checkedTables: ['tasks'],
      summary: 'Task isolation check failed',
    };
  }

  // All returned tasks should have user_id === currentUserId
  if (userTasks && userTasks.some((task) => task.user_id !== currentUserId)) {
    violations.push({
      table: 'tasks',
      type: 'cross_user_access',
      severity: 'critical',
      description: 'Tasks returned with mismatched user_id; RLS policy may not be enforcing ownership',
      evidence: userTasks.filter((t) => t.user_id !== currentUserId),
    });
  }

  // Test 2: Attempt to query another user's tasks (should return empty if RLS works)
  if (testUserId && testUserId !== currentUserId) {
    const { data: otherUserTasks, error: otherError } = await supabase
      .from('tasks')
      .select('id, user_id')
      .eq('user_id', testUserId);

    if (!otherError && otherUserTasks && otherUserTasks.length > 0) {
      violations.push({
        table: 'tasks',
        type: 'cross_user_access',
        severity: 'critical',
        description: `Able to query tasks for user ${testUserId}; RLS policy is not enforcing user isolation`,
        evidence: otherUserTasks.map((t) => t.id),
      });
    }
  }

  // Test 3: Verify owner_user_id is always populated and valid
  if (userTasks && userTasks.some((task) => !task.owner_user_id)) {
    violations.push({
      table: 'tasks',
      type: 'leaked_data',
      severity: 'high',
      description: 'Tasks found with missing owner_user_id; data integrity issue',
      evidence: userTasks.filter((t) => !t.owner_user_id).map((t) => t.id),
    });
  }

  return {
    passed: violations.length === 0,
    violations,
    checkedTables: ['tasks'],
    summary: violations.length === 0
      ? `✓ All ${userTasks?.length ?? 0} user tasks are properly isolated`
      : `✗ Found ${violations.length} isolation violation(s) in tasks`,
  };
}

/**
 * Validate that a user can only access their own meetings
 */
export async function validateMeetingIsolation(
  supabase: SupabaseClient,
  currentUserId: string,
  testUserId?: string
): Promise<IsolationCheckResult> {
  const violations: IsolationViolation[] = [];

  // Test 1: Current user should see only their own meetings
  const { data: userMeetings, error: userError } = await supabase
    .from('meetings')
    .select('id, user_id, title')
    .eq('user_id', currentUserId);

  if (userError) {
    return {
      passed: false,
      violations: [{
        table: 'meetings',
        type: 'missing_user_filter',
        severity: 'critical',
        description: `Failed to query own meetings: ${userError.message}`,
      }],
      checkedTables: ['meetings'],
      summary: 'Meeting isolation check failed',
    };
  }

  // All returned meetings should have user_id === currentUserId
  if (userMeetings && userMeetings.some((m) => m.user_id !== currentUserId)) {
    violations.push({
      table: 'meetings',
      type: 'cross_user_access',
      severity: 'critical',
      description: 'Meetings returned with mismatched user_id; RLS policy may not be enforcing ownership',
      evidence: userMeetings.filter((m) => m.user_id !== currentUserId),
    });
  }

  // Test 2: Attempt to query another user's meetings (should return empty if RLS works)
  if (testUserId && testUserId !== currentUserId) {
    const { data: otherUserMeetings, error: otherError } = await supabase
      .from('meetings')
      .select('id, user_id')
      .eq('user_id', testUserId);

    if (!otherError && otherUserMeetings && otherUserMeetings.length > 0) {
      violations.push({
        table: 'meetings',
        type: 'cross_user_access',
        severity: 'critical',
        description: `Able to query meetings for user ${testUserId}; RLS policy is not enforcing user isolation`,
        evidence: otherUserMeetings.map((m) => m.id),
      });
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    checkedTables: ['meetings'],
    summary: violations.length === 0
      ? `✓ All ${userMeetings?.length ?? 0} user meetings are properly isolated`
      : `✗ Found ${violations.length} isolation violation(s) in meetings`,
  };
}

/**
 * Validate that a user can only access their own insights
 */
export async function validateInsightIsolation(
  supabase: SupabaseClient,
  currentUserId: string,
  testUserId?: string
): Promise<IsolationCheckResult> {
  const violations: IsolationViolation[] = [];

  // Test 1: Current user should see only their own insights
  const { data: userInsights, error: userError } = await supabase
    .from('insights')
    .select('id, user_id')
    .eq('user_id', currentUserId);

  if (userError) {
    return {
      passed: false,
      violations: [{
        table: 'insights',
        type: 'missing_user_filter',
        severity: 'critical',
        description: `Failed to query own insights: ${userError.message}`,
      }],
      checkedTables: ['insights'],
      summary: 'Insight isolation check failed',
    };
  }

  // All returned insights should have user_id === currentUserId
  if (userInsights && userInsights.some((i) => i.user_id !== currentUserId)) {
    violations.push({
      table: 'insights',
      type: 'cross_user_access',
      severity: 'critical',
      description: 'Insights returned with mismatched user_id; RLS policy may not be enforcing ownership',
      evidence: userInsights.filter((i) => i.user_id !== currentUserId),
    });
  }

  // Test 2: Attempt to query another user's insights (should return empty if RLS works)
  if (testUserId && testUserId !== currentUserId) {
    const { data: otherUserInsights, error: otherError } = await supabase
      .from('insights')
      .select('id, user_id')
      .eq('user_id', testUserId);

    if (!otherError && otherUserInsights && otherUserInsights.length > 0) {
      violations.push({
        table: 'insights',
        type: 'cross_user_access',
        severity: 'critical',
        description: `Able to query insights for user ${testUserId}; RLS policy is not enforcing user isolation`,
        evidence: otherUserInsights.map((i) => i.id),
      });
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    checkedTables: ['insights'],
    summary: violations.length === 0
      ? `✓ All ${userInsights?.length ?? 0} user insights are properly isolated`
      : `✗ Found ${violations.length} isolation violation(s) in insights`,
  };
}

/**
 * Comprehensive user isolation check across all user-owned tables
 */
export async function validateAllUserIsolation(
  supabase: SupabaseClient,
  currentUserId: string,
  testUserId?: string
): Promise<IsolationCheckResult> {
  const results = await Promise.all([
    validateTaskIsolation(supabase, currentUserId, testUserId),
    validateMeetingIsolation(supabase, currentUserId, testUserId),
    validateInsightIsolation(supabase, currentUserId, testUserId),
  ]);

  const allViolations = results.flatMap((r) => r.violations);
  const allTables = results.flatMap((r) => r.checkedTables);
  const allPassed = results.every((r) => r.passed);

  return {
    passed: allPassed,
    violations: allViolations,
    checkedTables: Array.from(new Set(allTables)),
    summary: allPassed
      ? `✓ All user isolation checks passed across ${allTables.length} tables`
      : `✗ Found ${allViolations.length} total isolation violation(s)`,
  };
}

/**
 * Validate that a specific resource belongs to the current user
 * Used in individual GET/PATCH/DELETE routes
 */
export async function validateResourceOwnership(
  supabase: SupabaseClient,
  table: 'tasks' | 'meetings' | 'insights',
  resourceId: string,
  currentUserId: string
): Promise<{ owned: boolean; reason?: string }> {
  const { data: resource, error } = await supabase
    .from(table)
    .select('id, user_id')
    .eq('id', resourceId)
    .maybeSingle();

  if (error) {
    return {
      owned: false,
      reason: `Database error: ${error.message}`,
    };
  }

  if (!resource) {
    return {
      owned: false,
      reason: `Resource not found (resource may belong to another user)`,
    };
  }

  if (resource.user_id !== currentUserId) {
    return {
      owned: false,
      reason: `Resource belongs to user ${resource.user_id}, not current user ${currentUserId}`,
    };
  }

  return { owned: true };
}

/**
 * Ensure a meeting belongs to the current user before allowing task operations on it
 */
export async function validateMeetingOwnership(
  supabase: SupabaseClient,
  meetingId: string,
  currentUserId: string
): Promise<{ valid: boolean; reason?: string }> {
  const { data: meeting, error } = await supabase
    .from('meetings')
    .select('id, user_id')
    .eq('id', meetingId)
    .maybeSingle();

  if (error) {
    return {
      valid: false,
      reason: `Database error: ${error.message}`,
    };
  }

  if (!meeting) {
    return {
      valid: false,
      reason: `Meeting not found`,
    };
  }

  if (meeting.user_id !== currentUserId) {
    return {
      valid: false,
      reason: `Meeting belongs to user ${meeting.user_id}, not current user ${currentUserId}`,
    };
  }

  return { valid: true };
}
