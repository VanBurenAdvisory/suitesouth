import Link from "next/link";
import CalendarMonth, { type CalendarEntry } from "@/components/CalendarMonth";
import { calendarDays } from "@/lib/availability";
import { addDays, eachDay, todayLocal } from "@/lib/dates";
import { listEvents } from "@/lib/db/events";
import { listProperties } from "@/lib/db/properties";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined): string =>
  Array.isArray(v) ? (v[0] ?? "") : (v ?? "");

const MONTH_RE = /^\d{4}-\d{2}$/;

function monthBounds(month: string) {
  const first = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { first, last: `${month}-${String(lastDay).padStart(2, "0")}` };
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function CalendarPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const monthParam = one(sp.month);
  const month = MONTH_RE.test(monthParam) ? monthParam : todayLocal().slice(0, 7);
  const propertyFilter = one(sp.property);

  const { first, last } = monthBounds(month);

  // Pad out to whole weeks so the grid always starts on a Sunday.
  const leading = new Date(`${first}T00:00:00Z`).getUTCDay();
  const gridStart = addDays(first, -leading);
  const trailing = 6 - new Date(`${last}T00:00:00Z`).getUTCDay();
  const gridEnd = addDays(last, trailing);

  const [properties, events, byProperty] = await Promise.all([
    listProperties(),
    listEvents(),
    calendarDays(gridStart, gridEnd),
  ]);

  const entries: CalendarEntry[] = [];
  for (const [propertyId, days] of byProperty) {
    for (const day of days) entries.push({ ...day, propertyId });
  }

  const eventDays: Record<string, string> = {};
  for (const e of events) {
    if (e.endDate < gridStart || e.startDate > gridEnd) continue;
    for (const date of eachDay(
      e.startDate < gridStart ? gridStart : e.startDate,
      e.endDate > gridEnd ? gridEnd : e.endDate,
    )) {
      eventDays[date] = e.name;
    }
  }

  const label = new Date(`${first}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const qs = (m: string) => `/calendar?month=${m}${propertyFilter ? `&property=${propertyFilter}` : ""}`;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-3 flex items-center justify-between gap-3">
        <Link href={qs(shiftMonth(month, -1))} className="btn-quiet">
          Prev
        </Link>
        <h2 className="text-lg font-semibold text-slate-900">{label}</h2>
        <Link href={qs(shiftMonth(month, 1))} className="btn-quiet">
          Next
        </Link>
      </div>

      {/* One condo at a time is far more readable on a phone. */}
      <div className="mb-3 flex gap-1 overflow-x-auto">
        <Link
          href={`/calendar?month=${month}`}
          className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium ${
            propertyFilter ? "text-slate-600 hover:bg-slate-100" : "bg-slate-900 text-white"
          }`}
        >
          All condos
        </Link>
        {properties.map((p) => (
          <Link
            key={p.id}
            href={`/calendar?month=${month}&property=${p.id}`}
            className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium ${
              propertyFilter === p.id
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {p.name}
          </Link>
        ))}
      </div>

      <CalendarMonth
        grid={eachDay(gridStart, gridEnd)}
        month={month}
        properties={properties.map((p) => ({ id: p.id, name: p.name }))}
        entries={entries}
        eventDays={eventDays}
        propertyFilter={propertyFilter}
      />
    </main>
  );
}
