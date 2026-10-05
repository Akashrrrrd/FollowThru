/**
 * Notification Service - Centralized notification creation and delivery
 * Handles both in-app notifications and email delivery with idempotency guards
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { EmailProvider, type EmailOptions } from '@/lib/email-provider';
import {
  generateAssignmentIdempotencyKey,
  generateStatusChangeIdempotencyKey,
  generateDueDateChangeIdempotencyKey,
  checkIdempotentNotification,
} from '@/lib/idempotency-service';
import {
  recordEmailFailure,
  recordEmailSuccess,
  type EmailFailureReason,
} from '@/lib/email-failure-tracking';

export interface NotificationData {
  userId: string;
  organizationId: string;
  teamId?: string;
  commitmentId?: string;
  meetingId?: string;
  type:
    | 'assignment'
    | 'reassignment'
    | 'due_soon'
    | 'due_1h'
    | 'overdue'
    | 'escalation'
    | 'status_change'
    | 'completion'
    | 'team_invitation'
    | 'team_member_joined';
  title: string;
  message: string;
  actionUrl?: string;
  relatedUserId?: string;
  idempotencyKey?: string;
}

export interface EmailNotificationData extends NotificationData {
  recipientEmail: string;
  recipientName: string;
  emailSubject: string;
  emailTemplate: string; // Email HTML template
}

/**
 * Create an in-app notification in the unified notifications table
 * Uses idempotency key to prevent duplicates
 */
