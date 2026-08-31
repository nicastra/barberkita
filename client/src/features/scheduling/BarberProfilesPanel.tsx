import { useState, type FormEvent } from 'react';

import {
  assignBarberServices,
  createBarber,
  updateBarber,
  type Barber,
  type Service,
} from '@/api/catalog';
import type { StaffMember } from '@/api/shop';
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

interface BarberProfilesPanelProps {
  barbers: Barber[];
  services: Service[];
  staff: StaffMember[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onChange: (barbers: Barber[]) => void;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
}

export function BarberProfilesPanel({
  barbers,
  services,
  staff,
  selectedId,
  onSelect,
  onChange,
  onError,
  onNotice,
}: BarberProfilesPanelProps) {
  const [name, setName] = useState('');
  const [staffUserId, setStaffUserId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setName('');
    setStaffUserId('');
    setEditingId(null);
  }

  function editBarber(barber: Barber) {
    setName(barber.name);
    setStaffUserId(barber.staffUserId ?? '');
    setEditingId(barber.id);
    onSelect(barber.id);
  }

  async function saveBarber(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = editingId
        ? await updateBarber(editingId, {
            name,
            staffUserId: staffUserId || null,
          })
        : await createBarber({
            name,
            staffUserId: staffUserId || null,
            active: true,
          });
      onChange(
        editingId
          ? barbers.map((barber) =>
              barber.id === editingId ? response.barber : barber,
            )
          : [...barbers, response.barber],
      );
      onSelect(response.barber.id);
      onNotice(
        editingId ? 'Barber profile updated.' : 'Barber profile created.',
      );
      resetForm();
    } catch {
      onError('The barber profile could not be created.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleBarber(barber: Barber) {
    try {
      const response = await updateBarber(barber.id, {
        active: !barber.active,
      });
      onChange(
        barbers.map((item) => (item.id === barber.id ? response.barber : item)),
      );
      onNotice(
        response.barber.active ? 'Barber activated.' : 'Barber deactivated.',
      );
    } catch {
      onError('The barber status could not be changed.');
    }
  }

  async function toggleService(barber: Barber, serviceId: string) {
    const serviceIds = barber.serviceIds.includes(serviceId)
      ? barber.serviceIds.filter((id) => id !== serviceId)
      : [...barber.serviceIds, serviceId];
    try {
      const response = await assignBarberServices(barber.id, serviceIds);
      onChange(
        barbers.map((item) => (item.id === barber.id ? response.barber : item)),
      );
      onNotice('Service eligibility updated.');
    } catch {
      onError('Service eligibility could not be updated.');
    }
  }

  const linkedStaffIds = new Set(
    barbers.flatMap((barber) =>
      barber.staffUserId ? [barber.staffUserId] : [],
    ),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Barber profiles</CardTitle>
        <CardDescription>
          Keep operating identities durable and assign eligible services.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form
          className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2"
          onSubmit={(event) => void saveBarber(event)}
        >
          <h3 className="font-medium sm:col-span-2">
            {editingId ? 'Edit barber' : 'Add barber'}
          </h3>
          <label className="text-sm font-medium">
            Display name
            <input
              className={fieldClass}
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>
          <label className="text-sm font-medium">
            Linked staff account (optional)
            <select
              className={fieldClass}
              value={staffUserId}
              onChange={(event) => setStaffUserId(event.target.value)}
            >
              <option value="">No linked account</option>
              {staff
                .filter(
                  (member) =>
                    !linkedStaffIds.has(member.id) || member.id === staffUserId,
                )
                .map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
            </select>
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={saving}>
              {saving
                ? 'Saving…'
                : editingId
                  ? 'Save barber profile'
                  : 'Create barber profile'}
            </Button>
            {editingId && (
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            )}
          </div>
        </form>
        {barbers.length === 0 ? (
          <p className="text-muted-foreground text-sm">No barbers yet.</p>
        ) : (
          <div className="space-y-4">
            {barbers.map((barber) => (
              <div
                key={barber.id}
                className={`rounded-lg border p-4 ${selectedId === barber.id ? 'border-primary' : ''}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    className="text-left font-medium"
                    onClick={() => onSelect(barber.id)}
                  >
                    {barber.name}{' '}
                    {!barber.active && (
                      <span className="text-muted-foreground text-xs">
                        Inactive
                      </span>
                    )}
                  </button>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => editBarber(barber)}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void toggleBarber(barber)}
                    >
                      {barber.active ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                </div>
                <fieldset className="mt-4">
                  <legend className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                    Eligible services
                  </legend>
                  {services.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      Add a service before assigning eligibility.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-3">
                      {services.map((service) => (
                        <label
                          key={service.id}
                          className="flex items-center gap-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={barber.serviceIds.includes(service.id)}
                            onChange={() =>
                              void toggleService(barber, service.id)
                            }
                          />
                          {service.name}
                        </label>
                      ))}
                    </div>
                  )}
                </fieldset>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
