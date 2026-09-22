import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import {
  listTenantMemberships,
  switchTenantShop,
  type TenantMembership,
} from '@/api/tenant';
import { ApiError } from '@/api/client';

export function ShopSwitcher() {
  const location = useLocation();
  const navigate = useNavigate();
  const [memberships, setMemberships] = useState<TenantMembership[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void listTenantMemberships()
      .then((result) => {
        if (active) setMemberships(result.memberships);
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof ApiError
              ? reason.message
              : 'Could not load your shop memberships.',
          );
      });
    return () => {
      active = false;
    };
  }, []);

  const available = memberships.filter((membership) => membership.shopSlug);
  const current = available.find((membership) =>
    location.pathname.includes(`/app/${membership.shopSlug}/`),
  );
  const firstShop = available[0];
  if (available.length === 0 || (available.length === 1 && current))
    return null;
  if (available.length === 1 && firstShop?.shopSlug)
    return (
      <Link
        className="text-primary text-sm font-medium underline"
        to={`/app/${firstShop.shopSlug}/dashboard`}
      >
        Open {firstShop.shopName}
      </Link>
    );
  return (
    <label className="text-muted-foreground flex items-center gap-2 text-sm">
      <span className="sr-only">Active shop</span>
      <select
        aria-label="Active shop"
        className="border-input bg-background text-foreground rounded-md border px-2 py-1"
        value={current?.shopSlug ?? ''}
        onChange={(event) => {
          const selected = available.find(
            (membership) => membership.shopSlug === event.target.value,
          );
          if (selected?.shopSlug) {
            void switchTenantShop(selected.shopId)
              .then(() => navigate(`/app/${selected.shopSlug}/dashboard`))
              .catch((reason: unknown) => {
                setError(
                  reason instanceof ApiError
                    ? reason.message
                    : 'Could not switch shops.',
                );
              });
          }
        }}
      >
        {!current && <option value="">Choose a shop</option>}
        {available.map((membership) => (
          <option key={membership.shopId} value={membership.shopSlug ?? ''}>
            {membership.shopName}
          </option>
        ))}
      </select>
      {error && <span role="status">{error}</span>}
      {!current && firstShop?.shopSlug && (
        <Link
          className="text-primary underline"
          to={`/app/${firstShop.shopSlug}/dashboard`}
        >
          Choose shop
        </Link>
      )}
    </label>
  );
}
