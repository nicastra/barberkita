import {
  AlertTriangle,
  CheckCircle2,
  Database,
  RefreshCw,
  Server,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import { useHealth } from './useHealth';

export function SystemStatus() {
  const { state, refresh } = useHealth();

  if (state.status === 'loading') {
    return (
      <Card aria-live="polite">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle>System status</CardTitle>
            <Badge variant="outline">Checking</Badge>
          </div>
          <CardDescription>
            Confirming that your workspace is ready.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted text-muted-foreground flex items-center gap-3 rounded-xl p-4 text-sm">
            <RefreshCw className="size-5 animate-spin" aria-hidden="true" />
            Checking API and database connectivity…
          </div>
        </CardContent>
      </Card>
    );
  }

  if (state.status === 'error') {
    return (
      <Card aria-live="polite" className="border-amber-200">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle>System status</CardTitle>
            <Badge variant="warning">Connection issue</Badge>
          </div>
          <CardDescription>
            The CukurPro API could not be reached from this browser.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
            <AlertTriangle
              className="mt-0.5 size-5 shrink-0"
              aria-hidden="true"
            />
            <p>
              Check that the backend is running and that the configured API URL
              and allowed origin match.
            </p>
          </div>
          <Button variant="outline" onClick={() => void refresh()}>
            <RefreshCw className="size-4" aria-hidden="true" />
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const isHealthy = state.health.status === 'ok';

  return (
    <Card aria-live="polite" className={isHealthy ? 'border-emerald-200' : ''}>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle>System status</CardTitle>
          <Badge variant={isHealthy ? 'success' : 'warning'}>
            {isHealthy ? 'Operational' : 'Needs attention'}
          </Badge>
        </div>
        <CardDescription>
          {isHealthy
            ? 'All foundation services are connected.'
            : 'The API is online, but the database is unavailable.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="border-border flex items-center justify-between rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
              <Server className="size-4" aria-hidden="true" />
            </span>
            <span className="text-sm font-medium">API service</span>
          </div>
          <CheckCircle2
            className="size-5 text-emerald-600"
            aria-label="Connected"
          />
        </div>
        <div className="border-border flex items-center justify-between rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <span className="bg-muted text-muted-foreground grid size-9 place-items-center rounded-lg">
              <Database className="size-4" aria-hidden="true" />
            </span>
            <span className="text-sm font-medium">PostgreSQL database</span>
          </div>
          {state.health.services.database === 'ok' ? (
            <CheckCircle2
              className="size-5 text-emerald-600"
              aria-label="Connected"
            />
          ) : (
            <AlertTriangle
              className="size-5 text-amber-600"
              aria-label="Unavailable"
            />
          )}
        </div>
        {!isHealthy && (
          <Button variant="outline" onClick={() => void refresh()}>
            <RefreshCw className="size-4" aria-hidden="true" />
            Check again
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
