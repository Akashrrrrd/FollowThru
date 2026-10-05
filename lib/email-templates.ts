/**
 * Email Template Generator
 * Creates professional HTML email templates for various notification types
 */

interface TaskData {
  title: string;
  description: string;
  dueDate?: string;
  owner?: string;
  assignedBy?: string;
  teamName?: string;
  actionUrl?: string;
}

interface EmailTemplate {
  subject: string;
  html: string;
}

/**
 * Generate assignment notification email template
 */
export function createAssignmentEmailTemplate(
  recipientName: string,
  taskData: TaskData
): EmailTemplate {
  const dueDateDisplay = taskData.dueDate
    ? new Date(taskData.dueDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'No due date set';

  const html = `
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
            border-bottom: 3px solid #0066cc;
            padding-bottom: 16px;
            margin-bottom: 24px;
        }
        .logo {
            font-size: 20px;
            font-weight: bold;
            color: #0066cc;
        }
        .greeting {
            font-size: 18px;
            font-weight: 500;
            margin-bottom: 16px;
            color: #111;
        }
        .message {
            margin-bottom: 24px;
            color: #555;
        }
        .task-card {
            background-color: #f9f9f9;
            border: 1px solid #e0e0e0;
            border-left: 4px solid #0066cc;
            padding: 16px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .task-title {
            font-size: 16px;
            font-weight: 600;
            color: #0066cc;
            margin-bottom: 8px;
        }
        .task-description {
            color: #666;
            font-size: 14px;
            margin-bottom: 12px;
            line-height: 1.5;
        }
        .task-meta {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            font-size: 13px;
            color: #888;
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
        .cta-button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #0066cc;
            color: white;
            text-decoration: none;
            border-radius: 4px;
            font-weight: 500;
            margin: 24px 0;
        }
        .cta-button:hover {
            background-color: #0052a3;
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
            color: #0066cc;
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
            Hi ${recipientName},
        </div>

        <div class="message">
            ${
              taskData.assignedBy
                ? `<p><strong>${taskData.assignedBy}</strong> has assigned you a new commitment:</p>`
                : '<p>You have been assigned a new commitment:</p>'
            }
        </div>

        <div class="task-card">
            <div class="task-title">${escapeHtml(taskData.title)}</div>
            <div class="task-description">${escapeHtml(taskData.description)}</div>
            <div class="task-meta">
                <div class="meta-item">
                    <div class="meta-label">Due Date</div>
                    <div class="meta-value">${dueDateDisplay}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Owner</div>
                    <div class="meta-value">${taskData.owner || 'Not assigned'}</div>
                </div>
                ${
                  taskData.teamName
                    ? `
                <div class="meta-item">
                    <div class="meta-label">Team</div>
                    <div class="meta-value">${escapeHtml(taskData.teamName)}</div>
                </div>
                `
                    : ''
                }
            </div>
        </div>

        ${
          taskData.actionUrl
            ? `
        <div style="text-align: center;">
            <a href="${escapeHtml(taskData.actionUrl)}" class="cta-button">View Commitment</a>
        </div>
        `
            : ''
        }

        <div class="message">
            <p>
                Please review the commitment details and reach out if you have any questions.
            </p>
            <p>
                You can manage your notification preferences in <a href="https://app.followthru.com/preferences" style="color: #0066cc; text-decoration: none;">your settings</a>.
            </p>
        </div>

        <div class="footer">
            <p>This is an automated message from FollowThru. Please do not reply to this email.</p>
            <p><a href="https://app.followthru.com" class="footer-link">Visit FollowThru</a> | 
               <a href="https://app.followthru.com/preferences" class="footer-link">Notification Settings</a></p>
        </div>
    </div>
</body>
</html>
`;

  return {
    subject: `New Commitment Assignment: ${taskData.title}`,
    html: html.trim(),
  };
}

/**
 * Generate reassignment notification email template
 */
export function createReassignmentEmailTemplate(
  recipientName: string,
  taskData: TaskData
): EmailTemplate {
  const dueDateDisplay = taskData.dueDate
    ? new Date(taskData.dueDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'No due date set';

  const html = `
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
            border-bottom: 3px solid #9333ea;
            padding-bottom: 16px;
            margin-bottom: 24px;
        }
        .logo {
            font-size: 20px;
            font-weight: bold;
            color: #9333ea;
        }
        .greeting {
            font-size: 18px;
            font-weight: 500;
            margin-bottom: 16px;
            color: #111;
        }
        .message {
            margin-bottom: 24px;
            color: #555;
        }
        .task-card {
            background-color: #faf5ff;
            border: 1px solid #e9d5ff;
            border-left: 4px solid #9333ea;
            padding: 16px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .task-title {
            font-size: 16px;
            font-weight: 600;
            color: #9333ea;
            margin-bottom: 8px;
        }
        .task-description {
            color: #666;
            font-size: 14px;
            margin-bottom: 12px;
            line-height: 1.5;
        }
        .task-meta {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            font-size: 13px;
            color: #888;
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
        .cta-button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #9333ea;
            color: white;
            text-decoration: none;
            border-radius: 4px;
            font-weight: 500;
            margin: 24px 0;
        }
        .cta-button:hover {
            background-color: #7e22ce;
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
            color: #9333ea;
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
            Hi ${recipientName},
        </div>

        <div class="message">
            <p>A commitment has been reassigned to you:</p>
        </div>

        <div class="task-card">
            <div class="task-title">${escapeHtml(taskData.title)}</div>
            <div class="task-description">${escapeHtml(taskData.description)}</div>
            <div class="task-meta">
                <div class="meta-item">
                    <div class="meta-label">Due Date</div>
                    <div class="meta-value">${dueDateDisplay}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Owner</div>
                    <div class="meta-value">${taskData.owner || 'Not assigned'}</div>
                </div>
            </div>
        </div>

        ${
          taskData.actionUrl
            ? `
        <div style="text-align: center;">
            <a href="${escapeHtml(taskData.actionUrl)}" class="cta-button">View Commitment</a>
        </div>
        `
            : ''
        }

        <div class="footer">
            <p>This is an automated message from FollowThru. Please do not reply to this email.</p>
            <p><a href="https://app.followthru.com" class="footer-link">Visit FollowThru</a> | 
               <a href="https://app.followthru.com/preferences" class="footer-link">Notification Settings</a></p>
        </div>
    </div>
</body>
</html>
`;

  return {
    subject: `Commitment Reassigned: ${taskData.title}`,
    html: html.trim(),
  };
}

/**
 * Escape HTML special characters to prevent injection
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
