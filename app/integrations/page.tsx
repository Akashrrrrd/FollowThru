'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  CheckSquare,
  ClipboardList,
  Columns3,
  Loader2,
  MessageSquare,
  RefreshCw,
  Users,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { ProtectedRoute } from '@/components/protected-route';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

type Provider = 'jira' | 'asana' | 'monday' | 'clickup' | 'slack' | 'teams';
type Category = 'Project management' | 'Communication';

interface IntegrationStatus {
  provider: Provider;
  name: string;
  description: string;
  category: Category;
  icon: LucideIcon;
  connected: boolean;
  lastSync?: string;
  email?: string;
}

const SYNC_INTERVAL_MINUTES = 15;
const CATEGORIES: Category[] = ['Project management', 'Communication'];

// Module-level: stable reference, not re-created on every render.
const INTEGRATION_TEMPLATES: IntegrationStatus[] = [
  { provider: 'jira', name: 'Jira', description: 'Sync issues and commitments bidirectionally.', category: 'Project management', icon: ClipboardList, connected: false },
  { provider: 'asana', name: 'Asana', description: 'Import commitments and track progress.', category: 'Project management', icon: CheckSquare, connected: false },
  { provider: 'slack', name: 'Slack', description: 'Receive follow-up nudges in Slack.', category: 'Communication', icon: MessageSquare, connected: false },
  { provider: 'teams', name: 'Microsoft Teams', description: 'Send alerts to Teams channels.', category: 'Communication', icon: Users, connected: false },
];

function formatLastSync(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="px-5 py-4">
      <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</dd>
    </div>
  );
}

function IntegrationRow({
  integration,
  busy,
  confirming,
  onConnect,
  onAskDisconnect,
  onCancelDisconnect,
  onConfirmDisconnect,
}: {
  integration: IntegrationStatus;
  busy: boolean;
  confirming: boolean;
  onConnect: (p: Provider) => void;
  onAskDisconnect: (p: Provider) => void;
  onCancelDisconnect: () => void;
  onConfirmDisconnect: (p: Provider) => void;
}) {
  const { icon: Icon, name, description, connected, email, lastSync, provider } = integration;
  const synced = formatLastSync(lastSync);
  const meta = [email, synced && `Synced ${synced}`].filter(Boolean).join('  ·  ');

  return (
    <li className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50">
          <Icon className="h-5 w-5 text-slate-700" aria-hidden />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h3 className="text-sm font-semibold text-slate-900">{name}</h3>
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                connected ? 'text-emerald-700' : 'text-slate-500'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-slate-300'}`}
                aria-hidden
              />
              {connected ? 'Connected' : 'Not connected'}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-slate-600">{description}</p>
          {connected && meta && <p className="mt-1 truncate text-xs text-slate-500">{meta}</p>}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:justify-end">
        {!connected ? (
          <Button size="sm" disabled={busy} onClick={() => onConnect(provider)} className="min-w-[96px]">
            {busy && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden />}
            Connect
          </Button>
        ) : confirming ? (
          <>
            <span className="mr-1 text-xs text-slate-600">Disconnect {name}?</span>
            <Button size="sm" variant="outline" disabled={busy} onClick={onCancelDisconnect}>
              Cancel
            </Button>
            <Button size="sm" variant="destructive" disabled={busy} onClick={() => onConfirmDisconnect(provider)}>
              {busy && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden />}
              Confirm
            </Button>
          </>
        ) : (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => onAskDisconnect(provider)} className="min-w-[96px]">
            Disconnect
          </Button>
        )}
      </div>
    </li>
  );
}

