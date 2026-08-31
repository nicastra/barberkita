import { useCallback, useEffect, useMemo, useState } from 'react';

import { ApiError } from '@/api/client';
import {
  correctPayment,
  createCheckout,
  listCheckouts,
  recordPayment,
  type Checkout,
} from '@/api/checkouts';
import { listBookings, type Booking } from '@/api/bookings';
import type { AuthUser } from '@/api/auth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

function money(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function CheckoutWorkspace({ user }: { user: AuthUser | null }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [checkouts, setCheckouts] = useState<Checkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [discounts, setDiscounts] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [paymentAmounts, setPaymentAmounts] = useState<Record<string, string>>(
    {},
  );
  const [methods, setMethods] = useState<
    Record<string, Checkout['payments'][number]['method']>
  >({});
  const [references, setReferences] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [bookingResponse, checkoutResponse] = await Promise.all([
        listBookings({ status: 'completed' }),
        listCheckouts(),
      ]);
      setBookings(bookingResponse.bookings);
      setCheckouts(checkoutResponse.checkouts);
    } catch {
      setError('Checkout history could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const checkoutByBooking = useMemo(
    () => new Map(checkouts.map((checkout) => [checkout.bookingId, checkout])),
    [checkouts],
  );
  async function startCheckout(booking: Booking) {
    setSaving(true);
    setError(null);
    try {
      const response = await createCheckout({
        bookingId: booking.id,
        discountRupiah: Number(discounts[booking.id] ?? 0),
        adjustmentReason: reasons[booking.id] ?? '',
      });
      setCheckouts((current) => [
        response.checkout,
        ...current.filter((item) => item.id !== response.checkout.id),
      ]);
      setNotice(`Receipt ${response.checkout.receiptNumber} is ready.`);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Checkout could not be started.',
      );
    } finally {
      setSaving(false);
    }
  }
  async function pay(checkout: Checkout) {
    const amount = Number(
      paymentAmounts[checkout.id] ?? checkout.remainingRupiah,
    );
    setSaving(true);
    setError(null);
    try {
      const response = await recordPayment(checkout.id, {
        amountRupiah: amount,
        method: methods[checkout.id] ?? 'cash',
        reference: references[checkout.id] ?? '',
        idempotencyKey: crypto.randomUUID(),
      });
      setCheckouts((current) =>
        current.map((item) =>
          item.id === checkout.id ? response.checkout : item,
        ),
      );
      setNotice('Payment recorded.');
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Payment could not be recorded.',
      );
    } finally {
      setSaving(false);
    }
  }
  async function correct(
    checkout: Checkout,
    paymentId: string,
    kind: 'void' | 'refund',
    amount: number,
  ) {
    const reason = window.prompt(
      `${kind === 'void' ? 'Void' : 'Refund'} reason`,
    );
    if (!reason) return;
    setSaving(true);
    setError(null);
    try {
      const response = await correctPayment(checkout.id, paymentId, {
        kind,
        reason,
        ...(kind === 'refund' ? { amountRupiah: amount } : {}),
        idempotencyKey: crypto.randomUUID(),
      });
      setCheckouts((current) =>
        current.map((item) =>
          item.id === checkout.id ? response.checkout : item,
        ),
      );
      setNotice(`Payment ${kind === 'void' ? 'voided' : 'refunded'}.`);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Correction could not be saved.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return (
      <Card aria-live="polite">
        <CardHeader>
          <CardTitle>Checkout</CardTitle>
          <CardDescription>
            Loading completed services and receipts…
          </CardDescription>
        </CardHeader>
      </Card>
    );
  return (
    <section className="space-y-6" aria-labelledby="checkout-heading">
      <div>
        <h1
          id="checkout-heading"
          className="text-2xl font-semibold tracking-tight"
        >
          Checkout and payments
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Turn completed services into traceable receipts and payments.
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
          <CardTitle>Completed services</CardTitle>
          <CardDescription>
            Create one immutable receipt per completed appointment.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {bookings.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No completed services are waiting for checkout.
            </p>
          ) : (
            bookings.map((booking) => {
              const checkout = checkoutByBooking.get(booking.id);
              return (
                <div
                  key={booking.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div>
                    <p className="font-medium">
                      {booking.customer.name} · {booking.service.name}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {money(booking.service.priceRupiah)} ·{' '}
                      {booking.barber.name}
                    </p>
                  </div>
                  {checkout ? (
                    <Badge
                      variant={
                        checkout.status === 'paid' ? 'success' : 'warning'
                      }
                    >
                      {checkout.receiptNumber} · {checkout.status}
                    </Badge>
                  ) : (
                    <div className="flex flex-wrap items-end gap-2">
                      <label className="text-xs">
                        Discount
                        <input
                          className="border-input bg-background mt-1 block w-28 rounded-md border px-2 py-1 text-sm"
                          type="number"
                          min="0"
                          value={discounts[booking.id] ?? ''}
                          onChange={(event) =>
                            setDiscounts((current) => ({
                              ...current,
                              [booking.id]: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="text-xs">
                        Reason
                        <input
                          className="border-input bg-background mt-1 block w-40 rounded-md border px-2 py-1 text-sm"
                          value={reasons[booking.id] ?? ''}
                          onChange={(event) =>
                            setReasons((current) => ({
                              ...current,
                              [booking.id]: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <Button
                        size="sm"
                        disabled={saving}
                        onClick={() => void startCheckout(booking)}
                      >
                        Start checkout
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
      <div className="grid gap-4">
        {checkouts.map((checkout) => (
          <Card key={checkout.id}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>{checkout.receiptNumber}</CardTitle>
                  <CardDescription>
                    {checkout.customer.name} · {checkout.barber.name}
                  </CardDescription>
                </div>
                <Badge
                  variant={
                    checkout.status === 'paid'
                      ? 'success'
                      : checkout.status === 'refunded'
                        ? 'outline'
                        : 'warning'
                  }
                >
                  {checkout.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 text-sm sm:grid-cols-3">
                <span>
                  Subtotal <strong>{money(checkout.subtotalRupiah)}</strong>
                </span>
                <span>
                  Adjustment <strong>-{money(checkout.discountRupiah)}</strong>
                </span>
                <span>
                  Total <strong>{money(checkout.totalRupiah)}</strong>
                </span>
              </div>
              <div className="border-border divide-border divide-y rounded-md border px-3 text-sm">
                {checkout.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between gap-3 py-2"
                  >
                    <span>
                      {item.description} × {item.quantity}
                    </span>
                    <strong>{money(item.lineTotalRupiah)}</strong>
                  </div>
                ))}
              </div>
              <div className="text-sm">
                Paid {money(checkout.paidRupiah)} · Remaining{' '}
                {money(checkout.remainingRupiah)}
              </div>
              {checkout.remainingRupiah > 0 && (
                <div className="flex flex-wrap items-end gap-2">
                  <label className="text-xs">
                    Amount
                    <input
                      className="border-input bg-background mt-1 block w-32 rounded-md border px-2 py-1 text-sm"
                      type="number"
                      min="1"
                      max={checkout.remainingRupiah}
                      value={
                        paymentAmounts[checkout.id] ?? checkout.remainingRupiah
                      }
                      onChange={(event) =>
                        setPaymentAmounts((current) => ({
                          ...current,
                          [checkout.id]: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="text-xs">
                    Method
                    <select
                      className="border-input bg-background mt-1 block rounded-md border px-2 py-1 text-sm"
                      value={methods[checkout.id] ?? 'cash'}
                      onChange={(event) =>
                        setMethods((current) => ({
                          ...current,
                          [checkout.id]: event.target
                            .value as Checkout['payments'][number]['method'],
                        }))
                      }
                    >
                      <option value="cash">Cash</option>
                      <option value="qris">QRIS</option>
                      <option value="card">Card</option>
                      <option value="bank_transfer">Bank transfer</option>
                    </select>
                  </label>
                  <label className="text-xs">
                    Reference
                    <input
                      className="border-input bg-background mt-1 block w-36 rounded-md border px-2 py-1 text-sm"
                      value={references[checkout.id] ?? ''}
                      onChange={(event) =>
                        setReferences((current) => ({
                          ...current,
                          [checkout.id]: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <Button
                    size="sm"
                    disabled={saving}
                    onClick={() => void pay(checkout)}
                  >
                    Record payment
                  </Button>
                </div>
              )}
              {checkout.payments.length > 0 && (
                <div className="divide-border divide-y">
                  {checkout.payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                    >
                      <span>
                        {money(payment.amountRupiah)} · {payment.method}
                        {payment.reference
                          ? ` · ${payment.reference}`
                          : ''}{' '}
                        {payment.netAmountRupiah !== payment.amountRupiah && (
                          <span className="text-muted-foreground">
                            (net {money(payment.netAmountRupiah)})
                          </span>
                        )}
                      </span>
                      {user?.role === 'owner' &&
                        payment.netAmountRupiah > 0 && (
                          <span className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={saving}
                              onClick={() =>
                                void correct(
                                  checkout,
                                  payment.id,
                                  'void',
                                  payment.netAmountRupiah,
                                )
                              }
                            >
                              Void
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={saving}
                              onClick={() =>
                                void correct(
                                  checkout,
                                  payment.id,
                                  'refund',
                                  payment.netAmountRupiah,
                                )
                              }
                            >
                              Refund
                            </Button>
                          </span>
                        )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
