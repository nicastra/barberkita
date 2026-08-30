import { useEffect, useState, type FormEvent } from 'react';

import { getSession, signIn, signOut, type AuthUser } from '@/api/auth';
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
    } catch {
      setError('Invalid email or password.');
    } finally {
      setLoading(false);
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