function LoadingRows() {
  return (
    <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white" aria-busy="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          <div className="h-10 w-10 animate-pulse rounded-md bg-slate-100" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-32 animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-64 max-w-full animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

function IntegrationsContent() {
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<Provider | null>(null);
  const [confirming, setConfirming] = useState<Provider | null>(null);

  const fetchIntegrations = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        cache: 'no-store',
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error || `Couldn't load your integrations (${res.status}).`);
        setIntegrations(INTEGRATION_TEMPLATES);
        return;
      }

      const data = await res.json();
      const connected: Array<Partial<IntegrationStatus>> = data.integrations || [];

      setIntegrations(
        INTEGRATION_TEMPLATES.map((template) => {
          const found = connected.find((c) => c.provider === template.provider);
          // Only take status fields from the API; keep template icon/name/description.
          return found
            ? { ...template, email: found.email, lastSync: found.lastSync, connected: true }
            : template;
        }),
      );
    } catch (err) {
      console.error('Fetch integrations error:', err);
      setError('Network error while loading your integrations.');
      setIntegrations(INTEGRATION_TEMPLATES);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  // Show the result of the OAuth round-trip (?success=jira / ?error=...) once, then clean the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const err = params.get('error');
    if (!success && !err) return;

    if (success) {
      const name = INTEGRATION_TEMPLATES.find((t) => t.provider === success)?.name ?? success;
      setNotice(`${name} connected successfully.`);
    }
    if (err) setError(err);
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  // Coming back via the browser's back button from a provider's consent screen.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setPending(null);
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  const handleConnect = (provider: Provider) => {
    setError(null);
    setNotice(null);
    setPending(provider);
    // The server builds the redirect URI and OAuth state; the client only names the provider.
    window.location.assign(`/api/integrations/connect?provider=${provider}`);
  };

  const handleDisconnect = async (provider: Provider) => {
    setError(null);
    setNotice(null);
    setPending(provider);
    try {
      const res = await fetch('/api/integrations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ provider }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'Failed to disconnect. Please try again.');
      }

      setIntegrations((prev) =>
        prev.map((i) =>
          i.provider === provider ? { ...i, connected: false, email: undefined, lastSync: undefined } : i,
        ),
      );
      setConfirming(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect.');
    } finally {
      setPending(null);
    }
  };

  const connectedCount = useMemo(() => integrations.filter((i) => i.connected).length, [integrations]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Integrations</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
            Connect FollowThru with the tools your team already uses and keep commitments in sync across platforms.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => {
            setLoading(true);
            fetchIntegrations();
          }}
        >
          <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden />
          Refresh
        </Button>
      </header>

      {/* Summary strip */}
      {!loading && (
        <dl className="mt-8 grid grid-cols-3 divide-x divide-slate-200 rounded-lg border border-slate-200 bg-white">
          <Stat label="Connected" value={connectedCount} />
          <Stat label="Available" value={integrations.length - connectedCount} />
          <Stat label="Sync interval" value={`${SYNC_INTERVAL_MINUTES} min`} />
        </dl>
      )}

      {notice && (
        <Alert className="mt-6 border-emerald-200 bg-emerald-50 text-emerald-900">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{notice}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label="Dismiss message"
              className="rounded p-1 transition-colors hover:bg-emerald-100"
            >
              <X className="h-4 w-4" />
            </button>
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive" className="mt-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              aria-label="Dismiss error"
              className="rounded p-1 transition-colors hover:bg-red-100"
            >
              <X className="h-4 w-4" />
            </button>
          </AlertDescription>
        </Alert>
      )}

      {/* Integration list */}
      <div className="mt-8 space-y-8">
        {loading ? (
          <LoadingRows />
        ) : (
          CATEGORIES.map((category) => {
            const items = integrations.filter((i) => i.category === category);
            if (items.length === 0) return null;
            return (
              <section key={category} aria-labelledby={`cat-${category}`}>
                <h2
                  id={`cat-${category}`}
                  className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500"
                >
                  {category}
                </h2>
                <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                  {items.map((integration) => (
                    <IntegrationRow
                      key={integration.provider}
                      integration={integration}
                      busy={pending === integration.provider}
                      confirming={confirming === integration.provider}
                      onConnect={handleConnect}
                      onAskDisconnect={setConfirming}
                      onCancelDisconnect={() => setConfirming(null)}
                      onConfirmDisconnect={handleDisconnect}
                    />
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </div>

      <p className="mt-8 border-t border-slate-200 pt-4 text-xs text-slate-500">
        Jira and Asana sync every {SYNC_INTERVAL_MINUTES} minutes. Slack and Teams are used for notifications only.
      </p>
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