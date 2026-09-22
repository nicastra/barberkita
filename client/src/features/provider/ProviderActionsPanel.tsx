import { useEffect, useState, type FormEvent } from 'react';

import {
  createBreakGlassSupportGrant,
  createProviderOrganization,
  listProviderSupportGrants,
  requestSupportGrant,
  revokeSupportGrant,
  type ProviderDashboard,
  type SupportGrant,
} from '@/api/provider';
import { ApiError } from '@/api/client';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface ProviderActionsPanelProps {
  organizations: ProviderDashboard['organizations'];
  onChanged: () => void;
}

const initialOrganization = {
  organizationName: '',
  organizationSlug: '',
  shopName: '',
  shopSlug: '',
  phone: '',
  email: '',
  address: '',
  ownerEmail: '',
};

export function ProviderActionsPanel({
  organizations,
  onChanged,
}: ProviderActionsPanelProps) {
  const [organization, setOrganization] = useState(initialOrganization);
  const [grantOrganizationId, setGrantOrganizationId] = useState('');
  const [reason, setReason] = useState('');
  const [grants, setGrants] = useState<SupportGrant[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void listProviderSupportGrants()
      .then((result) => setGrants(result.grants))
      .catch(() => undefined);
  }, []);

  function setOrganizationField(
    field: keyof typeof initialOrganization,
    value: string,
  ) {
    setOrganization((current) => ({ ...current, [field]: value }));
  }

  async function createOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const result = await createProviderOrganization({
        organization: {
          name: organization.organizationName,
          slug: organization.organizationSlug,
          lifecycle: 'trialing',
        },
        shop: {
          name: organization.shopName,
          slug: organization.shopSlug,
          phone: organization.phone,
          email: organization.email,
          address: organization.address,
          timezone: 'Asia/Jakarta',
        },
        owner: { email: organization.ownerEmail, expiresInHours: 72 },
      });
      setMessage(
        `Organization created. Hand the one-time owner invitation token to ${result.invitation.email}: ${result.token}`,
      );
      setOrganization(initialOrganization);
      onChanged();
    } catch (failure: unknown) {
      setError(
        failure instanceof ApiError
          ? failure.message
          : 'Organization creation failed.',
      );
    } finally {
      setPending(false);
    }
  }

  async function createGrant(breakGlass: boolean) {
    if (!grantOrganizationId || !reason.trim()) return;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const result = breakGlass
        ? await createBreakGlassSupportGrant({
            organizationId: grantOrganizationId,
            reason: reason.trim(),
            expiresInMinutes: 15,
          })
        : await requestSupportGrant({
            organizationId: grantOrganizationId,
            reason: reason.trim(),
            expiresInMinutes: 60,
          });
      setGrants((current) => [result.grant, ...current]);
      setReason('');
      setMessage(
        breakGlass
          ? 'Break-glass incident created and recorded.'
          : 'Support request submitted for owner approval.',
      );
    } catch (failure: unknown) {
      setError(
        failure instanceof ApiError
          ? failure.message
          : 'Support grant creation failed.',
      );
    } finally {
      setPending(false);
    }
  }

  async function revokeGrant(grantId: string) {
    setPending(true);
    setError(null);
    try {
      const result = await revokeSupportGrant(grantId);
      setGrants((current) =>
        current.map((grant) => (grant.id === grantId ? result.grant : grant)),
      );
    } catch (failure: unknown) {
      setError(
        failure instanceof ApiError
          ? failure.message
          : 'Support grant revocation failed.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="provider-actions-heading" className="space-y-4">
      <div>
        <h2 id="provider-actions-heading" className="text-xl font-semibold">
          Provider actions
        </h2>
        <p className="text-muted-foreground text-sm">
          Provision tenants and request narrowly scoped, audited support access.
        </p>
      </div>
      {(message || error) && (
        <p
          className={error ? 'text-destructive text-sm' : 'text-sm'}
          role="status"
        >
          {error ?? message}
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Create organization</CardTitle>
            <CardDescription>
              Creates the first branch and a manual owner invitation token.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-3"
              onSubmit={(event) => void createOrganization(event)}
            >
              {(
                [
                  ['organizationName', 'Organization name'],
                  ['organizationSlug', 'Organization slug'],
                  ['shopName', 'First branch name'],
                  ['shopSlug', 'Public branch slug'],
                  ['phone', 'Phone'],
                  ['email', 'Branch email'],
                  ['address', 'Address'],
                  ['ownerEmail', 'Owner email'],
                ] as const
              ).map(([field, label]) => (
                <label key={field} className="block text-sm font-medium">
                  {label}
                  <input
                    required
                    type={
                      field.toLowerCase().includes('email') ? 'email' : 'text'
                    }
                    value={organization[field]}
                    onChange={(event) =>
                      setOrganizationField(field, event.target.value)
                    }
                    className="border-input bg-background mt-1 block w-full rounded-md border px-3 py-2"
                  />
                </label>
              ))}
              <Button type="submit" disabled={pending}>
                Create organization
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Support access</CardTitle>
            <CardDescription>
              Ordinary requests await owner approval. Break-glass is limited to
              a short incident window.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <select
              aria-label="Support organization"
              value={grantOrganizationId}
              onChange={(event) => setGrantOrganizationId(event.target.value)}
              className="border-input bg-background block w-full rounded-md border px-3 py-2"
            >
              <option value="">Select organization</option>
              {organizations.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <textarea
              aria-label="Support reason"
              required
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="State the support reason"
              className="border-input bg-background block min-h-20 w-full rounded-md border px-3 py-2"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={pending}
                onClick={() => void createGrant(false)}
              >
                Request support
              </Button>
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => void createGrant(true)}
              >
                Break-glass incident
              </Button>
            </div>
            {grants.length > 0 && (
              <ul className="space-y-2 text-sm">
                {grants.map((grant) => (
                  <li
                    key={grant.id}
                    className="flex items-center justify-between gap-2"
                  >
                    <span>
                      {grant.status} ·{' '}
                      {grant.breakGlass ? 'break-glass' : 'ordinary'}
                    </span>
                    {grant.status === 'active' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => void revokeGrant(grant.id)}
                      >
                        Revoke
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
