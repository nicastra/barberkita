import { useEffect, useMemo, useState, type FormEvent } from 'react';

import {
  createPublicBooking,
  getPublicAvailability,
  getPublicOptions,
  type Booking,
  type PublicOptions,
} from '@/api/bookings';
import type { Availability } from '@/api/catalog';
import { ApiError } from '@/api/client';
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

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function localTime(booking: Booking): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: booking.shop.timezone,
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(new Date(booking.startAt));
}

export function PublicBookingFlow() {
  const [options, setOptions] = useState<PublicOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState('');
  const [barberId, setBarberId] = useState('');
  const [date, setDate] = useState(today());
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<
    Availability['slots'][number] | null
  >(null);
  const [customer, setCustomer] = useState({
    name: '',
    phone: '',
    email: '',
  });
  const [confirmation, setConfirmation] = useState<Booking | null>(null);

  useEffect(() => {
    getPublicOptions()
      .then((response) => setOptions(response.options))
      .catch(() => setError('Public booking is not available right now.'))
      .finally(() => setLoading(false));
  }, []);

  const eligibleBarbers = useMemo(
    () =>
      options?.barbers.filter((barber) =>
        barber.serviceIds.includes(serviceId),
      ) ?? [],
    [options, serviceId],
  );

  async function findSlots(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!serviceId) return;
    setSearching(true);
    setError(null);
    setSelectedSlot(null);
    try {
      const response = await getPublicAvailability({
        serviceId,
        date,
        ...(barberId ? { barberId } : {}),
      });
      setAvailability(response.availability);
    } catch {
      setAvailability(null);
      setError('Available times could not be loaded. Please try again.');
    } finally {
      setSearching(false);
    }
  }

  async function book(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSlot) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await createPublicBooking({
        serviceId,
        barberId: selectedSlot.barberId,
        startAt: selectedSlot.startAt,
        customer: {
          name: customer.name,
          phone: customer.phone,
          email: customer.email || null,
        },
      });
      setConfirmation(response.booking);
    } catch (caught) {
      if (
        caught instanceof ApiError &&
        caught.code === 'BOOKING_TIME_UNAVAILABLE'
      ) {
        setSelectedSlot(null);
        setError(
          'That time was just taken. Search again to choose another slot.',
        );
      } else {
        setError('The booking could not be completed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading)
    return (
      <Card aria-live="polite">
        <CardHeader>
          <CardTitle>Book an appointment</CardTitle>
          <CardDescription>Loading services and barbers…</CardDescription>
        </CardHeader>
      </Card>
    );

  if (!options)
    return (
      <Card>
        <CardHeader>
          <CardTitle>Booking unavailable</CardTitle>
          <CardDescription>
            {error ?? 'The shop has not opened online booking yet.'}
          </CardDescription>
        </CardHeader>
      </Card>
    );

  if (options.services.length === 0)
    return (
      <Card>
        <CardHeader>
          <CardTitle>Online booking is not ready</CardTitle>
          <CardDescription>
            {options.shop.name} has no active services available for booking.
          </CardDescription>
        </CardHeader>
      </Card>
    );

  if (confirmation)
    return (
      <Card aria-live="polite">
        <CardHeader>
          <CardTitle>Appointment received</CardTitle>
          <CardDescription>
            Keep this confirmation for your records.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-lg font-semibold">{confirmation.shop.name}</p>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Service</dt>
              <dd>{confirmation.service.name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Barber</dt>
              <dd>{confirmation.barber.name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Local time</dt>
              <dd>{localTime(confirmation)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Confirmation</dt>
              <dd className="font-mono font-semibold">
                {confirmation.confirmationCode}
              </dd>
            </div>
          </dl>
          <p className="text-muted-foreground text-sm">
            {confirmation.shop.address} · {confirmation.shop.phone}
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setConfirmation(null);
              setSelectedSlot(null);
              setAvailability(null);
            }}
          >
            Book another appointment
          </Button>
        </CardContent>
      </Card>
    );

  return (
    <section aria-labelledby="public-booking-heading" className="space-y-6">
      <div>
        <p className="text-primary text-sm font-medium">{options.shop.name}</p>
        <h1
          id="public-booking-heading"
          className="text-3xl font-semibold tracking-tight"
        >
          Book an appointment
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Times are shown in {options.shop.timezone}.
        </p>
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <Card>
        <CardHeader>
          <CardTitle>1. Choose a time</CardTitle>
          <CardDescription>
            Select a service, preferred barber, and date.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(event) => void findSlots(event)}
          >
            <label className="text-sm font-medium">
              Service
              <select
                className={fieldClass}
                value={serviceId}
                onChange={(event) => {
                  setServiceId(event.target.value);
                  setBarberId('');
                  setAvailability(null);
                }}
                required
              >
                <option value="">Select a service</option>
                {options.services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} · {service.durationMinutes} min · Rp
                    {service.priceRupiah.toLocaleString('id-ID')}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              Barber
              <select
                className={fieldClass}
                value={barberId}
                onChange={(event) => setBarberId(event.target.value)}
                disabled={!serviceId}
              >
                <option value="">Any available barber</option>
                {eligibleBarbers.map((barber) => (
                  <option key={barber.id} value={barber.id}>
                    {barber.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              Date
              <input
                className={fieldClass}
                type="date"
                min={today()}
                value={date}
                onChange={(event) => setDate(event.target.value)}
                required
              />
            </label>
            <div className="self-end">
              <Button type="submit" disabled={searching || !serviceId}>
                {searching ? 'Checking…' : 'Find available times'}
              </Button>
            </div>
          </form>
          {availability && (
            <div className="mt-6">
              {availability.slots.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No times are available for this selection.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {availability.slots.map((slot) => (
                    <Button
                      key={`${slot.barberId}-${slot.startAt}`}
                      type="button"
                      size="sm"
                      variant={
                        selectedSlot?.barberId === slot.barberId &&
                        selectedSlot.startAt === slot.startAt
                          ? 'default'
                          : 'outline'
                      }
                      aria-pressed={
                        selectedSlot?.barberId === slot.barberId &&
                        selectedSlot.startAt === slot.startAt
                      }
                      onClick={() => setSelectedSlot(slot)}
                    >
                      {new Intl.DateTimeFormat('en-GB', {
                        timeZone: availability.timezone,
                        hour: '2-digit',
                        minute: '2-digit',
                      }).format(new Date(slot.startAt))}{' '}
                      · {slot.barberName}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>2. Your details</CardTitle>
          <CardDescription>
            Contact details are used only to manage this appointment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(event) => void book(event)}
          >
            <label className="text-sm font-medium">
              Name
              <input
                className={fieldClass}
                value={customer.name}
                onChange={(event) =>
                  setCustomer({ ...customer, name: event.target.value })
                }
                required
              />
            </label>
            <label className="text-sm font-medium">
              Phone
              <input
                className={fieldClass}
                type="tel"
                value={customer.phone}
                onChange={(event) =>
                  setCustomer({ ...customer, phone: event.target.value })
                }
                required
              />
            </label>
            <label className="text-sm font-medium sm:col-span-2">
              Email (optional)
              <input
                className={fieldClass}
                type="email"
                value={customer.email}
                onChange={(event) =>
                  setCustomer({ ...customer, email: event.target.value })
                }
              />
            </label>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={!selectedSlot || submitting}>
                {submitting
                  ? 'Booking…'
                  : selectedSlot
                    ? 'Confirm appointment'
                    : 'Choose a time first'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
