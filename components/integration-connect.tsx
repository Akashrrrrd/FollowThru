'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ExternalLink, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';

interface IntegrationStatus {
  provider: 'jira' | 'asana' | 'monday' | 'clickup' | 'slack' | 'teams' | 'zoom';
  name: string;
  description: string;
  connected: boolean;
  lastSync?: string;
  email?: string;
}

interface IntegrationConnectProps {
  integrations: IntegrationStatus[];
  onConnect: (provider: string) => void;
  onDisconnect: (provider: string) => void;
  loading?: boolean;
}

const PROVIDER_INFO: Record<string, { color: string; icon: string; docs: string }> = {
  jira: { color: 'bg-blue-50', icon: '🔵', docs: 'https://jira.atlassian.com' },
  asana: { color: 'bg-indigo-50', icon: '🟣', docs: 'https://asana.com' },
  monday: { color: 'bg-purple-50', icon: '📅', docs: 'https://monday.com' },
  clickup: { color: 'bg-red-50', icon: '🔴', docs: 'https://clickup.com' },
  slack: { color: 'bg-pink-50', icon: '💬', docs: 'https://slack.com' },
  teams: { color: 'bg-sky-50', icon: '📘', docs: 'https://teams.microsoft.com' },
  zoom: { color: 'bg-blue-100', icon: '📹', docs: 'https://zoom.us' },
};

export function IntegrationConnect({
  integrations,
  onConnect,
  onDisconnect,
  loading = false,
}: IntegrationConnectProps) {
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  const handleDisconnect = async (provider: string) => {
    setDisconnecting(provider);
    try {
      await onDisconnect(provider);
    } finally {
      setDisconnecting(null);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {integrations.map((integration) => {
        const info = PROVIDER_INFO[integration.provider] || {};
        const isDisconnecting = disconnecting === integration.provider;

        return (
          <Card key={integration.provider} className={info.color}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{info.icon}</span>
                  <div>
                    <CardTitle className="text-base">{integration.name}</CardTitle>
                    <p className="text-xs text-gray-600 mt-1">{integration.description}</p>
                  </div>
                </div>
                {integration.connected && (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {integration.connected && integration.email && (
                <Alert className="bg-white/50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    Connected as: <strong>{integration.email}</strong>
                  </AlertDescription>
                </Alert>
              )}

              {integration.connected && integration.lastSync && (
                <p className="text-xs text-gray-600">
                  Last sync: {new Date(integration.lastSync).toLocaleString()}
                </p>
              )}

              <div className="flex gap-2">
                {integration.connected ? (
                  <>
                    <Button
                      onClick={() => handleDisconnect(integration.provider)}
                      disabled={isDisconnecting}
                      size="sm"
                      variant="destructive"
                      className="flex-1"
                    >
                      {isDisconnecting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Disconnecting...
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Disconnect
                        </>
                      )}
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Manage
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => onConnect(integration.provider)}
                    disabled={loading}
                    size="sm"
                    className="w-full"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      'Connect'
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
