import { PublicBookingFlow } from '@/features/bookings/PublicBookingFlow';
import { useParams } from 'react-router-dom';

export function PublicBookingPage() {
  const { shopSlug } = useParams<{ shopSlug: string }>();
  if (!shopSlug) return null;
  return <PublicBookingFlow shopSlug={shopSlug} />;
}