export async function createInAppNotification(
  supabase: SupabaseClient,
  data: NotificationData
): Promise<{ id: string; created: boolean } | null> {
  try {
    // If idempotency key provided, use it to prevent duplicates
    if (data.idempotencyKey) {
      // Check if notification with this key already exists
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('idempotency_key', data.idempotencyKey)
        .eq('user_id', data.userId)
        .maybeSingle();

      if (existing) {
        console.log(`[NotificationService] Idempotent notification already exists: ${data.idempotencyKey}`);
        return { id: existing.id, created: false };
      }
    }

    // Insert notification
    const { data: notification, error } = await supabase
      .from('notifications')
      .insert({
        user_id: data.userId,
        organization_id: data.organizationId,
        team_id: data.teamId,
        commitment_id: data.commitmentId,
        meeting_id: data.meetingId,
        type: data.type,
        title: data.title,
        message: data.message,
        action_url: data.actionUrl,
        related_user_id: data.relatedUserId,
        idempotency_key: data.idempotencyKey,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      console.error('[NotificationService] Error creating in-app notification:', error);
      return null;
    }

    console.log(`[NotificationService] Created in-app notification: ${notification.id}`);
    return { id: notification.id, created: true };
  } catch (err) {
    console.error('[NotificationService] Exception creating in-app notification:', err);
    return null;
  }
}

/**
 * Send an email notification
 * Tracks email delivery status in the notifications table
 * Integrates with email failure tracking for monitoring and retry logic
 */
export async function sendEmailNotification(
  supabase: SupabaseClient,
  notificationId: string,
  data: EmailNotificationData
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check user preferences for email notification type
    const { data: preferences, error: prefError } = await supabase
      .from('user_preferences')
      .select(
        `email_notifications_${data.type},
         notifications_enabled,
         quiet_hours_enabled,
         quiet_hours_start,
         quiet_hours_end,
         email_digest_enabled`
      )
      .eq('user_id', data.userId)
      .maybeSingle();

    // If preferences not found, assume defaults (all notifications enabled)
    if (!preferences) {
      console.log(`[NotificationService] No preferences found for user ${data.userId}, using defaults`);
    }

    // Check global notification toggle
    if (preferences && !preferences.notifications_enabled) {
      console.log(`[NotificationService] Notifications disabled globally for user ${data.userId}`);
      
      // Record user opt-out failure
      await recordEmailFailure(supabase, {
        notificationId,
        reason: 'user_opted_out',
        error: 'Notifications disabled by user',
        retriable: false,
      });

      return { success: false, error: 'Notifications disabled by user' };
    }

    // Check email preference for this notification type
    const emailPrefKey = `email_notifications_${data.type}` as const;
    if (preferences && !(preferences as any)[emailPrefKey]) {
      console.log(`[NotificationService] Email notifications disabled for type ${data.type}`);
      
      // Record preference-disabled failure
      await recordEmailFailure(supabase, {
        notificationId,
        reason: 'preferences_disabled',
        error: `Email notifications disabled for ${data.type}`,
        retriable: false,
      });

      return { success: false, error: `Email notifications disabled for ${data.type}` };
    }

    // Check quiet hours
    if (preferences?.quiet_hours_enabled) {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const start = preferences.quiet_hours_start;
      const end = preferences.quiet_hours_end;

      const isInQuietHours = start < end 
        ? currentTime >= start && currentTime < end
        : currentTime >= start || currentTime < end; // Handle wrapping (e.g., 22:00 - 08:00)

      if (isInQuietHours) {
        console.log(`[NotificationService] User ${data.userId} in quiet hours, skipping email`);
        
        // Record quiet hours failure
        await recordEmailFailure(supabase, {
          notificationId,
          reason: 'quiet_hours',
          error: 'Email skipped - user in quiet hours',
          retriable: true, // Can retry outside quiet hours
        });

        return { success: false, error: 'User in quiet hours' };
      }
    }

    // Send email
    const emailProvider = EmailProvider.getInstance();
    try {
      await emailProvider.send({
        to: data.recipientEmail,
        subject: data.emailSubject,
        html: data.emailTemplate,
      });
      
      // Email sent successfully - record success
      await recordEmailSuccess(supabase, notificationId);
      console.log(`[NotificationService] Email sent successfully for notification ${notificationId}`);
      return { success: true };
    } catch (emailError) {
      const errorMsg = emailError instanceof Error ? emailError.message : 'Unknown error';

      // Determine failure reason and whether it's retriable
      let failureReason: EmailFailureReason = 'unknown';
      let retriable = true; // Default to retriable for email provider errors

      const error = errorMsg?.toLowerCase() || '';
      if (error.includes('timeout')) {
        failureReason = 'timeout';
        retriable = true;
      } else if (error.includes('rate limit') || error.includes('rate_limit')) {
        failureReason = 'rate_limited';
        retriable = true;
      } else if (error.includes('provider unavailable') || error.includes('unavailable')) {
        failureReason = 'provider_unavailable';
        retriable = true;
      } else if (error.includes('invalid email') || error.includes('invalid_email')) {
        failureReason = 'invalid_email';
        retriable = false;
      } else if (error.includes('auth') || error.includes('authentication')) {
        failureReason = 'auth_failed';
        retriable = false;
      }

      // Record failure with tracking service
      await recordEmailFailure(supabase, {
        notificationId,
        reason: failureReason,
        error: errorMsg,
        retriable,
        metadata: {
          recipientEmail: data.recipientEmail,
          notificationType: data.type,
        },
      });

      console.error(`[NotificationService] Email send failed: ${errorMsg} (reason: ${failureReason}, retriable: ${retriable})`);
      return { success: false, error: errorMsg };
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';

    // Record exception as failure (unknown reason, retriable)
    await recordEmailFailure(supabase, {
      notificationId,
      reason: 'unknown',
      error: `Exception: ${errorMsg}`,
      retriable: true, // Exceptions may be transient
      metadata: {
        recipientEmail: data.recipientEmail,
        notificationType: data.type,
        exceptionType: err instanceof Error ? err.name : 'unknown',
      },
    });

    console.error('[NotificationService] Exception sending email:', err);
    return { success: false, error: errorMsg };
  }
}

/**
 * Create both in-app and email notification atomically
 * If either fails, still returns partial success
 */
export async function createNotification(
  supabase: SupabaseClient,
  inAppData: NotificationData,
  emailData?: EmailNotificationData
): Promise<{ inAppId?: string; emailSent: boolean; errors: string[] }> {
  const errors: string[] = [];

  // Create in-app notification
  const inAppResult = await createInAppNotification(supabase, inAppData);
  if (!inAppResult) {
    errors.push('Failed to create in-app notification');
  }

  // Send email if provided
  let emailSent = false;
  if (emailData && inAppResult) {
    const emailResult = await sendEmailNotification(supabase, inAppResult.id, emailData);
    if (!emailResult.success) {
      errors.push(`Email send failed: ${emailResult.error}`);
    } else {
      emailSent = true;
    }
  }

  return {
    inAppId: inAppResult?.id,
    emailSent,
    errors,
  };
}


/**
 * Trigger assignment notification when a task is assigned to a user
 * Creates both in-app and email notifications with preference checks
 */
export async function handleTaskAssignment(
  supabase: SupabaseClient,
  taskId: string,
  previousAssigneeId: string | null,
  newAssigneeId: string | null,
  taskData: {
    title: string;
    description: string;
    owner: string;
    dueDate?: string;
    organizationId: string;
    teamId?: string;
    meetingId?: string;
  },
  assignedByUserEmail?: string
): Promise<{ notificationId?: string; errors: string[] }> {
  const errors: string[] = [];

  // If no new assignee, nothing to do
  if (!newAssigneeId) {
    return { errors };
  }

  // If reassigning (was already assigned), use reassignment type
  const isReassignment = previousAssigneeId !== null && previousAssigneeId !== newAssigneeId;
  const notificationType = isReassignment ? 'reassignment' : 'assignment';

  try {
    // Get assignee email and name from user_profiles
    const { data: assigneeProfile } = await supabase
      .from('user_profiles')
      .select('email, display_name')
      .eq('id', newAssigneeId)
      .single();

    if (!assigneeProfile || !assigneeProfile.email) {
      errors.push(`Could not find user email for ${newAssigneeId}`);
      return { errors };
    }

    const assigneeEmail = assigneeProfile.email;
    const assigneeName = assigneeProfile.display_name || assigneeEmail.split('@')[0] || 'User';

    // Generate idempotency key to prevent duplicate notifications
    // Use task ID + assignee ID + action to ensure uniqueness
    const idempotencyKey = `${taskId}-${newAssigneeId}-${notificationType}-${Date.now()}`;

    // Import email template generators
    const { createAssignmentEmailTemplate, createReassignmentEmailTemplate } = await import(
      '@/lib/email-templates'
    );

    const template =
      notificationType === 'reassignment'
        ? createReassignmentEmailTemplate(assigneeName, {
            title: taskData.title,
            description: taskData.description,
            owner: taskData.owner,
            dueDate: taskData.dueDate,
            assignedBy: assignedByUserEmail,
            teamName: taskData.teamId ? taskData.teamId : undefined,
            actionUrl: `/commitment/${taskId}`,
          })
        : createAssignmentEmailTemplate(assigneeName, {
            title: taskData.title,
            description: taskData.description,
            owner: taskData.owner,
            dueDate: taskData.dueDate,
            assignedBy: assignedByUserEmail,
            teamName: taskData.teamId ? taskData.teamId : undefined,
            actionUrl: `/commitment/${taskId}`,
          });

    // Create notification with both in-app and email
    const result = await createNotification(
      supabase,
      {
        userId: newAssigneeId,
        organizationId: taskData.organizationId,
        teamId: taskData.teamId,
        commitmentId: taskId,
        meetingId: taskData.meetingId,
        type: notificationType,
        title: `${notificationType === 'reassignment' ? 'Reassigned' : 'Assigned'}: ${taskData.title}`,
        message: `${notificationType === 'reassignment' ? 'This commitment has been reassigned to you' : 'You have been assigned a new commitment'}: "${taskData.title}"`,
        actionUrl: `/commitment/${taskId}`,
        relatedUserId: assignedByUserEmail ? undefined : newAssigneeId,
        idempotencyKey,
      },
      {
        userId: newAssigneeId,
        organizationId: taskData.organizationId,
        teamId: taskData.teamId,
        commitmentId: taskId,
        meetingId: taskData.meetingId,
        type: notificationType,
        title: `${notificationType === 'reassignment' ? 'Reassigned' : 'Assigned'}: ${taskData.title}`,
        message: `${notificationType === 'reassignment' ? 'This commitment has been reassigned to you' : 'You have been assigned a new commitment'}: "${taskData.title}"`,
        actionUrl: `/commitment/${taskId}`,
        relatedUserId: assignedByUserEmail ? undefined : newAssigneeId,
        idempotencyKey,
        recipientEmail: assigneeEmail,
        recipientName: assigneeName,
        emailSubject: template.subject,
        emailTemplate: template.html,
      }
    );

    if (result.errors.length > 0) {
      errors.push(...result.errors);
    }

    return { notificationId: result.inAppId, errors };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    errors.push(`Exception handling assignment: ${error}`);
    console.error('[NotificationService] Exception handling task assignment:', err);
    return { errors };
  }
}


/**
 * Integrate Phase 4 escalations into Phase 5 notification system
 * Creates unified notifications when escalations occur
 */
export async function handleEscalationNotification(
  supabase: SupabaseClient,
  escalationHistoryId: string,
  escalationData: {
    taskId: string;
    taskDescription: string;
    organizationId: string;
    teamId?: string;
    escalatedToUserId: string;
    escalatedToUserRole: 'team_lead' | 'manager' | 'owner';
    escalationType: '24h_overdue' | '48h_overdue' | '72h_overdue';
    hoursOverdueAtEscalation: number;
    assignedToUserId?: string;
    dueDate?: string;
  },
  escalatedByUserEmail?: string
): Promise<{ notificationId?: string; errors: string[] }> {
  const errors: string[] = [];

  try {
    // Fetch escalated-to user email from user_profiles
    const { data: escalatedToUser } = await supabase
      .from('user_profiles')
      .select('email, display_name')
      .eq('id', escalationData.escalatedToUserId)
      .single();

    if (!escalatedToUser || !escalatedToUser.email) {
      errors.push(`Could not find user email for ${escalationData.escalatedToUserId}`);
      return { errors };
    }

    const recipientEmail = escalatedToUser.email;
    const recipientName =
      escalatedToUser.display_name ||
      recipientEmail.split('@')[0] ||
      'User';

    // Generate idempotency key using escalation_history ID
    const idempotencyKey = `escalation-${escalationHistoryId}`;

    // Format overdue duration for display
    const formatOverdueDuration = (hours: number): string => {
      if (hours < 24) return `${hours}h`;
      const days = Math.floor(hours / 24);
      return `${days}d`;
    };

    const overdueDuration = formatOverdueDuration(escalationData.hoursOverdueAtEscalation);
    const dueDateDisplay = escalationData.dueDate
      ? new Date(escalationData.dueDate).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : 'No due date';

    const escalationTitle = {
      team_lead: 'Escalated to Team Lead',
      manager: 'Escalated to Manager',
      owner: 'Escalated to Owner',
    }[escalationData.escalatedToUserRole];

    const message = `Commitment "${escalationData.taskDescription}" is overdue by ${overdueDuration} and has been escalated to the ${escalationData.escalatedToUserRole.replace('_', ' ')}`;

    // Create HTML email template for escalation
    const escalationEmailTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #ffffff;
            border-radius: 8px;
        }
        .header {
            border-bottom: 3px solid #dc2626;
            padding-bottom: 16px;
            margin-bottom: 24px;
        }
        .logo {
            font-size: 20px;
            font-weight: bold;
            color: #dc2626;
        }
        .alert {
            background-color: #fee2e2;
            border: 1px solid #fca5a5;
            border-left: 4px solid #dc2626;
            padding: 16px;
            margin-bottom: 24px;
            border-radius: 4px;
        }
        .alert-title {
            font-size: 16px;
            font-weight: 600;
            color: #991b1b;
            margin-bottom: 8px;
        }
        .alert-text {
            color: #7f1d1d;
            font-size: 14px;
        }
        .greeting {
            font-size: 18px;
            font-weight: 500;
            margin-bottom: 16px;
            color: #111;
        }
        .task-card {
            background-color: #fef2f2;
            border: 1px solid #fecaca;
            border-left: 4px solid #dc2626;
            padding: 16px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .task-title {
            font-size: 16px;
            font-weight: 600;
            color: #dc2626;
            margin-bottom: 8px;
        }
        .task-meta {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            font-size: 13px;
            color: #888;
            margin-top: 12px;
        }
        .meta-item {
            display: flex;
            flex-direction: column;
        }
        .meta-label {
            font-weight: 500;
            color: #666;
            margin-bottom: 2px;
        }
        .meta-value {
            color: #333;
        }
        .badge {
            display: inline-block;
            background-color: #dc2626;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
            margin-top: 8px;
        }
        .cta-button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #dc2626;
            color: white;
            text-decoration: none;
            border-radius: 4px;
            font-weight: 500;
            margin: 24px 0;
        }
        .cta-button:hover {
            background-color: #991b1b;
        }
        .footer {
            border-top: 1px solid #e0e0e0;
            padding-top: 16px;
            margin-top: 24px;
            font-size: 12px;
            color: #999;
            text-align: center;
        }
        .footer-link {
            color: #dc2626;
            text-decoration: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🚨 FollowThru</div>
        </div>

        <div class="alert">
            <div class="alert-title">⚠️ Commitment Escalation</div>
            <div class="alert-text">
                An overdue commitment has been escalated to you as the ${escalationData.escalatedToUserRole.replace('_', ' ')}.
            </div>
        </div>

        <div class="greeting">
            Hi ${recipientName},
        </div>

        <div class="task-card">
            <div class="task-title">${escapeHtml(escalationData.taskDescription)}</div>
            <div class="badge">Overdue ${overdueDuration}</div>
            <div class="task-meta">
                <div class="meta-item">
                    <div class="meta-label">Was Due</div>
                    <div class="meta-value">${dueDateDisplay}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Escalation Level</div>
                    <div class="meta-value">${escalationData.escalatedToUserRole.replace('_', ' ')}</div>
                </div>
            </div>
        </div>

        <div style="padding: 16px; background-color: #f9fafb; border-radius: 4px; margin: 20px 0;">
            <p style="margin-bottom: 8px;">
                <strong>What this means:</strong>
            </p>
            <p style="margin: 0; color: #666; font-size: 14px;">
                This commitment is overdue and requires your attention as a ${escalationData.escalatedToUserRole.replace('_', ' ')}.
                Please review the details below and take appropriate action to resolve the issue.
            </p>
        </div>

        <div style="text-align: center;">
            <a href="https://app.followthru.com/commitment/${escapeHtml(escalationData.taskId)}" class="cta-button">
                Review Commitment
            </a>
        </div>

        <div class="footer">
            <p>This is an automated escalation from FollowThru. Please do not reply to this email.</p>
            <p>
                <a href="https://app.followthru.com" class="footer-link">Visit FollowThru</a> | 
                <a href="https://app.followthru.com/preferences" class="footer-link">Notification Settings</a>
            </p>
        </div>
    </div>
</body>
</html>
`;

    // Create notification
    const result = await createNotification(
      supabase,
      {
        userId: escalationData.escalatedToUserId,
        organizationId: escalationData.organizationId,
        teamId: escalationData.teamId,
        commitmentId: escalationData.taskId,
        type: 'escalation',
        title: escalationTitle,
        message,
        actionUrl: `/commitment/${escalationData.taskId}`,
        relatedUserId: escalationData.assignedToUserId,
        idempotencyKey,
      },
      {
        userId: escalationData.escalatedToUserId,
        organizationId: escalationData.organizationId,
        teamId: escalationData.teamId,
        commitmentId: escalationData.taskId,
        type: 'escalation',
        title: escalationTitle,
        message,
        actionUrl: `/commitment/${escalationData.taskId}`,
        relatedUserId: escalationData.assignedToUserId,
        idempotencyKey,
        recipientEmail,
        recipientName,
        emailSubject: `🚨 ESCALATION: ${escalationData.taskDescription.substring(0, 40)}${escalationData.taskDescription.length > 40 ? '...' : ''}`,
        emailTemplate: escalationEmailTemplate,
      }
    );

    if (result.errors.length > 0) {
      errors.push(...result.errors);
    }

    return { notificationId: result.inAppId, errors };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    errors.push(`Exception handling escalation notification: ${error}`);
    console.error('[NotificationService] Exception handling escalation notification:', err);
    return { errors };
  }
}

/**
 * Utility function to escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}


/**
 * Handle status change notifications
 * Notifies task owner when status changes
 */
export async function handleStatusChangeNotification(
  supabase: SupabaseClient,
  taskData: {
    taskId: string;
    taskDescription: string;
    organizationId: string;
    teamId?: string;
    oldStatus: string;
    newStatus: string;
    assignedToUserId?: string;
    ownerUserId?: string;
    ownerEmail?: string;
    ownerName?: string;
  }
): Promise<{ notificationId?: string; errors: string[] }> {
  const errors: string[] = [];

  try {
    // Determine notification recipient - notify the task owner/assignee
    const recipientId = taskData.assignedToUserId || taskData.ownerUserId;
    if (!recipientId) {
      errors.push('No recipient found for status change notification');
      return { errors };
    }

    // Fetch recipient info if not provided
    let recipientEmail = taskData.ownerEmail;
    let recipientName = taskData.ownerName;

    if (!recipientEmail || !recipientName) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('email, display_name')
        .eq('id', recipientId)
        .single();

      if (!profile || !profile.email) {
        errors.push(`Could not find user email for ${recipientId}`);
        return { errors };
      }
      recipientEmail = profile.email;
      recipientName = profile.display_name || profile.email.split('@')[0] || 'User';
    }

    // Ensure recipientName is not undefined
    const displayName = recipientName || 'there';

    // Generate idempotency key
    const idempotencyKey = `status-${taskData.taskId}-${taskData.newStatus}-${Date.now()}`;

    // Create status message
    const statusMessage = `Status changed from ${taskData.oldStatus} to ${taskData.newStatus}`;
    const title = `Status Update: ${taskData.taskDescription}`;

    // Create email template for status change
    const statusEmailTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #ffffff;
            border-radius: 8px;
        }
        .header {
            border-bottom: 3px solid #8b5cf6;
            padding-bottom: 16px;
            margin-bottom: 24px;
        }
        .logo {
            font-size: 20px;
            font-weight: bold;
            color: #8b5cf6;
        }
        .greeting {
            font-size: 18px;
            font-weight: 500;
            margin-bottom: 16px;
            color: #111;
        }
        .status-card {
            background-color: #faf5ff;
            border: 1px solid #e9d5ff;
            border-left: 4px solid #8b5cf6;
            padding: 16px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .status-title {
            font-size: 16px;
            font-weight: 600;
            color: #8b5cf6;
            margin-bottom: 8px;
        }
        .status-change {
            display: flex;
            align-items: center;
            gap: 8px;
            margin: 12px 0;
        }
        .status-badge {
            display: inline-block;
            padding: 6px 12px;
            background-color: #e9d5ff;
            color: #6b21a8;
            border-radius: 4px;
            font-size: 13px;
            font-weight: 600;
        }
        .status-badge.new {
            background-color: #dbeafe;
            color: #1e40af;
        }
        .arrow {
            color: #999;
            font-size: 18px;
        }
        .cta-button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #8b5cf6;
            color: white;
            text-decoration: none;
            border-radius: 4px;
            font-weight: 500;
            margin: 24px 0;
        }
        .cta-button:hover {
            background-color: #7c3aed;
        }
        .footer {
            border-top: 1px solid #e0e0e0;
            padding-top: 16px;
            margin-top: 24px;
            font-size: 12px;
            color: #999;
            text-align: center;
        }
        .footer-link {
            color: #8b5cf6;
            text-decoration: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">✓ FollowThru</div>
        </div>

        <div class="greeting">
            Hi ${escapeHtml(displayName)},
        </div>

        <div style="margin-bottom: 24px;">
            <p>A commitment you're tracking has changed status:</p>
        </div>

        <div class="status-card">
            <div class="status-title">${escapeHtml(taskData.taskDescription)}</div>
            <div class="status-change">
                <span class="status-badge">${escapeHtml(taskData.oldStatus)}</span>
                <span class="arrow">→</span>
                <span class="status-badge new">${escapeHtml(taskData.newStatus)}</span>
            </div>
        </div>

        <div style="text-align: center;">
            <a href="https://app.followthru.com/commitment/${escapeHtml(taskData.taskId)}" class="cta-button">
                View Commitment
            </a>
        </div>

        <div class="footer">
            <p>This is an automated notification from FollowThru. Please do not reply to this email.</p>
            <p>
                <a href="https://app.followthru.com" class="footer-link">Visit FollowThru</a> | 
                <a href="https://app.followthru.com/preferences" class="footer-link">Notification Settings</a>
            </p>
        </div>
    </div>
</body>
</html>
`;

    // Create notification
    // Only send email if we have the recipient email
    if (!recipientEmail) {
      // In-app notification only if no email
      const result = await createNotification(
        supabase,
        {
          userId: recipientId,
          organizationId: taskData.organizationId,
          teamId: taskData.teamId,
          commitmentId: taskData.taskId,
          type: 'status_change',
          title,
          message: statusMessage,
          actionUrl: `/commitment/${taskData.taskId}`,
          idempotencyKey,
        }
      );

      if (result.errors.length > 0) {
        errors.push(...result.errors);
      }

      return { notificationId: result.inAppId, errors };
    }

    // Create notification with both in-app and email
    const result = await createNotification(
      supabase,
      {
        userId: recipientId,
        organizationId: taskData.organizationId,
        teamId: taskData.teamId,
        commitmentId: taskData.taskId,
        type: 'status_change',
        title,
        message: statusMessage,
        actionUrl: `/commitment/${taskData.taskId}`,
        idempotencyKey,
      },
      {
        userId: recipientId,
        organizationId: taskData.organizationId,
        teamId: taskData.teamId,
        commitmentId: taskData.taskId,
        type: 'status_change',
        title,
        message: statusMessage,
        actionUrl: `/commitment/${taskData.taskId}`,
        idempotencyKey,
        recipientEmail,
        recipientName: displayName,
        emailSubject: `Status Update: ${taskData.taskDescription.substring(0, 40)}${taskData.taskDescription.length > 40 ? '...' : ''}`,
        emailTemplate: statusEmailTemplate,
      }
    );

    if (result.errors.length > 0) {
      errors.push(...result.errors);
    }

    return { notificationId: result.inAppId, errors };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    errors.push(`Exception handling status change notification: ${error}`);
    console.error('[NotificationService] Exception handling status change:', err);
    return { errors };
  }
}

/**
 * Handle due date change notifications
 * Notifies task owner when due date changes (especially if changed to sooner)
 */
export async function handleDueDateChangeNotification(
  supabase: SupabaseClient,
  taskData: {
    taskId: string;
    taskDescription: string;
    organizationId: string;
    teamId?: string;
    oldDueDate?: string;
    newDueDate?: string;
    assignedToUserId?: string;
    ownerUserId?: string;
    ownerEmail?: string;
    ownerName?: string;
  }
): Promise<{ notificationId?: string; errors: string[] }> {
  const errors: string[] = [];

  try {
    // Skip if date didn't actually change
    if (taskData.oldDueDate === taskData.newDueDate) {
      return { errors };
    }

    // Determine notification recipient
    const recipientId = taskData.assignedToUserId || taskData.ownerUserId;
    if (!recipientId) {
      errors.push('No recipient found for due date change notification');
      return { errors };
    }

    // Fetch recipient info if not provided
    let recipientEmail = taskData.ownerEmail;
    let recipientName = taskData.ownerName;

    if (!recipientEmail || !recipientName) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('email, display_name')
        .eq('id', recipientId)
        .single();

      if (!profile || !profile.email) {
        errors.push(`Could not find user email for ${recipientId}`);
        return { errors };
      }
      recipientEmail = profile.email;
      recipientName = profile.display_name || profile.email.split('@')[0] || 'User';
    }

    // Ensure displayName is not undefined
    const displayName = recipientName || 'there';

    // Format dates for display
    const formatDate = (date?: string): string => {
      if (!date) return 'No due date';
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    };

    // Generate idempotency key
    const idempotencyKey = `duedate-${taskData.taskId}-${taskData.newDueDate || 'none'}-${Date.now()}`;

    // Determine if date moved earlier or later
    const isEarlier =
      taskData.newDueDate && taskData.oldDueDate && new Date(taskData.newDueDate) < new Date(taskData.oldDueDate);

    const dateMessage = `Due date ${isEarlier ? 'moved up' : 'changed'} from ${formatDate(taskData.oldDueDate)} to ${formatDate(taskData.newDueDate)}`;
    const title = isEarlier ? `Due Date Moved Up: ${taskData.taskDescription}` : `Due Date Updated: ${taskData.taskDescription}`;

    // Create email template for due date change
    const dueDateEmailTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #ffffff;
            border-radius: 8px;
        }
        .header {
            border-bottom: 3px solid #f59e0b;
            padding-bottom: 16px;
            margin-bottom: 24px;
        }
        .logo {
            font-size: 20px;
            font-weight: bold;
            color: #f59e0b;
        }
        .greeting {
            font-size: 18px;
            font-weight: 500;
            margin-bottom: 16px;
            color: #111;
        }
        .alert {
            background-color: #fffbeb;
            border: 1px solid #fcd34d;
            border-left: 4px solid #f59e0b;
            padding: 12px;
            margin-bottom: 16px;
            border-radius: 4px;
            font-size: 14px;
            color: #92400e;
        }
        .date-card {
            background-color: #fef3c7;
            border: 1px solid #fde68a;
            border-left: 4px solid #f59e0b;
            padding: 16px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .date-title {
            font-size: 16px;
            font-weight: 600;
            color: #f59e0b;
            margin-bottom: 8px;
        }
        .date-change {
            display: flex;
            align-items: center;
            gap: 8px;
            margin: 12px 0;
        }
        .date-badge {
            display: inline-block;
            padding: 6px 12px;
            background-color: #fed7aa;
            color: #92400e;
            border-radius: 4px;
            font-size: 13px;
            font-weight: 600;
        }
        .date-badge.new {
            background-color: #dbeafe;
            color: #1e40af;
        }
        .arrow {
            color: #999;
            font-size: 18px;
        }
        .cta-button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #f59e0b;
            color: white;
            text-decoration: none;
            border-radius: 4px;
            font-weight: 500;
            margin: 24px 0;
        }
        .cta-button:hover {
            background-color: #d97706;
        }
        .footer {
            border-top: 1px solid #e0e0e0;
            padding-top: 16px;
            margin-top: 24px;
            font-size: 12px;
            color: #999;
            text-align: center;
        }
        .footer-link {
            color: #f59e0b;
            text-decoration: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">✓ FollowThru</div>
        </div>

        ${
          isEarlier
            ? `
        <div class="alert">
            ⚠️ The due date for this commitment has been moved up to an earlier date.
        </div>
        `
            : ''
        }

        <div class="greeting">
            Hi ${escapeHtml(displayName)},
        </div>

        <div style="margin-bottom: 24px;">
            <p>The due date for a commitment you're tracking has been updated:</p>
        </div>

        <div class="date-card">
            <div class="date-title">${escapeHtml(taskData.taskDescription)}</div>
            <div class="date-change">
                <span class="date-badge">${formatDate(taskData.oldDueDate)}</span>
                <span class="arrow">→</span>
                <span class="date-badge new">${formatDate(taskData.newDueDate)}</span>
            </div>
        </div>

        <div style="text-align: center;">
            <a href="https://app.followthru.com/commitment/${escapeHtml(taskData.taskId)}" class="cta-button">
                View Commitment
            </a>
        </div>

        <div class="footer">
            <p>This is an automated notification from FollowThru. Please do not reply to this email.</p>
            <p>
                <a href="https://app.followthru.com" class="footer-link">Visit FollowThru</a> | 
                <a href="https://app.followthru.com/preferences" class="footer-link">Notification Settings</a>
            </p>
        </div>
    </div>
</body>
</html>
`;

    // Create notification
    // Only send email if we have the recipient email
    if (!recipientEmail) {
      // In-app notification only if no email
      const result = await createNotification(
        supabase,
        {
          userId: recipientId,
          organizationId: taskData.organizationId,
          teamId: taskData.teamId,
          commitmentId: taskData.taskId,
          type: 'status_change', // Use status_change type for due date changes too (it's a general update)
          title,
          message: dateMessage,
          actionUrl: `/commitment/${taskData.taskId}`,
          idempotencyKey,
        }
      );

      if (result.errors.length > 0) {
        errors.push(...result.errors);
      }

      return { notificationId: result.inAppId, errors };
    }

    // Create notification with both in-app and email
    const result = await createNotification(
      supabase,
      {
        userId: recipientId,
        organizationId: taskData.organizationId,
        teamId: taskData.teamId,
        commitmentId: taskData.taskId,
        type: 'status_change', // Use status_change type for due date changes too (it's a general update)
        title,
        message: dateMessage,
        actionUrl: `/commitment/${taskData.taskId}`,
        idempotencyKey,
      },
      {
        userId: recipientId,
        organizationId: taskData.organizationId,
        teamId: taskData.teamId,
        commitmentId: taskData.taskId,
        type: 'status_change',
        title,
        message: dateMessage,
        actionUrl: `/commitment/${taskData.taskId}`,
        idempotencyKey,
        recipientEmail,
        recipientName: displayName,
        emailSubject: title,
        emailTemplate: dueDateEmailTemplate,
      }
    );

    if (result.errors.length > 0) {
      errors.push(...result.errors);
    }

    return { notificationId: result.inAppId, errors };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    errors.push(`Exception handling due date change notification: ${error}`);
    console.error('[NotificationService] Exception handling due date change:', err);
    return { errors };
  }
}
