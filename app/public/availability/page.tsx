import type { Metadata } from "next";
import { availabilityByDay } from "@/lib/availability";
import { addDays, eachDay, formatDate, isValidDate, todayLocal } from "@/lib/dates";
import { listEvents } from "@/lib/db/events";

export const dynamic = "force-dynamic";

// Shareable by link, but not something to surface in search results.
export const metadata: Metadata = {
  title: "Suite South Availability",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined): string =>
  Array.isArray(v) ? (v[0] ?? "") : (v ?? "");

export default async function PublicAvailabilityPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const today = todayLocal();

  const events = await listEvents();
  const eventId = one(sp.event);
  const event = events.find((e) => e.id === eventId && e.endDate >= today) ?? null;

  const rawFrom = one(sp.from);
  const rawTo = one(sp.to);
  const from = event?.startDate ?? (isValidDate(rawFrom) ? rawFrom : today);
  const cap = addDays(from, 60);
  const requested = event?.endDate ?? (isValidDate(rawTo) && rawTo >= from ? rawTo : addDays(from, 13));
  const through = requested > cap ? cap : requested;

  // Only ever holds {property, date, available}.
  const days = await availabilityByDay(from, through);
  const properties = [...new Set(days.map((d) => d.property))];
  const dates = eachDay(from, through);

  const lookup = new Map(days.map((d) => [`${d.property}|${d.date}`, d.available]));
  const upcoming = events.filter((e) => e.endDate >= today).slice(0, 12);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Suite South</h1>
      <p className="mt-1 text-slate-600">Availability</p>

      <div className="mt-4 space-y-3">
        {upcoming.length > 0 ? (
          <form method="get" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <label className="label" htmlFor="event">
              Event
            </label>
            <div className="flex gap-2">
              <select id="event" name="event" defaultValue={eventId} className="field">
                <option value="">Choose an event</option>
                {upcoming.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} {e.year}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn-primary w-auto shrink-0 px-6">
                Show
              </button>
            </div>
          </form>
        ) : null}

        <form method="get" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="from">
                From
              </label>
              <input id="from" name="from" type="date" defaultValue={from} className="field" />
            </div>
            <div>
              <label className="label" htmlFor="to">
                To
              </label>
              <input id="to" name="to" type="date" defaultValue={through} className="field" />
            </div>
          </div>
          <button type="submit" className="btn-primary mt-3">
            Show these dates
          </button>
        </form>
      </div>

      <div className="mt-6 space-y-4">
        {properties.map((property) => (
          <section
            key={property}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <h2 className="font-semibold text-slate-900">{property}</h2>
            <ul className="mt-2 divide-y divide-slate-100">
              {dates.map((date) => {
                const available = lookup.get(`${property}|${date}`) ?? false;
                return (
                  <li key={date} className="flex items-center justify-between gap-3 py-1.5">
                    <span className="text-sm text-slate-600">{formatDate(date)}</span>
                    <span
                      className={`text-sm font-medium ${
                        available ? "text-emerald-700" : "text-slate-400"
                      }`}
                    >
                      {available ? "Available" : "Blocked"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-6 text-xs text-slate-400">
        Availability shown is a guide. Contact us to confirm and reserve.
      </p>
    </main>
  );
}
