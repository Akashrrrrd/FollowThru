/**
 * Team invitation email templates.
 * (Rewritten so the file is guaranteed to exist and export the two
 * functions the members route imports.)
 */

export interface TeamInvitationEmailParams {
  recipientEmail: string;
  inviterName: string;
  teamName: string;
  organizationName: string;
  acceptanceUrl: string;
  expiresAt: Date;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatExpiry(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function generateTeamInvitationEmailHtml(p: TeamInvitationEmailParams): string {
  const inviter = escapeHtml(p.inviterName);
  const team = escapeHtml(p.teamName);
  const org = escapeHtml(p.organizationName);
  const url = escapeHtml(p.acceptanceUrl);
  const expires = escapeHtml(formatExpiry(p.expiresAt));

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Join ${team} on FollowThru</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#333;">
    <div style="max-width:600px;margin:0 auto;padding:24px;">
      <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;padding:24px;border-radius:8px 8px 0 0;">
        <h2 style="margin:0;">You're invited to join ${team}</h2>
      </div>
      <div style="background:#ffffff;padding:24px;border-radius:0 0 8px 8px;">
        <p>Hi,</p>
        <p><strong>${inviter}</strong> invited you to join the team <strong>${team}</strong> in <strong>${org}</strong> on FollowThru.</p>
        <p>
          <a href="${url}" style="background:#667eea;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">Accept invitation</a>
        </p>
        <p style="font-size:13px;color:#666;">
          Sign in (or create an account) using <strong>${escapeHtml(p.recipientEmail)}</strong> to accept.
          This invitation expires on ${expires}.
        </p>
        <p style="font-size:12px;color:#999;word-break:break-all;">
          If the button doesn't work, copy this link into your browser:<br>${url}
        </p>
      </div>
    </div>
  </body>
</html>`;
}

export function generateTeamInvitationEmailText(p: TeamInvitationEmailParams): string {
  return [
    `You're invited to join ${p.teamName}`,
    '',
    `${p.inviterName} invited you to join the team "${p.teamName}" in ${p.organizationName} on FollowThru.`,
    '',
    `Accept the invitation: ${p.acceptanceUrl}`,
    '',
    `Sign in (or create an account) using ${p.recipientEmail} to accept.`,
    `This invitation expires on ${formatExpiry(p.expiresAt)}.`,
  ].join('\n');
}