import Link from "next/link";
import FormError from "@/components/FormError";
import { money } from "@/lib/calc";
import { formatRange, todayLocal } from "@/lib/dates";
import { listEventNames, listEvents, listEventYears } from "@/lib/db/events";
import { addEvent } from "./actions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined): string =>
  Array.isArray(v) ? (v[0] ?? "") : (v ?? "");

const TYPES = [
  { value: "recurring", label: "Recurring, same name each year" },
  { value: "game", label: "Game weekend, opponent changes" },
  { value: "other", label: "Other" },
];

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default async function EventsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const thisYear = Number(todayLocal().slice(0, 4));

  const yearRaw = Number(one(sp.year));
  const monthRaw = Number(one(sp.month));
  const year = Number.isInteger(yearRaw) && yearRaw > 1900 ? yearRaw : undefined;
  const month = Number.isInteger(monthRaw) && monthRaw >= 1 && monthRaw <= 12 ? monthRaw : undefined;

  const [events, years, names] = await Promise.all([
    listEvents({ year, month }),
    listEventYears(),
    listEventNames(),
  ]);

  const filtered = year !== undefined || month !== undefined;
  const scope = [month !== undefined ? MONTHS[month - 1] : null, year !== undefined ? String(year) : null]
    .filter(Boolean)
    .join(" ");

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <h2 className="mb-3 text-lg font-semibold text-slate-900">
        Events
        <span className="ml-2 text-sm font-normal text-slate-500">
          {events.length}
          {scope ? ` in ${scope}` : ""}
        </span>
      </h2>

      <FormError code={one(sp.error) || undefined} />

      <form
        method="get"
        className="mb-4 grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-4"
      >
        <div>
          <label className="label" htmlFor="year">
            Year
          </label>
          <select id="year" name="year" defaultValue={year ?? ""} className="field">
            <option value="">All years</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="month">
            Month
          </label>
          <select id="month" name="month" defaultValue={month ?? ""} className="field">
            <option value="">All months</option>
            {MONTHS.map((label, i) => (
              <option key={label} value={i + 1}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="col-span-2 flex items-end gap-2 sm:col-span-2">
          <button type="submit" className="btn-primary">
            Filter
          </button>
          {filtered ? (
            <Link href="/events" className="btn-quiet shrink-0 py-3">
              Clear
            </Link>
          ) : null}
        </div>
      </form>

      <ul className="space-y-2">
        {events.map((e) => (
          <li key={e.id}>
            <Link
              href={`/events/${e.id}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm hover:border-slate-300"
            >
              <span className="min-w-0">
                <span className="block font-medium text-slate-900">
                  {e.name} {e.year}
                </span>
                <span className="block text-sm text-slate-500">
                  {formatRange(e.startDate, e.endDate)}
                </span>
              </span>
              {e.suggestedRate !== null ? (
                <span className="shrink-0 tabular-nums font-semibold text-slate-900">
                  {money(e.suggestedRate)}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
        {events.length === 0 ? (
          <li className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-slate-500">
            {filtered
              ? "No events match that filter."
              : "No events yet. Add one below and it becomes selectable on the availability screen."}
          </li>
        ) : null}
      </ul>

      <details className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <summary className="disclosure">Add an event</summary>
        <form action={addEvent} className="mt-3">

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="name">
              Name
              <span className="ml-1.5 text-xs font-normal text-slate-400">
                keep it identical across years so prior pricing matches
              </span>
            </label>
            <input
              id="name"
              name="name"
              className="field"
              placeholder="Double Decker"
              required
              list="event-names"
            />
            <datalist id="event-names">
              {names.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="label" htmlFor="new_year">
              Year
            </label>
            <input
              id="new_year"
              name="year"
              type="number"
              defaultValue={year ?? thisYear}
              className="field"
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="event_type">
              Type
            </label>
            <select id="event_type" name="event_type" className="field">
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
            <input id="start_date" name="start_date" type="date" className="field" required />
          </div>

          <div>
            <label className="label" htmlFor="end_date">
              Check-out
            </label>
            <input id="end_date" name="end_date" type="date" className="field" required />
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
              className="field"
              placeholder="0.00"
            />
          </div>
        </div>

          <button type="submit" className="btn-primary mt-3">
            Add event
          </button>
        </form>
      </details>
    </main>
  );
}
