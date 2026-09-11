import DateRangeForm from "@/components/DateRangeForm";
import EventSelectForm from "@/components/EventSelectForm";
import { checkAvailability } from "@/lib/availability";
import { money } from "@/lib/calc";
import { addDays, formatRange, isValidDate, todayLocal } from "@/lib/dates";
import { STATE_LABELS } from "@/lib/booking-state";
import { getEvent, listUpcomingEvents, priorYearPrices } from "@/lib/db/events";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const one = (v: string | string[] | undefined): string =>
  Array.isArray(v) ? (v[0] ?? "") : (v ?? "");

export default async function AvailabilityPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const today = todayLocal();

  const eventId = one(sp.event);
  const event = eventId ? await getEvent(eventId) : null;

  const rawFrom = one(sp.from);
  const rawTo = one(sp.to);
  const checkIn = event?.startDate ?? (isValidDate(rawFrom) ? rawFrom : today);
  const checkOut =
    event?.endDate ?? (isValidDate(rawTo) && rawTo > checkIn ? rawTo : addDays(checkIn, 2));

  const [events, priors] = await Promise.all([
    listUpcomingEvents(today),
    event ? priorYearPrices(event.name, event.year) : Promise.resolve([]),
  ]);

  const results = await checkAvailability({ checkIn, checkOut, event, priorYears: priors });
  const openCount = results.filter((r) => r.available).length;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="space-y-2">
        {events.length > 0 ? (
          <EventSelectForm
            events={events.map((e) => ({ id: e.id, name: e.name, year: e.year }))}
            selectedId={eventId}
          />
        ) : null}

        {/* Keyed so a new event's dates land in the inputs, not the previous ones. */}
        <DateRangeForm key={`${checkIn}-${checkOut}`} checkIn={checkIn} checkOut={checkOut} />
      </div>

      <div className="mt-4">
        <p className="text-sm text-slate-500">
          {formatRange(checkIn, checkOut)}
          {event ? (
            <span className="ml-1.5 font-medium text-slate-700">
              {event.name} {event.year}
            </span>
          ) : null}
        </p>
        <p className="mt-0.5 text-xl font-bold tracking-tight text-slate-900">
          {openCount} of {results.length} open
        </p>
      </div>

      <ul className="mt-3 space-y-2">
        {results.map(({ property, available, conflicts, suggestedRate, rateSource, priorYears }) => (
          <li key={property.id} className={`rounded-2xl border p-3 shadow-sm ${
            available
              ? "border-emerald-200 bg-emerald-50"
              : conflicts.some((c) => c.state === "confirmed")
                ? "border-red-200 bg-red-50"
                : "border-yellow-200 bg-yellow-50"
          }`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <p className="truncate text-base font-bold text-slate-900">{property.name}</p>
                <p className={`shrink-0 text-sm font-semibold ${
                  available
                    ? "text-emerald-700"
                    : conflicts.some((c) => c.state === "confirmed")
                      ? "text-red-700"
                      : "text-yellow-800"
                }`}>
                  {available
                    ? "Available"
                    : conflicts.some((c) => c.state === "confirmed")
                      ? "Confirmed"
                      : conflicts[0]?.state === "hold"
                        ? "Hold"
                        : "Blocked"}
                </p>
              </div>

              {available && suggestedRate !== null ? (
                <div className="shrink-0 text-right">
                  <p className="text-xl font-bold tabular-nums text-slate-900">
                    {money(suggestedRate)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {rateSource === "property" ? "this condo" : "event rate"}
                  </p>
                </div>
              ) : null}
            </div>

            {!available ? (
              <ul className="mt-2 space-y-1 border-t border-slate-200/70 pt-2 text-sm text-slate-600">
                {conflicts.map((c) => (
                  <li key={c.bookingId}>
                    {c.customerName}, {formatRange(c.checkIn, c.checkOut)}
                    <span className="ml-1.5 text-slate-400">{STATE_LABELS[c.state]}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            {priorYears.length > 0 ? (
              <div className="mt-2 border-t border-slate-200/70 pt-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Charged before
                </p>
                <ul className="mt-1 space-y-0.5 text-sm text-slate-600">
                  {priorYears.map((p) => (
                    <li key={`${p.year}-${p.subtotal}`}>
                      {p.year}: <span className="font-medium">{money(p.subtotal)}</span>
                      <span className="ml-1.5 text-slate-400">
                        {money(p.nightlyRate)}/night over {p.nights}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </main>
  );
}
