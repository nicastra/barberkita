import type { AuthUser } from '@/api/auth';
import { CheckoutWorkspace } from '@/features/checkout/CheckoutWorkspace';

export function CheckoutPage({ user }: { user: AuthUser | null }) {
  return <CheckoutWorkspace user={user} />;
}
