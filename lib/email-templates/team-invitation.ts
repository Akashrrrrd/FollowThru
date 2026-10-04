/**
 * Team invitation email templates.
 *
 * The HTML uses a table-based layout with inline styles, which is what
 * Gmail, Outlook and Apple Mail render most consistently.
 */

export interface TeamInvitationEmailParams {
  recipientEmail: string;
  inviterName: string;
  teamName: string;
  organizationName: string;
  acceptanceUrl: string;
  expiresAt: Date;
}

const NAVY = '#1e2a5a';
const SERIF = "Georgia, 'Times New Roman', Times, serif";
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

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

function detailRow(label: string, value: string, isLast = false): string {
  const border = isLast ? '' : 'border-bottom:1px solid #e5e7eb;';
  return `
              <tr>
                <td style="padding:12px 16px;${border}font-family:${SANS};font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:#6b7280;width:130px;">${label}</td>
                <td style="padding:12px 16px;${border}font-family:${SANS};font-size:15px;font-weight:600;color:#111827;">${value}</td>
              </tr>`;
}

export function generateTeamInvitationEmailHtml(p: TeamInvitationEmailParams): string {
  const inviter = escapeHtml(p.inviterName);
  const team = escapeHtml(p.teamName);
  const org = escapeHtml(p.organizationName);
  const recipient = escapeHtml(p.recipientEmail);
  const url = escapeHtml(p.acceptanceUrl);
  const expires = escapeHtml(formatExpiry(p.expiresAt));

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>Join ${team} on FollowThru</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f3f4f6;">
    <!-- Preheader (inbox preview text) -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f3f4f6;font-size:1px;line-height:1px;">
      ${inviter} invited you to join ${team} in ${org}. This invitation expires on ${expires}.
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f4f6;">
      <tr>
        <td align="center" style="padding:40px 16px;">

          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">

            <!-- Brand -->
            <tr>
              <td align="center" style="padding:0 0 24px 0;font-family:${SERIF};font-size:26px;font-weight:700;letter-spacing:0.01em;color:${NAVY};">
                FollowThru
              </td>
            </tr>

            <!-- Card -->
            <tr>
              <td style="background-color:#ffffff;border:1px solid #e5e7eb;border-top:4px solid ${NAVY};border-radius:8px;padding:40px 40px 32px 40px;">

                <h1 style="margin:0 0 16px 0;font-family:${SERIF};font-size:26px;line-height:1.3;font-weight:700;color:#111827;">
                  You&rsquo;ve been invited to join ${team}
                </h1>

                <p style="margin:0 0 24px 0;font-family:${SANS};font-size:16px;line-height:1.6;color:#374151;">
                  <strong style="color:#111827;">${inviter}</strong> has invited you to collaborate with the
                  <strong style="color:#111827;">${team}</strong> team in
                  <strong style="color:#111827;">${org}</strong> on FollowThru.
                </p>

                <!-- Details -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;margin:0 0 32px 0;">${detailRow('Team', team)}${detailRow('Organization', org)}${detailRow('Invited by', inviter)}${detailRow('Expires', expires, true)}
                </table>

                <!-- Button -->
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 28px auto;">
                  <tr>
                    <td align="center" bgcolor="${NAVY}" style="border-radius:6px;">
                      <a href="${url}" target="_blank"
                         style="display:inline-block;padding:14px 36px;font-family:${SANS};font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;background-color:${NAVY};border:1px solid ${NAVY};">
                        Accept invitation
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 24px 0;font-family:${SANS};font-size:14px;line-height:1.6;color:#4b5563;text-align:center;">
                  Sign in or create an account using
                  <strong style="color:#111827;">${recipient}</strong>
                  to accept this invitation.
                </p>

                <hr style="border:0;border-top:1px solid #e5e7eb;margin:0 0 20px 0;">

                <p style="margin:0 0 6px 0;font-family:${SANS};font-size:12px;line-height:1.6;color:#6b7280;">
                  If the button doesn&rsquo;t work, copy and paste this link into your browser:
                </p>
                <p style="margin:0;font-family:${SANS};font-size:12px;line-height:1.6;word-break:break-all;">
                  <a href="${url}" target="_blank" style="color:${NAVY};text-decoration:underline;">${url}</a>
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td align="center" style="padding:24px 16px 0 16px;font-family:${SANS};font-size:12px;line-height:1.6;color:#6b7280;">
                If you weren&rsquo;t expecting this invitation, you can safely ignore this email.<br>
                Sent by FollowThru on behalf of ${inviter}.
              </td>
            </tr>

          </table>

        </td>
      </tr>
    </table>
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