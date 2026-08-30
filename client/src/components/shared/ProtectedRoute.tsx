import { Navigate, Outlet, useLocation } from 'react-router-dom';

import type { AuthUser } from '@/api/auth';
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
}

export function ProtectedRoute({
  user,
  ready,
  ownerOnly = false,
}: ProtectedRouteProps) {
  const location = useLocation();

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

  if (ownerOnly && user.role !== 'owner') {
    return (
      <Card>
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
