import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { AuthPanel } from '@/features/auth/AuthPanel';
import type { AuthUser } from '@/api/auth';

interface SignInPageProps {
  onUserChange: (user: AuthUser | null) => void;
  onSessionResolved: () => void;
}

export function SignInPage({
  onUserChange,
  onSessionResolved,
}: SignInPageProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Staff workspace</CardTitle>
          <CardDescription>
            Sign in to manage your shop and today’s operations.
          </CardDescription>
        </CardHeader>
      </Card>
      <AuthPanel
        onUserChange={onUserChange}
        onSessionResolved={onSessionResolved}
      />
    </div>
  );
}
