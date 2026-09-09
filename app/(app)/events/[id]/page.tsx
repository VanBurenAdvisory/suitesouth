import Link from "next/link";
import FormError from "@/components/FormError";
import { notFound } from "next/navigation";
import { money } from "@/lib/calc";
import { daysBetween } from "@/lib/dates";
import { getEvent, listEventPropertyRates } from "@/lib/db/events";
import { listProperties } from "@/lib/db/properties";
import { removeEvent, savePropertyRate, saveEvent } from "../actions";

export const dynamic = "force-dynamic";

const TYPES = [
  { value: "recurring", label: "Recurring, same name each year" },
  { value: "game", label: "Game weekend, opponent changes" },
  { value: "other", label: "Other" },
];

export default async function EventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const errorCode = Array.isArray(sp.error) ? sp.error[0] : sp.error;
  const [event, rates, properties] = await Promise.all([
    getEvent(id),
    listEventPropertyRates(id),
    listProperties(),
  ]);

  if (!event) notFound();

  const nights = daysBetween(event.startDate, event.endDate);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <Link href="/events" className="text-sm text-slate-500 hover:underline">
        Back to events
      </Link>

      <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
        {event.name} {event.year}
      </h2>

      <div className="mt-4">
        <FormError code={errorCode} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <form action={saveEvent} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <input type="hidden" name="id" value={event.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="name">
                Name
              </label>
              <input id="name" name="name" defaultValue={event.name} className="field" required />
            </div>
            <div>
              <label className="label" htmlFor="year">
                Year
              </label>
              <input
                id="year"
                name="year"
                type="number"
                defaultValue={event.year}
                className="field"
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="event_type">
                Type
              </label>
              <select
                id="event_type"
                name="event_type"
                defaultValue={event.eventType}
                className="field"
              >
                {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="start_date">
                Check-in
              </label>
              <input
                id="start_date"
                name="start_date"
                type="date"
                defaultValue={event.startDate}
                className="field"
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="end_date">
                Check-out
              </label>
              <input
                id="end_date"
                name="end_date"
                type="date"
                defaultValue={event.endDate}
                className="field"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="suggested_rate">
                Suggested rate
                <span className="ml-1.5 text-xs font-normal text-slate-400">
                  flat, for the whole stay
                </span>
              </label>
              <input
                id="suggested_rate"
                name="suggested_rate"
                inputMode="decimal"
                defaultValue={event.suggestedRate ?? ""}
                className="field"
              />
              {event.suggestedNightlyRate !== null ? (
                <p className="mt-1.5 text-xs text-slate-500">
                  {money(event.suggestedNightlyRate)} per night over {nights}
                </p>
              ) : null}
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="notes">
                Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={2}
                defaultValue={event.notes ?? ""}
                className="field"
              />
            </div>
          </div>
          <button type="submit" className="btn-primary mt-3">
            Save event
          </button>
        </form>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Rate by condo
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Leave blank to use the event rate
            {event.suggestedRate !== null ? ` of ${money(event.suggestedRate)}` : ""}.
          </p>

          <div className="mt-3 space-y-3">
            {properties.map((p) => {
              const override = rates.find((r) => r.propertyId === p.id);
              return (
                <form key={p.id} action={savePropertyRate} className="flex items-end gap-2">
                  <input type="hidden" name="event_id" value={event.id} />
                  <input type="hidden" name="property_id" value={p.id} />
                  <div className="min-w-0 flex-1">
                    <label className="label" htmlFor={`rate-${p.id}`}>
                      {p.name}
                    </label>
                    <input
                      id={`rate-${p.id}`}
                      name="suggested_rate"
                      inputMode="decimal"
                      defaultValue={override?.suggestedRate ?? ""}
                      placeholder={event.suggestedRate !== null ? String(event.suggestedRate) : "0.00"}
                      className="field"
                    />
                  </div>
                  <button type="submit" className="btn-quiet shrink-0 py-3">
                    Save
                  </button>
                </form>
              );
            })}
          </div>
        </section>
      </div>

      <form action={removeEvent} className="mt-6">
        <input type="hidden" name="id" value={event.id} />
        <button
          type="submit"
          className="text-sm text-slate-400 hover:text-red-600 hover:underline"
        >
          Delete this event
        </button>
      </form>
    </main>
  );
}
