import { useCallback, useEffect, useState, type FormEvent } from 'react';

import {
  createStaff,
  deleteStaff,
  getShop,
  listStaff,
  updateShop,
  updateStaff,
  type Shop,
  type StaffMember,
} from '@/api/shop';
import type { AuthUser } from '@/api/auth';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const fieldClass =
  'border-input bg-background mt-1 block w-full rounded-md border px-3 py-2 text-sm';

interface OwnerAdminPanelProps {
  user: AuthUser;
}

export function OwnerAdminPanel({ user }: OwnerAdminPanelProps) {
  const [shop, setShop] = useState<Shop | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingShop, setSavingShop] = useState(false);
  const [savingStaff, setSavingStaff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [newStaff, setNewStaff] = useState({
    name: '',
    email: '',
    password: '',
    role: 'staff' as 'staff' | 'owner',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [shopResponse, staffResponse] = await Promise.all([
        getShop(),
        listStaff(),
      ]);
      setShop(shopResponse.shop);
      setStaff(staffResponse.staff);
    } catch {
      setError('We could not load shop administration data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, user.id]);

  async function saveShop(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!shop) return;
    setSavingShop(true);
    setError(null);
    setNotice(null);
    try {
      const response = await updateShop({
        name: shop.name,
        phone: shop.phone,
        email: shop.email,
        address: shop.address,
        timezone: shop.timezone,
      });
      setShop(response.shop);
      setNotice('Shop profile saved.');
    } catch {
      setError('The shop profile could not be saved.');
    } finally {
      setSavingShop(false);
    }
  }

  async function addStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingStaff(true);
    setError(null);
    setNotice(null);
    try {
      const response = await createStaff(newStaff);
      setStaff((current) => [...current, response.staff]);
      setNewStaff({ name: '', email: '', password: '', role: 'staff' });
      setNotice('Staff account created.');
    } catch {
      setError('The staff account could not be created.');
    } finally {
      setSavingStaff(false);
    }
  }

  async function removeStaff(member: StaffMember) {
    if (
      member.id === user.id ||
      !window.confirm(`Remove ${member.name}'s account?`)
    )
      return;
    setError(null);
    setNotice(null);
    try {
      await deleteStaff(member.id);
      setStaff((current) => current.filter((item) => item.id !== member.id));
      setNotice('Staff account removed.');
    } catch {
      setError('The staff account could not be removed.');
    }
  }

  async function changeRole(member: StaffMember, role: 'staff' | 'owner') {
    if (role === member.role) return;
    setError(null);
    try {
      const response = await updateStaff(member.id, { role });
      setStaff((current) =>
        current.map((item) => (item.id === member.id ? response.staff : item)),
      );
      setNotice('Staff role updated.');
    } catch {
      setError('The staff role could not be updated.');
    }
  }

  if (user.role !== 'owner') return null;
  if (loading)
    return (
      <Card aria-live="polite">
        <CardHeader>
          <CardTitle>Shop administration</CardTitle>
          <CardDescription>Loading your shop workspace…</CardDescription>
        </CardHeader>
      </Card>
    );
  if (!shop)
    return (
      <Card>
        <CardHeader>
          <CardTitle>Shop administration</CardTitle>
          <CardDescription>
            {error ?? 'Shop setup is not complete.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => void load()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );

  return (
    <section aria-labelledby="admin-heading" className="space-y-6">
      <div>
        <h2 id="admin-heading" className="text-xl font-semibold">
          Owner administration
        </h2>
        <p className="text-muted-foreground text-sm">
          Manage the shop identity and staff access.
        </p>
      </div>
      {(error || notice) && (
        <p
          role={error ? 'alert' : 'status'}
          className={
            error ? 'text-destructive text-sm' : 'text-sm text-emerald-700'
          }
        >
          {error ?? notice}
        </p>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Shop profile</CardTitle>
          <CardDescription>
            This information appears in your operating workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(event) => void saveShop(event)}
          >
            <label className="text-sm font-medium">
              Shop name
              <input
                className={fieldClass}
                value={shop.name}
                onChange={(event) =>
                  setShop({ ...shop, name: event.target.value })
                }
                required
              />
            </label>
            <label className="text-sm font-medium">
              Phone
              <input
                className={fieldClass}
                value={shop.phone}
                onChange={(event) =>
                  setShop({ ...shop, phone: event.target.value })
                }
                required
              />
            </label>
            <label className="text-sm font-medium">
              Contact email
              <input
                className={fieldClass}
                type="email"
                value={shop.email}
                onChange={(event) =>
                  setShop({ ...shop, email: event.target.value })
                }
                required
              />
            </label>
            <label className="text-sm font-medium">
              Timezone
              <input
                className={fieldClass}
                value={shop.timezone}
                onChange={(event) =>
                  setShop({ ...shop, timezone: event.target.value })
                }
                required
              />
            </label>
            <label className="text-sm font-medium sm:col-span-2">
              Address
              <textarea
                className={fieldClass}
                rows={2}
                value={shop.address}
                onChange={(event) =>
                  setShop({ ...shop, address: event.target.value })
                }
                required
              />
            </label>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={savingShop}>
                {savingShop ? 'Saving…' : 'Save shop profile'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Staff accounts</CardTitle>
          <CardDescription>
            Owners can invite and remove the people who run the shop.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form
            className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2"
            onSubmit={(event) => void addStaff(event)}
          >
            <div className="sm:col-span-2">
              <h3 className="font-medium">Add staff member</h3>
            </div>
            <label className="text-sm font-medium">
              Name
              <input
                className={fieldClass}
                value={newStaff.name}
                onChange={(event) =>
                  setNewStaff({ ...newStaff, name: event.target.value })
                }
                required
              />
            </label>
            <label className="text-sm font-medium">
              Email
              <input
                className={fieldClass}
                type="email"
                value={newStaff.email}
                onChange={(event) =>
                  setNewStaff({ ...newStaff, email: event.target.value })
                }
                required
              />
            </label>
            <label className="text-sm font-medium">
              Temporary password
              <input
                className={fieldClass}
                type="password"
                minLength={12}
                value={newStaff.password}
                onChange={(event) =>
                  setNewStaff({ ...newStaff, password: event.target.value })
                }
                required
              />
            </label>
            <label className="text-sm font-medium">
              Role
              <select
                className={fieldClass}
                value={newStaff.role}
                onChange={(event) =>
                  setNewStaff({
                    ...newStaff,
                    role: event.target.value as 'staff' | 'owner',
                  })
                }
              >
                <option value="staff">Staff</option>
                <option value="owner">Owner</option>
              </select>
            </label>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={savingStaff}>
                {savingStaff ? 'Creating…' : 'Create account'}
              </Button>
            </div>
          </form>
          {staff.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No staff accounts yet.
            </p>
          ) : (
            <div className="divide-border divide-y">
              {staff.map((member) => (
                <div
                  key={member.id}
                  className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">
                      {member.name}
                      {member.id === user.id && (
                        <span className="text-muted-foreground ml-2 text-xs">
                          You
                        </span>
                      )}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {member.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      aria-label={`Role for ${member.name}`}
                      className="border-input bg-background rounded-md border px-2 py-2 text-sm"
                      value={member.role}
                      disabled={member.id === user.id}
                      onChange={(event) =>
                        void changeRole(
                          member,
                          event.target.value as 'staff' | 'owner',
                        )
                      }
                    >
                      <option value="staff">Staff</option>
                      <option value="owner">Owner</option>
                    </select>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={member.id === user.id}
                      onClick={() => void removeStaff(member)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
