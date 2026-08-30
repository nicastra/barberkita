import type { AuthUser } from '@/api/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OwnerAdminPanel } from '@/features/admin/OwnerAdminPanel';

interface OwnerAdminPageProps {
  user: AuthUser | null;
}

export function OwnerAdminPage({ user }: OwnerAdminPageProps) {
  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sign in required</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Sign in with an owner account to manage this shop.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (user.role !== 'owner') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Owner access required</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Your staff account does not have permission to manage shop settings.
          </p>
        </CardContent>
      </Card>
    );
  }

  return <OwnerAdminPanel user={user} />;
}
