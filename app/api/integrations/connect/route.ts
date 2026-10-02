import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const provider = searchParams.get('provider');
    const redirectUri = searchParams.get('redirect_uri') || `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/oauth/callback`;

    if (!provider) {
      return NextResponse.json({ error: 'provider required' }, { status: 400 });
    }

    // OAuth Authorization URLs for different providers
    const oauthUrls: Record<string, string> = {
      jira: `https://auth.atlassian.com/authorize?audience=api.atlassian.com&client_id=${process.env.JIRA_CLIENT_ID}&scope=read%3Aissue%3Ajira%20write%3Aissue%3Ajira%20read%3Auser%3Ajira&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${provider}`,
      
      asana: `https://app.asana.com/-/oauth_authorize?client_id=${process.env.ASANA_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${provider}`,
      
      monday: `https://auth.monday.com/oauth2/authorize?client_id=${process.env.MONDAY_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${provider}`,
      
      clickup: `https://app.clickup.com/api?client_id=${process.env.CLICKUP_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${provider}`,
      
      slack: `https://slack.com/oauth/v2/authorize?client_id=${process.env.SLACK_CLIENT_ID}&scope=chat:write,chat:write.public,channels:read,users:read&redirect_uri=${encodeURIComponent(redirectUri)}&state=${provider}`,
      
      teams: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${process.env.TEAMS_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=https%3A%2F%2Fgraph.microsoft.com%2F.default&response_type=code&state=${provider}`,
    };

    const url = oauthUrls[provider];

    if (!url) {
      return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 });
    }

    // Redirect to OAuth provider
    return NextResponse.redirect(url);
  } catch (error) {
    console.error('OAuth connect error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to connect integration' },
      { status: 500 }
    );
  }
}
