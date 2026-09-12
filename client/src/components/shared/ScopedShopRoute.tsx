import { useEffect, useState } from 'react';
import { Outlet, useParams } from 'react-router-dom';

import { getSession, type AuthUser } from '@/api/auth';
import { ApiError } from '@/api/client';
import { listTenantMemberships, switchTenantShop } from '@/api/tenant';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface ScopedShopRouteProps {
  user: AuthUser;
  onUserChange: (user: AuthUser) => void;
}

/** Resolve the URL slug to a current membership before rendering shop UI. */
export function ScopedShopRoute({ user, onUserChange }: ScopedShopRouteProps) {
  const { shopSlug } = useParams<{ shopSlug: string }>();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setReady(false);
    setError(null);
    void listTenantMemberships()
      .then(async ({ memberships }) => {
        const membership = memberships.find(
          (candidate) => candidate.shopSlug === shopSlug,
        );
        if (!membership)
          throw new ApiError('You do not have access to this shop.', 403);
        if (membership.shopId !== user.shopId) {
          await switchTenantShop(membership.shopId);
          const session = await getSession();
          if (active) onUserChange(session.user);
        }
        if (active) setReady(true);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(
          reason instanceof ApiError
            ? reason.message
            : 'The selected shop could not be opened.',
        );
      });
    return () => {
      active = false;
    };
  }, [onUserChange, shopSlug, user.shopId]);

  if (error)
    return (
      <Card role="alert">
        <CardHeader>
          <CardTitle>Shop access unavailable</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    );

  if (!ready)
    return (
      <Card aria-live="polite">
        <CardHeader>
          <CardTitle>Opening shop</CardTitle>
          <CardDescription>Validating your branch access…</CardDescription>
        </CardHeader>
      </Card>
    );

  return <Outlet />;
}
