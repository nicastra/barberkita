import { useMemo, useState, type FormEvent } from 'react';

import {
  cancelBooking,
  checkInBooking,
  completeBooking,
  confirmBooking,
  createStaffBooking,
  createWalkInBooking,
  getPublicAvailability,
  rescheduleBooking,
  startBooking,
  markNoShow,
  type Booking,
  type PublicOptions,
} from '@/api/bookings';
import type { Availability } from '@/api/catalog';
import { ApiError } from '@/api/client';
import type { Customer } from '@/api/customers';
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

function localDate(value: string, timezone: string): string {
  const parts = new Map(
    new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(new Date(value))
      .map((part) => [part.type, part.value]),
  );
  return `${parts.get('year')}-${parts.get('month')}-${parts.get('day')}`;
}

interface AppointmentPanelProps {
  options: PublicOptions;
  customers: Customer[];
  selectedCustomerId: string | null;
  bookings: Booking[];
  onBookingsChange: (bookings: Booking[]) => void;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
}

export function AppointmentPanel({
  options,
  customers,
  selectedCustomerId,
  bookings,
  onBookingsChange,
  onError,
  onNotice,
}: AppointmentPanelProps) {
  const [serviceId, setServiceId] = useState('');
  const [barberId, setBarberId] = useState('');
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState('');
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<
    Availability['slots'][number] | null
  >(null);
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [walkIn, setWalkIn] = useState(false);
  const [saving, setSaving] = useState(false);

  const eligibleBarbers = useMemo(
    () =>
      options.barbers.filter((barber) => barber.serviceIds.includes(serviceId)),
    [options.barbers, serviceId],
  );

  function resetForm() {
    setServiceId('');
    setBarberId('');
    setDate(today());
    setNotes('');
    setAvailability(null);
    setSelectedSlot(null);
    setReschedulingId(null);
    setWalkIn(false);
  }

  async function findSlots(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!serviceId) return;
    setSaving(true);
    try {
      const response = await getPublicAvailability({
        serviceId,
        date,
        ...(barberId ? { barberId } : {}),
      });
      setAvailability(response.availability);
      setSelectedSlot(null);
    } catch {
      onError('Available appointment times could not be loaded.');
    } finally {
      setSaving(false);
    }
  }

  async function saveAppointment() {
    if (!selectedSlot || (!selectedCustomerId && !reschedulingId)) return;
    setSaving(true);
    try {
      const response = reschedulingId
        ? await rescheduleBooking(reschedulingId, {
            serviceId,
            barberId: selectedSlot.barberId,
            startAt: selectedSlot.startAt,
          })
        : walkIn
          ? await createWalkInBooking({
              customerId: selectedCustomerId!,
              serviceId,
              barberId: selectedSlot.barberId,
              startAt: selectedSlot.startAt,
              notes,
            })
          : await createStaffBooking({
              customerId: selectedCustomerId!,
              serviceId,
              barberId: selectedSlot.barberId,
              startAt: selectedSlot.startAt,
              notes,
            });
      onBookingsChange(
        reschedulingId
          ? bookings.map((booking) =>
              booking.id === response.booking.id ? response.booking : booking,
            )
          : [...bookings, response.booking].sort((left, right) =>
              left.startAt.localeCompare(right.startAt),
            ),
      );
      onNotice(
        reschedulingId
          ? 'Appointment rescheduled.'
          : walkIn
            ? 'Walk-in added to the queue.'
            : 'Appointment created.',
      );
      resetForm();
    } catch (caught) {
      if (
        caught instanceof ApiError &&
        caught.code === 'BOOKING_TIME_UNAVAILABLE'
      ) {
        setSelectedSlot(null);
        onError('That time was just taken. Search again for another slot.');
      } else {
        onError('The appointment could not be saved.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function transition(booking: Booking, action: 'confirm' | 'cancel') {
    setSaving(true);
    try {
      const response =
        action === 'confirm'
          ? await confirmBooking(booking.id)
          : await cancelBooking(booking.id);
      onBookingsChange(
        bookings.map((item) =>
          item.id === booking.id ? response.booking : item,
        ),
      );
      onNotice(
        action === 'confirm'
          ? 'Appointment confirmed.'
          : 'Appointment cancelled.',
      );
    } catch {
      onError('The appointment status could not be changed.');
    } finally {
      setSaving(false);
    }
  }

  async function operational(
    booking: Booking,
    action: 'check-in' | 'start' | 'complete' | 'no-show',
  ) {
    setSaving(true);
    try {
      const response =
        action === 'check-in'
          ? await checkInBooking(booking.id)
          : action === 'start'
            ? await startBooking(booking.id)
            : action === 'complete'
              ? await completeBooking(booking.id)
              : await markNoShow(booking.id);
      onBookingsChange(
        bookings.map((item) =>
          item.id === booking.id ? response.booking : item,
        ),
      );
      onNotice(
        action === 'check-in'
          ? 'Customer checked in.'
          : action === 'start'
            ? 'Service started.'
            : action === 'complete'
              ? 'Service completed.'
              : 'Appointment marked as no-show.',
      );
    } catch {
      onError('The operational status could not be changed.');
    } finally {
      setSaving(false);
    }
  }

  function startReschedule(booking: Booking) {
    setReschedulingId(booking.id);
    setServiceId(booking.serviceId);
    setBarberId(booking.barberId);
    setDate(localDate(booking.startAt, booking.shop.timezone));
    setAvailability(null);
    setSelectedSlot(null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appointments</CardTitle>
        <CardDescription>
          Create, confirm, reschedule, or cancel using server-authoritative
          slots.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-medium">
              {reschedulingId
                ? 'Reschedule appointment'
                : walkIn
                  ? 'Add walk-in'
                  : 'Create appointment'}
            </h3>
            {!reschedulingId && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={walkIn}
                  onChange={(event) => setWalkIn(event.target.checked)}
                />
                Walk-in queue entry
              </label>
            )}
          </div>
          {!reschedulingId && (
            <p className="text-muted-foreground mt-1 text-sm">
              Customer:{' '}
              {customers.find((customer) => customer.id === selectedCustomerId)
                ?.name ?? 'Select a customer above'}
            </p>
          )}
          <form
            className="mt-4 grid gap-3 sm:grid-cols-2"
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
                    {service.name}
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
              >
                <option value="">Any eligible barber</option>
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
            {!reschedulingId && (
              <label className="text-sm font-medium">
                Notes
                <input
                  className={fieldClass}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </label>
            )}
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" disabled={!serviceId || saving}>
                Find times
              </Button>
              {reschedulingId && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel reschedule
                </Button>
              )}
            </div>
          </form>
          {availability && (
            <div className="mt-4">
              {availability.slots.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No available times for this selection.
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
              <Button
                className="mt-4"
                disabled={
                  !selectedSlot ||
                  saving ||
                  (!selectedCustomerId && !reschedulingId)
                }
                onClick={() => void saveAppointment()}
              >
                {reschedulingId
                  ? 'Save new time'
                  : walkIn
                    ? 'Add walk-in'
                    : 'Create appointment'}
              </Button>
            </div>
          )}
        </div>
        {bookings.length === 0 ? (
          <p className="text-muted-foreground text-sm">No appointments yet.</p>
        ) : (
          <div className="divide-border divide-y">
            {bookings.map((booking) => (
              <div key={booking.id} className="space-y-3 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {booking.customer.name} · {booking.service.name}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {new Intl.DateTimeFormat('en-GB', {
                        timeZone: booking.shop.timezone,
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(booking.startAt))}{' '}
                      · {booking.barber.name}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {booking.status} · {booking.confirmationCode}
                    </p>
                  </div>
                  {booking.status !== 'cancelled' &&
                    booking.status !== 'completed' &&
                    booking.status !== 'no_show' && (
                      <div className="flex flex-wrap gap-2">
                        {booking.status === 'initial' && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={saving}
                            onClick={() => void transition(booking, 'confirm')}
                          >
                            Confirm
                          </Button>
                        )}
                        {(booking.status === 'confirmed' ||
                          booking.status === 'rescheduled') && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={saving}
                            onClick={() =>
                              void operational(booking, 'check-in')
                            }
                          >
                            Check in
                          </Button>
                        )}
                        {booking.status === 'checked_in' && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={saving}
                            onClick={() => void operational(booking, 'start')}
                          >
                            Start service
                          </Button>
                        )}
                        {booking.status === 'in_service' && (
                          <Button
                            size="sm"
                            disabled={saving}
                            onClick={() =>
                              void operational(booking, 'complete')
                            }
                          >
                            Complete
                          </Button>
                        )}
                        {(booking.status === 'confirmed' ||
                          booking.status === 'rescheduled') && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={saving}
                            onClick={() => void operational(booking, 'no-show')}
                          >
                            No-show
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={saving}
                          onClick={() => startReschedule(booking)}
                        >
                          Reschedule
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={saving}
                          onClick={() => void transition(booking, 'cancel')}
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
