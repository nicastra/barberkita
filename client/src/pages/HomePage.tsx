import { CalendarDays, ChevronRight, Sparkles } from 'lucide-react';

import { PageHeader } from '@/components/shared/PageHeader';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const upcomingCapabilities = [
  'Secure staff access and shop setup',
  'Services, schedules, and bookings',
  'Daily operations and checkout',
];

export function HomePage() {
  return (
    <div className="space-y-10">
      <PageHeader />
      <Card className="border-primary/15 bg-primary text-primary-foreground shadow-primary/10 overflow-hidden shadow-lg">
        <CardHeader>
          <div className="text-primary-foreground/75 flex items-center gap-2">
            <Sparkles className="size-4" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-widest">
              Foundation in place
            </span>
          </div>
          <CardTitle className="text-2xl">
            Ready for the first shop workflow.
          </CardTitle>
          <CardDescription className="text-primary-foreground/70">
            The client, API, database migrations, and quality checks now share
            one Bun workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            {['React + Vite', 'Hono + Zod', 'Drizzle + PostgreSQL'].map(
              (technology) => (
                <div
                  key={technology}
                  className="bg-white/8 rounded-xl border border-white/10 px-4 py-3 text-sm font-medium"
                >
                  {technology}
                </div>
              ),
            )}
          </div>
        </CardContent>
      </Card>
      <section aria-labelledby="upcoming-heading" className="space-y-4">
        <div className="flex items-center gap-3">
          <CalendarDays
            className="text-muted-foreground size-5"
            aria-hidden="true"
          />
          <h2 id="upcoming-heading" className="font-semibold">
            Coming next
          </h2>
        </div>
        <div className="grid gap-3">
          {upcomingCapabilities.map((capability, index) => (
            <div
              key={capability}
              className="border-border bg-card flex items-center justify-between rounded-xl border px-4 py-3.5"
            >
              <div className="flex items-center gap-3">
                <span className="bg-muted text-muted-foreground grid size-7 place-items-center rounded-full text-xs font-semibold">
                  {index + 1}
                </span>
                <span className="text-sm font-medium">{capability}</span>
              </div>
              <ChevronRight
                className="text-muted-foreground size-4"
                aria-hidden="true"
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
