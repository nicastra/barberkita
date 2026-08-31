import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import {
  getPublicOptions,
  listBookings,
  type BookingStatus,
  type Booking,
  type PublicOptions,
} from '@/api/bookings';
import { listCustomers, type Customer } from '@/api/customers';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { AppointmentPanel } from './AppointmentPanel';
import { CustomerPanel } from './CustomerPanel';

const bookingStatuses = [
  ['all', 'All statuses'],
  ['initial', 'Initial'],
  ['confirmed', 'Confirmed'],
  ['checked_in', 'Checked in'],
  ['in_service', 'In service'],
  ['completed', 'Completed'],
  ['cancelled', 'Cancelled'],
  ['no_show', 'No-show'],
] as const;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function StaffBookingWorkspace() {
  const [searchParams] = useSearchParams();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [options, setOptions] = useState<PublicOptions | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => {
    const requestedDate = searchParams.get('date');
    return requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
      ? requestedDate
      : today();
  });
  const [barberFilter, setBarberFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>(
    'all',
  );

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
      const [customerResponse, bookingResponse, optionResponse] =
        await Promise.all([
          listCustomers(),
          listBookings({
            date: selectedDate,
            ...(barberFilter ? { barberId: barberFilter } : {}),
            ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
          }),
          getPublicOptions(),
        ]);
      setCustomers(customerResponse.customers);
      setBookings(bookingResponse.bookings);
      setOptions(optionResponse.options);
      setSelectedCustomerId(
        (current) => current ?? customerResponse.customers[0]?.id ?? null,
      );
    } catch {
      setError('The customer and appointment workspace could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [barberFilter, selectedDate, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading)
    return (
      <Card aria-live="polite">
        <CardHeader>
          <CardTitle>Customers and appointments</CardTitle>
          <CardDescription>Loading booking workspace…</CardDescription>
        </CardHeader>
      </Card>
    );

  if (!options)
    return (
      <Card>
        <CardHeader>
          <CardTitle>Customers and appointments</CardTitle>
          <CardDescription>
            {error ?? 'The shop catalog is not ready for bookings.'}
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
    <section aria-labelledby="booking-heading" className="space-y-6">
      <div>
        <h1
          id="booking-heading"
          className="text-2xl font-semibold tracking-tight"
        >
          Customers and appointments
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Maintain customer records and manage bookings in{' '}
          {options.shop.timezone}.
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
          <CardTitle>Day view</CardTitle>
          <CardDescription>
            Filter the queue by day, barber, and operational status.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm font-medium">
            Day
            <input
              className="border-input bg-background mt-1 block w-full rounded-md border px-3 py-2 text-sm"
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
          </label>
          <label className="text-sm font-medium">
            Barber
            <select
              className="border-input bg-background mt-1 block w-full rounded-md border px-3 py-2 text-sm"
              value={barberFilter}
              onChange={(event) => setBarberFilter(event.target.value)}
            >
              <option value="">All barbers</option>
              {options.barbers.map((barber) => (
                <option key={barber.id} value={barber.id}>
                  {barber.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Status
            <select
              className="border-input bg-background mt-1 block w-full rounded-md border px-3 py-2 text-sm"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as BookingStatus | 'all')
              }
            >
              {bookingStatuses.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </CardContent>
      </Card>
      <CustomerPanel
        customers={customers}
        selectedId={selectedCustomerId}
        onCustomersChange={setCustomers}
        onSelect={(id) => setSelectedCustomerId(id || null)}
        onError={showError}
        onNotice={showNotice}
      />
      <AppointmentPanel
        options={options}
        customers={customers}
        selectedCustomerId={selectedCustomerId}
        bookings={bookings}
        onBookingsChange={setBookings}
        onError={showError}
        onNotice={showNotice}
      />
    </section>
  );
}
