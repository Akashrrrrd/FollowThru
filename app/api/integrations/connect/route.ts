import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const provider = searchParams.get('provider');
    const redirectUri = searchParams.get('redirect_uri');

    if (!provider || !redirectUri) {
      return NextResponse.json(
        { error: 'Missing provider or redirect_uri' },
        { status: 400 },
      );
    }

    // Validate provider
    const validProviders = ['jira', 'asana', 'monday', 'clickup', 'slack', 'teams'];
    if (!validProviders.includes(provider)) {
      return NextResponse.json(
        { error: 'Invalid provider' },
        { status: 400 },
      );
    }

    let authUrl = '';
    const clientId = process.env[`${provider.toUpperCase()}_CLIENT_ID`];
    const scope = process.env[`${provider.toUpperCase()}_SCOPE`] || 'read:jira-work write:jira-work manage:jira-project manage:jira-configuration';

    switch (provider) {
      case 'jira':
        if (!clientId) {
          return NextResponse.json(
            { error: 'Jira client ID not configured' },
            { status: 500 },
          );
        }
        authUrl = `https://auth.atlassian.com/authorize?` +
          `client_id=${encodeURIComponent(clientId)}&` +
          `response_type=code&` +
          `redirect_uri=${encodeURIComponent(redirectUri)}&` +
          `scope=${encodeURIComponent(scope)}&` +
          `state=${Math.random().toString(36).substring(7)}`;
        break;

      case 'asana':
        if (!clientId) {
          return NextResponse.json(
            { error: 'Asana client ID not configured' },
            { status: 500 },
          );
        }
        authUrl = `https://app.asana.com/-/oauth_authorize?` +
          `client_id=${encodeURIComponent(clientId)}&` +
          `redirect_uri=${encodeURIComponent(redirectUri)}&` +
          `response_type=code&` +
          `state=${Math.random().toString(36).substring(7)}`;
        break;

      case 'monday':
        if (!clientId) {
          return NextResponse.json(
            { error: 'Monday client ID not configured' },
            { status: 500 },
          );
        }
        authUrl = `https://auth.monday.com/oauth2/authorize?` +
          `client_id=${encodeURIComponent(clientId)}&` +
          `redirect_uri=${encodeURIComponent(redirectUri)}&` +
          `response_type=code`;
        break;

      case 'clickup':
        if (!clientId) {
          return NextResponse.json(
            { error: 'ClickUp client ID not configured' },
            { status: 500 },
          );
        }
        authUrl = `https://app.clickup.com/api?client_id=${encodeURIComponent(clientId)}&` +
          `redirect_uri=${encodeURIComponent(redirectUri)}`;
        break;

      default:
        return NextResponse.json(
          { error: 'OAuth not yet implemented for this provider' },
          { status: 501 },
        );
    }

    return NextResponse.redirect(new URL(authUrl));
  } catch (error) {
    console.error('Connect error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate OAuth' },
      { status: 500 },
    );
  }
}
