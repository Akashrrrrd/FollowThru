/**
 * Email Provider Abstraction
 * 
 * Supports multiple email providers with a unified interface:
 * - Resend (recommended, simple API)
 * - Console (development, logs to stdout)
 * - Custom (placeholder for other providers)
 */

export interface EmailProvider {
  send(to: string, subject: string, body: string): Promise<boolean>;
}

class ConsoleEmailProvider implements EmailProvider {
  async send(to: string, subject: string, body: string): Promise<boolean> {
    console.log(`\n[EMAIL - CONSOLE MODE]\nTo: ${to}\nSubject: ${subject}\n\n${body}\n`);
    return true;
  }
}

class ResendEmailProvider implements EmailProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async send(to: string, subject: string, body: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          from: 'FollowThru <noreply@followthru.app>',
          to,
          subject,
          html: body,
        }),
      });

      if (!response.ok) {
        console.error('Resend API error:', response.statusText);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Resend send error:', err);
      return false;
    }
  }
}

export function getEmailProvider(): EmailProvider {
  const provider = process.env.EMAIL_PROVIDER || 'console';
  const apiKey = process.env.EMAIL_API_KEY;

  if (provider === 'resend') {
    if (!apiKey) {
      console.warn('[EMAIL] Resend provider configured but EMAIL_API_KEY not set. Falling back to console.');
      return new ConsoleEmailProvider();
    }
    return new ResendEmailProvider(apiKey);
  }

  // Default to console for development
  return new ConsoleEmailProvider();
}

/**
 * Email templates
 */

export function createUpcomingReminderEmail(
  taskDescription: string,
  dueDate: string,
  daysUntilDue: number,
): string {
  const dateStr = new Date(dueDate).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>FollowThru Reminder</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
      .body { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
      .commitment { background: white; padding: 15px; border-left: 4px solid #667eea; margin: 15px 0; }
      .due-date { color: #667eea; font-weight: bold; }
      .button { background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block; margin-top: 15px; }
      .footer { color: #666; font-size: 12px; margin-top: 20px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h2>📋 Commitment Due Soon</h2>
      </div>
      <div class="body">
        <p>Hi,</p>
        <p>You have a commitment due in <strong>${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'}</strong>:</p>
        
        <div class="commitment">
          <p><strong>${taskDescription}</strong></p>
          <p>Due: <span class="due-date">${dateStr}</span></p>
        </div>
        
        <p>Make sure to keep this commitment on track!</p>
        
        <a href="https://followthru.app/dashboard" class="button">View Dashboard</a>
        
        <div class="footer">
          <p>This is an automated reminder from FollowThru.</p>
        </div>
      </div>
    </div>
  </body>
</html>
  `;
}

export function createOverdueReminderEmail(taskDescription: string, dueDate: string, daysSinceOverdue: number): string {
  const dateStr = new Date(dueDate).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>FollowThru Overdue Reminder</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
      .body { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
      .commitment { background: white; padding: 15px; border-left: 4px solid #f5576c; margin: 15px 0; }
      .due-date { color: #f5576c; font-weight: bold; }
      .button { background: #f5576c; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block; margin-top: 15px; }
      .footer { color: #666; font-size: 12px; margin-top: 20px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h2>⚠️ Commitment Overdue</h2>
      </div>
      <div class="body">
        <p>Hi,</p>
        <p>The following commitment is <strong>${daysSinceOverdue} day${daysSinceOverdue === 1 ? '' : 's'} overdue</strong>:</p>
        
        <div class="commitment">
          <p><strong>${taskDescription}</strong></p>
          <p>Was due: <span class="due-date">${dateStr}</span></p>
        </div>
        
        <p>Please update the status or let us know if you need help.</p>
        
        <a href="https://followthru.app/dashboard" class="button">Update Status</a>
        
        <div class="footer">
          <p>This is an automated reminder from FollowThru.</p>
        </div>
      </div>
    </div>
  </body>
</html>
  `;
}
