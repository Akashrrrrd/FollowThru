/**
 * Email Provider Abstraction
 *
 * Supports multiple email providers with a unified interface:
 * - Resend (recommended, simple API)
 * - Console (development, logs to stdout)
 *
 * Fixes vs. previous version:
 *  - `interface EmailProvider` and `class EmailProvider` shared a name
 *    (duplicate identifier). The interface is now `IEmailProvider`.
 *  - send() returned `false` on failure, so callers' try/catch never ran and
 *    failed deliveries were reported as "Invitation sent". It now throws.
 *  - Plain-text body is now sent to Resend.
 *  - Sender address is configurable via EMAIL_FROM.
 */

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface IEmailProvider {
  send(options: EmailOptions): Promise<void>;
  /** Legacy signature: send(to, subject, htmlBody) */
  send(to: string, subject: string, body: string): Promise<void>;
}

function normalizeArgs(
  toOrOptions: string | EmailOptions,
  subject?: string,
  body?: string,
): EmailOptions {
  if (typeof toOrOptions === 'object') return toOrOptions;
  return { to: toOrOptions, subject: subject ?? '', html: body ?? '' };
}

class ConsoleEmailProvider implements IEmailProvider {
  async send(options: EmailOptions): Promise<void>;
  async send(to: string, subject: string, body: string): Promise<void>;
  async send(toOrOptions: string | EmailOptions, subject?: string, body?: string): Promise<void> {
    const { to, subject: subj, html, text } = normalizeArgs(toOrOptions, subject, body);
    console.log(
      `\n[EMAIL - CONSOLE MODE]\nTo: ${to}\nSubject: ${subj}\n\n${text || html}\n`,
    );
  }
}

class ResendEmailProvider implements IEmailProvider {
  private apiKey: string;
  private from: string;

  constructor(apiKey: string, from: string) {
    this.apiKey = apiKey;
    this.from = from;
  }

  async send(options: EmailOptions): Promise<void>;
  async send(to: string, subject: string, body: string): Promise<void>;
  async send(toOrOptions: string | EmailOptions, subject?: string, body?: string): Promise<void> {
    const { to, subject: subj, html, text } = normalizeArgs(toOrOptions, subject, body);

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        from: this.from,
        to,
        subject: subj,
        html,
        ...(text ? { text } : {}),
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => response.statusText);
      throw new Error(`Resend API error (${response.status}): ${detail}`);
    }
  }
}

export function getEmailProvider(): IEmailProvider {
  const apiKey = process.env.RESEND_API_KEY;
  // The "from" domain must be verified in Resend. For testing you can use
  // 'FollowThru <onboarding@resend.dev>' (only delivers to your own address).
  const from = process.env.EMAIL_FROM || 'FollowThru <noreply@followthru.app>';

  if (apiKey) {
    return new ResendEmailProvider(apiKey, from);
  }

  console.warn('[EMAIL] RESEND_API_KEY not set. Using console provider.');
  return new ConsoleEmailProvider();
}

let instance: IEmailProvider | null = null;

export class EmailProvider {
  static getInstance(): IEmailProvider {
    if (!instance) {
      instance = getEmailProvider();
    }
    return instance;
  }
}

/**
 * Email templates (reminders) — unchanged
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