import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  listBarbers,
  listServices,
  type Barber,
  type Service,
} from '@/api/catalog';
import { listStaff, type StaffMember } from '@/api/shop';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { BarberProfilesPanel } from './BarberProfilesPanel';
import { BarberScheduleEditor } from './BarberScheduleEditor';
import { ServiceCatalogPanel } from './ServiceCatalogPanel';

export function SchedulingWorkspace() {
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const showError = useCallback((message: string) => {
    setError(message);
    setNotice(null);
  }, []);
  const showNotice = useCallback((message: string) => {
    setNotice(message);
    setError(null);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [serviceResponse, barberResponse, staffResponse] =
        await Promise.all([listServices(), listBarbers(), listStaff()]);
      setServices(serviceResponse.services);
      setBarbers(barberResponse.barbers);
      setStaff(staffResponse.staff);
      setSelectedId(
        (current) => current ?? barberResponse.barbers[0]?.id ?? null,
      );
    } catch {
      setError('The scheduling workspace could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedBarber = useMemo(
    () => barbers.find((barber) => barber.id === selectedId) ?? null,
    [barbers, selectedId],
  );

  if (loading)
    return (
      <Card aria-live="polite">
        <CardHeader>
          <CardTitle>Services and availability</CardTitle>
          <CardDescription>Loading scheduling workspace…</CardDescription>
        </CardHeader>
      </Card>
    );

  if (error && services.length === 0 && barbers.length === 0)
    return (
      <Card>
        <CardHeader>
          <CardTitle>Services and availability</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => void load()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );

  return (
    <section aria-labelledby="scheduling-heading" className="space-y-6">
      <div>
        <h1
          id="scheduling-heading"
          className="text-2xl font-semibold tracking-tight"
        >
          Services and availability
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Configure bookable work, barber eligibility, and shop-timezone
          schedules.
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
      <ServiceCatalogPanel
        services={services}
        onChange={setServices}
        onError={showError}
        onNotice={showNotice}
      />
      <BarberProfilesPanel
        barbers={barbers}
        services={services}
        staff={staff}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onChange={setBarbers}
        onError={showError}
        onNotice={showNotice}
      />
      <BarberScheduleEditor
        barber={selectedBarber}
        services={services}
        onError={showError}
        onNotice={showNotice}
      />
    </section>
  );
}
