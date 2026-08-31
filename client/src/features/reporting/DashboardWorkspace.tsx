import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, CalendarDays, RefreshCw, Users } from 'lucide-react';

import { ApiError } from '@/api/client';
import {
  getDashboard,
  getPerformanceReport,
  getRevenueReport,
  type Dashboard,
  type PerformanceReport,
  type RevenueReport,
} from '@/api/reporting';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const currency = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});
const statusLabels: Record<string, string> = {
  initial: 'Initial',
  confirmed: 'Confirmed',
  rescheduled: 'Rescheduled',
  checked_in: 'Checked in',
  in_service: 'In service',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No-show',
};

function today(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function PerformanceTable({
  title,
  rows,
}: {
  title: string;
  rows: PerformanceReport['staff'];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          Bookings, completed services, and net payment revenue attributed to
          the same appointments.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No activity in this range.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{title} report</caption>
              <thead className="text-muted-foreground border-b">
                <tr>
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Booked</th>
                  <th className="px-3 py-2 font-medium">Completed</th>
                  <th className="py-2 pl-3 text-right font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-border border-b last:border-0"
                  >
                    <td className="py-3 pr-4 font-medium">{row.name}</td>
                    <td className="px-3 py-3">{row.bookingCount}</td>
                    <td className="px-3 py-3">{row.completionCount}</td>
                    <td className="py-3 pl-3 text-right">
                      {currency.format(row.attributedRevenueRupiah)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardWorkspace() {
  const [date, setDate] = useState(today);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [revenue, setRevenue] = useState<RevenueReport | null>(null);
  const [performance, setPerformance] = useState<PerformanceReport | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void Promise.allSettled([
      getDashboard(date, controller.signal),
      getRevenueReport(from, to, controller.signal),
      getPerformanceReport(from, to, controller.signal),
    ]).then(([dashboardResult, revenueResult, performanceResult]) => {
      if (controller.signal.aborted) return;
      if (dashboardResult.status === 'fulfilled')
        setDashboard(dashboardResult.value);
      else setDashboard(null);
      if (revenueResult.status === 'fulfilled') setRevenue(revenueResult.value);
      else setRevenue(null);
      if (performanceResult.status === 'fulfilled')
        setPerformance(performanceResult.value);
      else setPerformance(null);
      const failure = [dashboardResult, revenueResult, performanceResult].find(
        (result) => result.status === 'rejected',
      );
      if (failure?.status === 'rejected') {
        const reason = failure.reason;
        setError(
          reason instanceof ApiError && reason.status === 403
            ? 'You do not have permission to view these reports.'
            : 'Some reporting data could not be loaded. Available sections remain visible.',
        );
      }
      setLoading(false);
    });
    return () => controller.abort();
  }, [date, from, to, version]);

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Badge variant="outline">Phase 6 · Reporting</Badge>
        <h1 className="text-3xl font-semibold tracking-tight">
          Dashboard and reports
        </h1>
        <p className="text-muted-foreground">
          Operational workload and corrected payment revenue, interpreted in the
          shop timezone.
        </p>
      </div>
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-end">
          <label className="grid flex-1 gap-1.5 text-sm font-medium">
            Operational day
            <input
              className="border-input bg-background h-10 rounded-md border px-3"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
          <label className="grid flex-1 gap-1.5 text-sm font-medium">
            Report from
            <input
              className="border-input bg-background h-10 rounded-md border px-3"
              type="date"
              value={from}
              max={to}
              onChange={(event) => setFrom(event.target.value)}
            />
          </label>
          <label className="grid flex-1 gap-1.5 text-sm font-medium">
            Report to
            <input
              className="border-input bg-background h-10 rounded-md border px-3"
              type="date"
              value={to}
              min={from}
              onChange={(event) => setTo(event.target.value)}
            />
          </label>
          <Button
            variant="outline"
            onClick={() => setVersion((value) => value + 1)}
            disabled={loading}
          >
            <RefreshCw className="size-4" />
            Refresh
          </Button>
        </CardContent>
      </Card>
      {loading && (
        <Card role="status" aria-live="polite">
          <CardContent className="text-muted-foreground pt-6 text-sm">
            Loading dashboard and reports…
          </CardContent>
        </Card>
      )}
      {error && (
        <Card className="border-amber-300" role="alert">
          <CardContent className="pt-6 text-sm text-amber-800">
            {error}
          </CardContent>
        </Card>
      )}
      {dashboard && (
        <>
          <section
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
            aria-label="Daily totals"
          >
            {[
              ['Appointments', dashboard.totals.appointments],
              ['Upcoming', dashboard.totals.upcoming],
              ['Queue', dashboard.totals.queue],
              ['Completed', dashboard.totals.completed],
              [
                'Cancelled / no-show',
                dashboard.totals.cancelled + dashboard.totals.noShow,
              ],
            ].map(([label, value]) => (
              <Card key={String(label)}>
                <CardContent className="pt-6">
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    {label}
                  </p>
                  <p className="mt-2 text-3xl font-semibold">{value}</p>
                </CardContent>
              </Card>
            ))}
          </section>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="size-5" />
                Appointments
              </CardTitle>
              <CardDescription>
                {dashboard.date} in {dashboard.timezone}. Select an appointment
                in the Appointments workspace for full details and actions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dashboard.appointments.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No appointments are scheduled for this day.
                </p>
              ) : (
                <div className="grid gap-3">
                  {dashboard.appointments.map((appointment) => (
                    <Link
                      to={`/bookings?date=${dashboard.date}`}
                      key={appointment.id}
                      className="border-border hover:bg-muted/50 flex flex-col justify-between gap-3 rounded-xl border p-4 transition-colors sm:flex-row sm:items-center"
                    >
                      <div>
                        <p className="font-medium">
                          {appointment.customer.name} ·{' '}
                          {appointment.service.name}
                        </p>
                        <p className="text-muted-foreground text-sm">
                          {new Intl.DateTimeFormat('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: dashboard.timezone,
                          }).format(new Date(appointment.startAt))}{' '}
                          · {appointment.barber.name} ·{' '}
                          {appointment.confirmationCode}
                        </p>
                      </div>
                      <Badge
                        variant={
                          appointment.status === 'completed'
                            ? 'success'
                            : 'outline'
                        }
                      >
                        {statusLabels[appointment.status] ?? appointment.status}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
      {revenue && (
        <section
          className="grid gap-3 sm:grid-cols-3"
          aria-label="Revenue summary"
        >
          <Card>
            <CardContent className="pt-6">
              <BarChart3 className="text-muted-foreground size-5" />
              <p className="text-muted-foreground mt-3 text-sm">Net revenue</p>
              <p className="mt-1 text-2xl font-semibold">
                {currency.format(revenue.netRupiah)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-sm">Gross payments</p>
              <p className="mt-1 text-2xl font-semibold">
                {currency.format(revenue.grossRupiah)}
              </p>
              <p className="text-muted-foreground mt-2 text-xs">
                {revenue.paymentCount} payments across{' '}
                {revenue.transactionCount} transactions
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-sm">Corrections</p>
              <p className="mt-1 text-2xl font-semibold">
                {currency.format(revenue.correctionsRupiah)}
              </p>
              <p className="text-muted-foreground mt-2 text-xs">
                Refunds and voids are subtracted once.
              </p>
            </CardContent>
          </Card>
        </section>
      )}
      {performance && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Users className="text-muted-foreground size-5" />
            <h2 className="text-xl font-semibold">Performance</h2>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <PerformanceTable
              title="Staff performance"
              rows={performance.staff}
            />
            <PerformanceTable
              title="Service performance"
              rows={performance.services}
            />
          </div>
        </section>
      )}
      {!loading && !dashboard && !revenue && !performance && !error && (
        <Card>
          <CardContent className="text-muted-foreground pt-6 text-sm">
            No reporting data is available.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
