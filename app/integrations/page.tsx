'use client';

import { useEffect, useState } from 'react';
import { ProtectedRoute } from '@/components/protected-route';
import { IntegrationConnect } from '@/components/integration-connect';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';

interface IntegrationStatus {
  provider: 'jira' | 'asana' | 'monday' | 'clickup' | 'slack' | 'teams' | 'zoom';
  name: string;
  description: string;
  connected: boolean;
  lastSync?: string;
  email?: string;
}

function IntegrationsContent() {
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const INTEGRATION_TEMPLATES: IntegrationStatus[] = [
    {
      provider: 'jira',
      name: 'Jira',
      description: 'Sync issues and tasks bidirectionally',
      connected: false,
    },
    {
      provider: 'asana',
      name: 'Asana',
      description: 'Import tasks and track progress',
      connected: false,
    },
    {
      provider: 'monday',
      name: 'Monday.com',
      description: 'Sync with Monday.com work OS',
      connected: false,
    },
    {
      provider: 'clickup',
      name: 'ClickUp',
      description: 'Connect to ClickUp tasks',
      connected: false,
    },
    {
      provider: 'slack',
      name: 'Slack',
      description: 'Receive nudges in Slack',
      connected: false,
    },
    {
      provider: 'teams',
      name: 'Microsoft Teams',
      description: 'Send alerts to Teams channels',
      connected: false,
    },
  ];

  useEffect(() => {
    const fetchIntegrations = async () => {
      try {
        const res = await fetch('/api/integrations', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });

        if (!res.ok) {
          console.warn(`Integration fetch returned ${res.status}`);
          // If fetch fails, just show templates without connected status
          setIntegrations(INTEGRATION_TEMPLATES);
          setLoading(false);
          return;
        }

        const data = await res.json();

        // Merge fetched data with templates
        const connected = data.integrations || [];
        const merged = INTEGRATION_TEMPLATES.map((template) => {
          const found = connected.find((c: any) => c.provider === template.provider);
          return found ? { ...template, ...found, connected: true } : template;
        });

        setIntegrations(merged);
      } catch (err) {
        console.error('Fetch integrations error:', err);
        // Fall back to templates if fetch fails
        setIntegrations(INTEGRATION_TEMPLATES);
      } finally {
        setLoading(false);
      }
    };

    fetchIntegrations();
  }, []);

  const handleConnect = (provider: string) => {
    try {
      // Redirect to OAuth connect endpoint
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const authUrl = `/api/integrations/connect?provider=${provider}&redirect_uri=${encodeURIComponent(`${origin}/api/integrations/oauth/callback`)}`;
      window.location.href = authUrl;
    } catch (err) {
      console.error('Connect error:', err);
      setError(`Failed to connect ${provider}. Please try again.`);
    }
  };

  const handleDisconnect = async (provider: string) => {
    try {
      const res = await fetch('/api/integrations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });

      if (!res.ok) throw new Error('Failed to disconnect');

      setIntegrations(
        integrations.map((i) => (i.provider === provider ? { ...i, connected: false } : i))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Integrations</h1>
        <p className="mt-2 text-gray-600">
          Connect FollowThru with your favorite tools. Sync commitments across platforms.
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <IntegrationConnect
        integrations={integrations}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
      />

      {/* Sync Status */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Sync Status</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            Connected integrations sync every 15 minutes. Last sync information appears in each integration card above.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <ProtectedRoute>
      <IntegrationsContent />
    </ProtectedRoute>
  );
}
