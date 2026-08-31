import { useState, type FormEvent } from 'react';

import {
  createService,
  updateService,
  type Service,
  type ServiceInput,
} from '@/api/catalog';
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

const emptyService: ServiceInput = {
  name: '',
  description: '',
  durationMinutes: 30,
  priceRupiah: 0,
  active: true,
};

interface ServiceCatalogPanelProps {
  services: Service[];
  onChange: (services: Service[]) => void;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
}

export function ServiceCatalogPanel({
  services,
  onChange,
  onError,
  onNotice,
}: ServiceCatalogPanelProps) {
  const [draft, setDraft] = useState<ServiceInput>(emptyService);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function edit(service: Service) {
    setEditingId(service.id);
    setDraft({
      name: service.name,
      description: service.description,
      durationMinutes: service.durationMinutes,
      priceRupiah: service.priceRupiah,
      active: service.active,
    });
  }

  function reset() {
    setEditingId(null);
    setDraft(emptyService);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = editingId
        ? await updateService(editingId, draft)
        : await createService(draft);
      onChange(
        editingId
          ? services.map((service) =>
              service.id === response.service.id ? response.service : service,
            )
          : [...services, response.service],
      );
      onNotice(editingId ? 'Service updated.' : 'Service created.');
      reset();
    } catch {
      onError('The service could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(service: Service) {
    try {
      const response = await updateService(service.id, {
        active: !service.active,
      });
      onChange(
        services.map((item) =>
          item.id === service.id ? response.service : item,
        ),
      );
      onNotice(
        response.service.active ? 'Service activated.' : 'Service deactivated.',
      );
    } catch {
      onError('The service status could not be changed.');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Service catalog</CardTitle>
        <CardDescription>
          Define duration and integer-rupiah pricing without deleting history.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form
          className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2"
          onSubmit={(event) => void save(event)}
        >
          <h3 className="font-medium sm:col-span-2">
            {editingId ? 'Edit service' : 'Add service'}
          </h3>
          <label className="text-sm font-medium">
            Name
            <input
              className={fieldClass}
              value={draft.name}
              onChange={(event) =>
                setDraft({ ...draft, name: event.target.value })
              }
              required
            />
          </label>
          <label className="text-sm font-medium">
            Duration (minutes)
            <input
              className={fieldClass}
              type="number"
              min={1}
              max={720}
              value={draft.durationMinutes}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  durationMinutes: Number(event.target.value),
                })
              }
              required
            />
          </label>
          <label className="text-sm font-medium">
            Price (Rp)
            <input
              className={fieldClass}
              type="number"
              min={0}
              step={1}
              value={draft.priceRupiah}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  priceRupiah: Number(event.target.value),
                })
              }
              required
            />
          </label>
          <label className="text-sm font-medium sm:col-span-2">
            Description
            <textarea
              className={fieldClass}
              rows={2}
              value={draft.description}
              onChange={(event) =>
                setDraft({ ...draft, description: event.target.value })
              }
            />
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save service' : 'Add service'}
            </Button>
            {editingId && (
              <Button type="button" variant="outline" onClick={reset}>
                Cancel
              </Button>
            )}
          </div>
        </form>
        {services.length === 0 ? (
          <p className="text-muted-foreground text-sm">No services yet.</p>
        ) : (
          <div className="divide-border divide-y">
            {services.map((service) => (
              <div
                key={service.id}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">
                    {service.name}{' '}
                    {!service.active && (
                      <span className="text-muted-foreground text-xs">
                        Inactive
                      </span>
                    )}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {service.durationMinutes} min · Rp
                    {service.priceRupiah.toLocaleString('id-ID')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => edit(service)}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void toggleActive(service)}
                  >
                    {service.active ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
