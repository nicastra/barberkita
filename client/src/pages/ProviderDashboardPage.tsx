import { useEffect, useState } from 'react';

import {
  getProviderDashboard,
  transitionProviderLifecycle,
  type ProviderDashboard,
} from '@/api/provider';
import { ApiError } from '@/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ProviderActionsPanel } from '@/features/provider/ProviderActionsPanel';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

function lifecycleVariant(
  lifecycle: ProviderDashboard['organizations'][number]['lifecycle'],
) {
  return lifecycle === 'active'
    ? 'success'
    : lifecycle === 'trialing'
      ? 'warning'
      : 'outline';
}

export function ProviderDashboardPage() {
  const [dashboard, setDashboard] = useState<ProviderDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    getProviderDashboard(controller.signal)
      .then(setDashboard)
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          reason instanceof ApiError
            ? reason.message
            : 'The provider dashboard could not be loaded.',
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [refreshKey]);

  if (loading)
    return (
      <Card aria-live="polite">
        <CardHeader>
          <CardTitle>Provider console</CardTitle>
          <CardDescription>Loading platform metadata…</CardDescription>
        </CardHeader>
      </Card>
    );

  if (error)
    return (
      <Card role="alert">
        <CardHeader>
          <CardTitle>Provider access unavailable</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    );

  if (!dashboard) return null;

  const changeLifecycle = (
    organizationId: string,
    lifecycle: ProviderDashboard['organizations'][number]['lifecycle'],
  ) => {
    const reason = window.prompt(
      `Reason for changing lifecycle to ${lifecycle}`,
    );
    if (!reason?.trim()) return;
    setActionError(null);
    setActionPending(organizationId);
    void transitionProviderLifecycle(organizationId, lifecycle, reason.trim())
      .then(() => getProviderDashboard().then(setDashboard))
      .catch((reason: unknown) => {
        setActionError(
          reason instanceof ApiError
            ? reason.message
            : 'The lifecycle update could not be completed.',
        );
      })
      .finally(() => setActionPending(null));
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-primary text-sm font-semibold uppercase tracking-wide">
          CukurPro provider
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Platform console
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          Tenant metadata, lifecycle state, and platform activity. Operational
          customer and booking data is intentionally excluded.
        </p>
      </div>

      <ProviderActionsPanel
        organizations={dashboard.organizations}
        onChanged={() => setRefreshKey((value) => value + 1)}
      />

      <section aria-labelledby="organizations-heading" className="space-y-4">
        <div>
          <h2 id="organizations-heading" className="text-xl font-semibold">
            Organizations
          </h2>
          <p className="text-muted-foreground text-sm">
            {dashboard.organizations.length} organization
            {dashboard.organizations.length === 1 ? '' : 's'} provisioned
          </p>
        </div>
        {actionError && (
          <p className="text-destructive text-sm" role="alert">
            {actionError}
          </p>
        )}
        {dashboard.organizations.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground pt-6 text-sm">
              No organizations have been provisioned yet.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {dashboard.organizations.map((organization) => (
              <Card key={organization.id}>
                <CardHeader className="flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle>{organization.name}</CardTitle>
                    <CardDescription>
                      {organization.slug} · {organization.counts.shops} branch
                      {organization.counts.shops === 1 ? '' : 'es'} ·{' '}
                      {organization.counts.activeUsers} active user
                      {organization.counts.activeUsers === 1 ? '' : 's'}
                    </CardDescription>
                    <p className="text-muted-foreground mt-2 text-xs">
                      Onboarding: {organization.onboarding.completed}/
                      {organization.onboarding.total} milestones
                    </p>
                  </div>
                  <Badge variant={lifecycleVariant(organization.lifecycle)}>
                    {organization.lifecycle}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-xs">
                    Plan and entitlement configuration will be available in
                    Phase 11.
                  </p>
                  <ul className="mt-4 space-y-2 text-sm">
                    {organization.branches.map((branch) => (
                      <li
                        key={branch.id}
                        className="border-border flex items-center justify-between border-b pb-2 last:border-0 last:pb-0"
                      >
                        <span>{branch.name}</span>
                        <span className="text-muted-foreground">
                          {branch.slug ?? 'No public slug'}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {organization.lifecycle !== 'archived' && (
                    <div className="mt-5 flex flex-wrap gap-2">
                      {organization.lifecycle === 'suspended' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={actionPending === organization.id}
                          onClick={() =>
                            changeLifecycle(organization.id, 'active')
                          }
                        >
                          Reactivate
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={actionPending === organization.id}
                          onClick={() =>
                            changeLifecycle(organization.id, 'suspended')
                          }
                        >
                          Suspend
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={actionPending === organization.id}
                        onClick={() =>
                          changeLifecycle(organization.id, 'archived')
                        }
                      >
                        Archive
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="activity-heading" className="space-y-4">
        <div>
          <h2 id="activity-heading" className="text-xl font-semibold">
            Recent platform activity
          </h2>
          <p className="text-muted-foreground text-sm">
            Audited provider actions, without tenant operational details.
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            {dashboard.recentActivity.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No provider activity has been recorded yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {dashboard.recentActivity.map((activity, index) => (
                  <li
                    key={`${activity.occurredAt}-${activity.action}-${index}`}
                    className="flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <span className="font-medium">{activity.action}</span>
                    <time
                      className="text-muted-foreground"
                      dateTime={activity.occurredAt}
                    >
                      {new Date(activity.occurredAt).toLocaleString()}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Platform health</CardTitle>
          <CardDescription>
            Core provider services are reporting normally.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Badge variant="success">Database operational</Badge>
        </CardContent>
      </Card>
    </div>
  );
}
