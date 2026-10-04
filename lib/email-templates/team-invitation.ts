interface TeamInvitationEmailData {
  recipientEmail: string;
  inviterName: string;
  teamName: string;
  organizationName: string;
  acceptanceUrl: string;
  expiresAt: Date;
}

export function generateTeamInvitationEmailHtml(
  data: TeamInvitationEmailData,
): string {
  const expirationDate = data.expiresAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        line-height: 1.6;
        color: #333;
      }
      .container {
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
      }
      .header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 30px;
        border-radius: 8px 8px 0 0;
        text-align: center;
      }
      .header h1 {
        margin: 0;
        font-size: 24px;
      }
      .content {
        background: #f9fafb;
        padding: 30px;
        border-radius: 0 0 8px 8px;
        border: 1px solid #e5e7eb;
      }
      .greeting {
        font-size: 16px;
        margin-bottom: 20px;
      }
      .message {
        background: white;
        padding: 20px;
        border-radius: 6px;
        margin-bottom: 20px;
        border-left: 4px solid #667eea;
      }
      .cta-button {
        display: inline-block;
        background: #667eea;
        color: white;
        padding: 12px 30px;
        border-radius: 6px;
        text-decoration: none;
        font-weight: 600;
        margin: 20px 0;
      }
      .cta-button:hover {
        background: #5568d3;
      }
      .info-section {
        background: white;
        padding: 15px;
        border-radius: 6px;
        margin-bottom: 15px;
        font-size: 14px;
      }
      .info-section strong {
        display: block;
        color: #667eea;
        margin-bottom: 5px;
      }
      .expiration-warning {
        background: #fef3c7;
        border: 1px solid #fcd34d;
        color: #92400e;
        padding: 15px;
        border-radius: 6px;
        font-size: 14px;
        margin-bottom: 20px;
      }
      .footer {
        font-size: 12px;
        color: #6b7280;
        text-align: center;
        margin-top: 30px;
        padding-top: 20px;
        border-top: 1px solid #e5e7eb;
      }
      .link-copy {
        background: #f3f4f6;
        padding: 10px;
        border-radius: 4px;
        font-family: monospace;
        font-size: 12px;
        word-break: break-all;
        color: #6b7280;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>Team Invitation</h1>
      </div>
      <div class="content">
        <div class="greeting">
          Hi ${data.recipientEmail},
        </div>

        <div class="message">
          <p>
            <strong>${data.inviterName}</strong> has invited you to join the
            <strong>${data.teamName}</strong> team in
            <strong>${data.organizationName}</strong> on FollowThru.
          </p>
          <p>
            Accept this invitation to get started collaborating with your team!
          </p>
        </div>

        <center>
          <a href="${data.acceptanceUrl}" class="cta-button">
            Accept Invitation
          </a>
        </center>

        <div class="expiration-warning">
          ⏰ <strong>This invitation expires on ${expirationDate}</strong>. 
          Accept it before then to join the team.
        </div>

        <div class="info-section">
          <strong>Team Details</strong>
          Team: ${data.teamName}<br>
          Organization: ${data.organizationName}
        </div>

        <div class="info-section">
          <strong>Can't click the button?</strong>
          <p>Copy and paste this link in your browser:</p>
          <div class="link-copy">${data.acceptanceUrl}</div>
        </div>

        <div class="footer">
          <p>
            This is an automated message from FollowThru. If you didn't expect this invitation,
            you can safely ignore it.
          </p>
        </div>
      </div>
    </div>
  </body>
</html>
  `.trim();
}

export function generateTeamInvitationEmailText(
  data: TeamInvitationEmailData,
): string {
  const expirationDate = data.expiresAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `
Team Invitation

Hi ${data.recipientEmail},

${data.inviterName} has invited you to join the ${data.teamName} team in ${data.organizationName} on FollowThru.

Accept this invitation to get started collaborating with your team!

Acceptance Link:
${data.acceptanceUrl}

This invitation expires on ${expirationDate}.

Team Details:
- Team: ${data.teamName}
- Organization: ${data.organizationName}

If you didn't expect this invitation, you can safely ignore it.

Best regards,
FollowThru Team
  `.trim();
}
