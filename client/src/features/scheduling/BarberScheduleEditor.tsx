import { useEffect, useState, type FormEvent } from 'react';

import {
  createScheduleException,
  deleteScheduleException,
  getAvailability,
  getBarberSchedule,
  replaceBreaks,
  replaceWorkingHours,
  type Availability,
  type Barber,
  type BarberSchedule,
  type ScheduleExceptionInput,
  type Service,
  type WeeklyRangeInput,
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
const dayNames = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

interface RangeEditorProps {
  label: string;
  ranges: WeeklyRangeInput[];
  onChange: (ranges: WeeklyRangeInput[]) => void;
}

function RangeEditor({ label, ranges, onChange }: RangeEditorProps) {
  function update(index: number, input: Partial<WeeklyRangeInput>) {
    onChange(
      ranges.map((range, rangeIndex) =>
        rangeIndex === index ? { ...range, ...input } : range,
      ),
    );
  }

  return (
    <fieldset className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <legend className="font-medium">{label}</legend>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            onChange([
              ...ranges,
              { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
            ])
          }
        >
          Add range
        </Button>
      </div>
      {ranges.length === 0 ? (
        <p className="text-muted-foreground text-sm">No ranges configured.</p>
      ) : (
        ranges.map((range, index) => (
          <div
            key={`${range.dayOfWeek}-${range.startTime}-${index}`}
            className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
          >
            <label className="text-sm">
              Day
              <select
                className={fieldClass}
                value={range.dayOfWeek}
                onChange={(event) =>
                  update(index, { dayOfWeek: Number(event.target.value) })
                }
              >
                {dayNames.map((day, dayIndex) => (
                  <option key={day} value={dayIndex}>
                    {day}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Start
              <input
                className={fieldClass}
                type="time"
                value={range.startTime}
                onChange={(event) =>
                  update(index, { startTime: event.target.value })
                }
                required
              />
            </label>
            <label className="text-sm">
              End
              <input
                className={fieldClass}
                type="time"
                value={range.endTime}
                onChange={(event) =>
                  update(index, { endTime: event.target.value })
                }
                required
              />
            </label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                onChange(ranges.filter((_, rangeIndex) => rangeIndex !== index))
              }
            >
              Remove
            </Button>
          </div>
        ))
      )}
    </fieldset>
  );
}

interface BarberScheduleEditorProps {
  barber: Barber | null;
  services: Service[];
  onError: (message: string) => void;
  onNotice: (message: string) => void;
}

export function BarberScheduleEditor({
  barber,
  services,
  onError,
  onNotice,
}: BarberScheduleEditorProps) {
  const [schedule, setSchedule] = useState<BarberSchedule | null>(null);
  const [hours, setHours] = useState<WeeklyRangeInput[]>([]);
  const [breaks, setBreaks] = useState<WeeklyRangeInput[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exception, setException] = useState<ScheduleExceptionInput>({
    date: today(),
    kind: 'unavailable',
    startTime: null,
    endTime: null,
    note: '',
  });
  const [previewDate, setPreviewDate] = useState(today());
  const [previewServiceId, setPreviewServiceId] = useState('');
  const [availability, setAvailability] = useState<Availability | null>(null);

  useEffect(() => {
    if (!barber) {
      setSchedule(null);
      setHours([]);
      setBreaks([]);
      return;
    }
    let active = true;
    setLoading(true);
    getBarberSchedule(barber.id)
      .then((response) => {
        if (!active) return;
        setSchedule(response.schedule);
        setHours(
          response.schedule.hours.map(({ dayOfWeek, startTime, endTime }) => ({
            dayOfWeek,
            startTime,
            endTime,
          })),
        );
        setBreaks(
          response.schedule.breaks.map(({ dayOfWeek, startTime, endTime }) => ({
            dayOfWeek,
            startTime,
            endTime,
          })),
        );
      })
      .catch(() => {
        if (active) onError('The barber schedule could not be loaded.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [barber, onError]);

  async function saveHours() {
    if (!barber) return;
    setSaving(true);
    try {
      const response = await replaceWorkingHours(barber.id, hours);
      setSchedule(response.schedule);
      onNotice('Working hours saved.');
    } catch {
      onError('Working hours could not be saved. Check for overlaps.');
    } finally {
      setSaving(false);
    }
  }

  async function saveBreaks() {
    if (!barber) return;
    setSaving(true);
    try {
      const response = await replaceBreaks(barber.id, breaks);
      setSchedule(response.schedule);
      onNotice('Recurring breaks saved.');
    } catch {
      onError('Breaks could not be saved. Check for overlaps.');
    } finally {
      setSaving(false);
    }
  }

  async function addException(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!barber) return;
    setSaving(true);
    try {
      const response = await createScheduleException(barber.id, exception);
      setSchedule((current) =>
        current
          ? {
              ...current,
              exceptions: [...current.exceptions, response.exception],
            }
          : current,
      );
      setException({
        date: exception.date,
        kind: 'unavailable',
        startTime: null,
        endTime: null,
        note: '',
      });
      onNotice('Schedule exception added.');
    } catch {
      onError('The schedule exception could not be added.');
    } finally {
      setSaving(false);
    }
  }

  async function removeException(exceptionId: string) {
    if (!barber) return;
    try {
      await deleteScheduleException(barber.id, exceptionId);
      setSchedule((current) =>
        current
          ? {
              ...current,
              exceptions: current.exceptions.filter(
                (item) => item.id !== exceptionId,
              ),
            }
          : current,
      );
      onNotice('Schedule exception removed.');
    } catch {
      onError('The schedule exception could not be removed.');
    }
  }

  async function preview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!barber || !previewServiceId) return;
    try {
      const response = await getAvailability({
        serviceId: previewServiceId,
        barberId: barber.id,
        date: previewDate,
      });
      setAvailability(response.availability);
    } catch {
      setAvailability(null);
      onError('Availability could not be calculated for that selection.');
    }
  }

  if (!barber)
    return (
      <Card>
        <CardHeader>
          <CardTitle>Schedule and availability</CardTitle>
          <CardDescription>
            Select a barber profile to configure its schedule.
          </CardDescription>
        </CardHeader>
      </Card>
    );

  if (loading)
    return (
      <Card aria-live="polite">
        <CardHeader>
          <CardTitle>{barber.name}&apos;s schedule</CardTitle>
          <CardDescription>Loading schedule…</CardDescription>
        </CardHeader>
      </Card>
    );

  const eligibleServices = services.filter(
    (service) => service.active && barber.serviceIds.includes(service.id),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{barber.name}&apos;s schedule</CardTitle>
        <CardDescription>
          Weekly time, breaks, and dated overrides feed server-side
          availability.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="space-y-3">
          <RangeEditor
            label="Weekly working hours"
            ranges={hours}
            onChange={setHours}
          />
          <Button
            type="button"
            disabled={saving}
            onClick={() => void saveHours()}
          >
            Save working hours
          </Button>
        </div>
        <div className="space-y-3 border-t pt-6">
          <RangeEditor
            label="Recurring breaks"
            ranges={breaks}
            onChange={setBreaks}
          />
          <Button
            type="button"
            disabled={saving}
            onClick={() => void saveBreaks()}
          >
            Save breaks
          </Button>
        </div>
        <form
          className="space-y-4 border-t pt-6"
          onSubmit={(event) => void addException(event)}
        >
          <h3 className="font-medium">Dated exception</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium">
              Date
              <input
                className={fieldClass}
                type="date"
                value={exception.date}
                onChange={(event) =>
                  setException({ ...exception, date: event.target.value })
                }
                required
              />
            </label>
            <label className="text-sm font-medium">
              Type
              <select
                className={fieldClass}
                value={exception.kind}
                onChange={(event) =>
                  setException({
                    ...exception,
                    kind: event.target.value as 'available' | 'unavailable',
                  })
                }
              >
                <option value="unavailable">Unavailable / time off</option>
                <option value="available">Replacement working time</option>
              </select>
            </label>
            <label className="text-sm font-medium">
              Start (blank for whole day)
              <input
                className={fieldClass}
                type="time"
                value={exception.startTime ?? ''}
                onChange={(event) =>
                  setException({
                    ...exception,
                    startTime: event.target.value || null,
                  })
                }
              />
            </label>
            <label className="text-sm font-medium">
              End (blank for whole day)
              <input
                className={fieldClass}
                type="time"
                value={exception.endTime ?? ''}
                onChange={(event) =>
                  setException({
                    ...exception,
                    endTime: event.target.value || null,
                  })
                }
              />
            </label>
            <label className="text-sm font-medium sm:col-span-2">
              Note
              <input
                className={fieldClass}
                value={exception.note}
                onChange={(event) =>
                  setException({ ...exception, note: event.target.value })
                }
              />
            </label>
          </div>
          <Button type="submit" disabled={saving}>
            Add exception
          </Button>
          {schedule?.exceptions.length ? (
            <div className="divide-border divide-y">
              {schedule.exceptions.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 py-3 text-sm"
                >
                  <span>
                    {item.date} · {item.kind}{' '}
                    {item.startTime && item.endTime
                      ? `${item.startTime}–${item.endTime}`
                      : 'all day'}
                    {item.note ? ` · ${item.note}` : ''}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void removeException(item.id)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No dated exceptions.
            </p>
          )}
        </form>
        <form
          className="space-y-4 border-t pt-6"
          onSubmit={(event) => void preview(event)}
        >
          <h3 className="font-medium">Availability preview</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium">
              Eligible service
              <select
                className={fieldClass}
                value={previewServiceId}
                onChange={(event) => setPreviewServiceId(event.target.value)}
                required
              >
                <option value="">Select a service</option>
                {eligibleServices.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              Date
              <input
                className={fieldClass}
                type="date"
                value={previewDate}
                onChange={(event) => setPreviewDate(event.target.value)}
                required
              />
            </label>
          </div>
          <Button type="submit">Calculate slots</Button>
          {availability && (
            <div aria-live="polite">
              <p className="text-muted-foreground text-sm">
                {availability.slots.length} slot(s) in {availability.timezone}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {availability.slots.map((slot) => (
                  <span
                    key={`${slot.barberId}-${slot.startAt}`}
                    className="rounded-md border px-2 py-1 text-sm"
                  >
                    {new Intl.DateTimeFormat('en-GB', {
                      timeZone: availability.timezone,
                      hour: '2-digit',
                      minute: '2-digit',
                    }).format(new Date(slot.startAt))}
                  </span>
                ))}
              </div>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
