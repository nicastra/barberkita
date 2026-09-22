import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';

import type { AuthUser } from '@/api/auth';
import { getProviderMe } from '@/api/provider';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface ProtectedRouteProps {
  user: AuthUser | null;
  ready: boolean;
  ownerOnly?: boolean;
  providerOnly?: boolean;
}

export function ProtectedRoute({
  user,
  ready,
  ownerOnly = false,
  providerOnly = false,
}: ProtectedRouteProps) {
  const location = useLocation();
  const [providerAllowed, setProviderAllowed] = useState<boolean | null>(
    providerOnly ? null : true,
  );

  useEffect(() => {
    if (!providerOnly || !user) return;
    let active = true;
    void getProviderMe()
      .then(() => {
        if (active) setProviderAllowed(true);
      })
      .catch(() => {
        if (active) setProviderAllowed(false);
      });
    return () => {
      active = false;
    };
  }, [providerOnly, user]);

  if (!ready) {
    return (
      <Card aria-live="polite">
        <CardHeader>
          <CardTitle>Checking your session</CardTitle>
          <CardDescription>
            Confirming access to this protected workspace…
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/sign-in"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  if (providerOnly && providerAllowed === null) {
    return (
      <Card aria-live="polite">
        <CardHeader>
          <CardTitle>Checking provider access</CardTitle>
          <CardDescription>
            Confirming your platform administrator registration…
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (providerOnly && !providerAllowed) {
    return (
      <Card role="alert">
        <CardHeader>
          <CardTitle>Provider access required</CardTitle>
          <CardDescription>
            This console is available only to registered platform
            administrators.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (ownerOnly && user.role !== 'owner') {
    return (
      <Card role="alert">
        <CardHeader>
          <CardTitle>Owner access required</CardTitle>
          <CardDescription>
            Your account does not have permission to manage shop settings.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return <Outlet />;
}
