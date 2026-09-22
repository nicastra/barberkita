import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { getSession, signIn, signOut, type AuthUser } from '@/api/auth';
import { getProviderMe } from '@/api/provider';
import { listTenantMemberships } from '@/api/tenant';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface AuthPanelProps {
  onUserChange?: (user: AuthUser | null) => void;
  onSessionResolved?: () => void;
}

export function AuthPanel({ onUserChange, onSessionResolved }: AuthPanelProps) {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    void getSession()
      .then((response) => {
        if (mounted) {
          setUser(response.user);
          onUserChange?.(response.user);
        }
      })
      .catch(() => undefined)
      .finally(() => onSessionResolved?.());
    return () => {
      mounted = false;
    };
  }, [onUserChange]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const signedInUser = (await signIn(email, password)).user;
      setUser(signedInUser);
      onUserChange?.(signedInUser);
      setPassword('');
      void redirectAfterSignIn(signedInUser);
    } catch {
      setError('Invalid email or password.');
    } finally {
      setLoading(false);
    }
  }

  async function redirectAfterSignIn(signedInUser: AuthUser) {
    // Provider access is determined by the server's explicit platform-admin
    // registration, never by a tenant role or a client-provided flag.
    try {
      await getProviderMe();
      navigate('/provider', { replace: true });
      return;
    } catch {
      // A normal tenant user is expected to receive 403 here.
    }

    try {
      const { memberships } = await listTenantMemberships();
      const activeMembership =
        memberships.find(
          (membership) =>
            membership.shopId === signedInUser.shopId && membership.shopSlug,
        ) ?? memberships.find((membership) => membership.shopSlug);
      if (activeMembership?.shopSlug)
        navigate(`/app/${activeMembership.shopSlug}/dashboard`, {
          replace: true,
        });
    } catch {
      // Keep the signed-in state visible if memberships cannot be loaded.
    }
  }

  if (user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Signed in</CardTitle>
          <CardDescription>
            {user.name} · {user.role}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() => {
              void signOut().then(() => {
                setUser(null);
                onUserChange?.(null);
              });
            }}
          >
            Sign out
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Staff sign in</CardTitle>
        <CardDescription>Use your CukurPro staff account.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={(event) => void submit(event)}>
          <label className="block text-sm font-medium">
            Email
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="border-input bg-background mt-1 block w-full rounded-md border px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium">
            Password
            <input
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="border-input bg-background mt-1 block w-full rounded-md border px-3 py-2"
            />
          </label>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <Button type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
