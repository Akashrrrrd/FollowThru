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
  send(options: { to: string; subject: string; html: string; text?: string }): Promise<boolean>;
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class ConsoleEmailProvider implements EmailProvider {
  async send(toOrOptions: any, subject?: string, body?: string): Promise<boolean> {
    if (typeof toOrOptions === 'object') {
      // New signature: send({to, subject, html, text})
      const { to, subject: subj, html, text } = toOrOptions;
      console.log(`\n[EMAIL - CONSOLE MODE]\nTo: ${to}\nSubject: ${subj}\n\n${html || text}\n`);
    } else {
      // Old signature: send(to, subject, body)
      console.log(`\n[EMAIL - CONSOLE MODE]\nTo: ${toOrOptions}\nSubject: ${subject}\n\n${body}\n`);
    }
    return true;
  }
}

class ResendEmailProvider implements EmailProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async send(toOrOptions: any, subject?: string, body?: string): Promise<boolean> {
    try {
      let to: string;
      let finalSubject: string;
      let html: string;

      if (typeof toOrOptions === 'object') {
        // New signature: send({to, subject, html, text})
        to = toOrOptions.to;
        finalSubject = toOrOptions.subject;
        html = toOrOptions.html;
      } else {
        // Old signature: send(to, subject, body)
        to = toOrOptions;
        finalSubject = subject || '';
        html = body || '';
      }

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          from: 'FollowThru <noreply@followthru.app>',
          to,
          subject: finalSubject,
          html,
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
  const apiKey = process.env.RESEND_API_KEY;

  if (apiKey) {
    return new ResendEmailProvider(apiKey);
  }

  // Fall back to console for development if no API key
  console.warn('[EMAIL] RESEND_API_KEY not set. Using console provider.');
  return new ConsoleEmailProvider();
}

// Singleton instance
let instance: EmailProvider | null = null;

export class EmailProvider {
  static getInstance(): EmailProvider {
    if (!instance) {
      instance = getEmailProvider();
    }
    return instance;
  }
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
