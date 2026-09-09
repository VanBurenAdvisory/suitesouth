"use client";

import { useState } from "react";
import Link from "next/link";
import { STATE_LABELS, STATE_STYLES, type DerivedState } from "@/lib/booking-state";
import { addDays, daysBetween, formatDate, formatRange } from "@/lib/dates";

export type CalendarEntry = {
  date: string;
  propertyId: string;
  bookingId: string;
  state: DerivedState;
  customerName: string;
  isTurnaround: boolean;
};

export type CalendarProperty = { id: string; name: string; initial: string };
export type CalendarEvent = { id: string; name: string };

type Props = {
  /** Every date in the grid, including the leading and trailing padding days. */
  grid: string[];
  month: string;
  properties: CalendarProperty[];
  entries: CalendarEntry[];
  eventDays: Record<string, CalendarEvent>;
  propertyFilter: string;
};

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export default function CalendarMonth({
  grid,
  month,
  properties,
  entries,
  eventDays,
  propertyFilter,
}: Props) {
  // First tap picks a day, a later tap extends it into a range.
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);

  const shown = propertyFilter ? properties.filter((p) => p.id === propertyFilter) : properties;

  const byDate = new Map<string, CalendarEntry[]>();
  for (const entry of entries) {
    if (propertyFilter && entry.propertyId !== propertyFilter) continue;
    const list = byDate.get(entry.date) ?? [];
    list.push(entry);
    byDate.set(entry.date, list);
  }

  function handleDay(date: string) {
    if (!start || end) {
      setStart(date);
      setEnd(null);
    } else if (date === start) {
      setStart(null);
    } else if (date < start) {
      setStart(date);
    } else {
      setEnd(date);
    }
  }

  const rangeEnd = end ?? start;
  const inRange = (d: string) => Boolean(start && rangeEnd && d >= start && d <= rangeEnd);

  // Selected boxes are nights, so check-out is the morning after the last one.
  const checkIn = start ?? "";
  const checkOut = rangeEnd ? addDays(rangeEnd, 1) : "";
  const nights = start && rangeEnd ? daysBetween(start, checkOut) : 0;
  const logHref = `/?from=${checkIn}&to=${checkOut}${propertyFilter ? `&property=${propertyFilter}` : ""}`;

  const selectedEntries = start ? (byDate.get(start) ?? []) : [];
  const selectedEvent = start ? eventDays[start] : undefined;

  return (
    <div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200">
        {WEEKDAYS.map((d, i) => (
          <div
            key={`${d}-${i}`}
            className="bg-slate-50 py-2 text-center text-xs font-semibold text-slate-500"
          >
            {d}
          </div>
        ))}

        {grid.map((date) => {
          const inMonth = date.slice(0, 7) === month;
          const dayEntries = byDate.get(date) ?? [];
          const event = eventDays[date];
          const selected = inRange(date);

          return (
            <button
              key={date}
              type="button"
              onClick={() => handleDay(date)}
              className={`min-h-[78px] p-1 text-left align-top transition sm:min-h-[104px] sm:p-2 ${
                selected
                  ? "bg-slate-900/10 ring-1 ring-inset ring-slate-900"
                  : event
                    ? "bg-sky-50"
                    : "bg-white"
              } ${inMonth ? "" : "opacity-40"}`}
            >
              <span
                className={`text-xs ${inMonth ? "font-medium text-slate-700" : "text-slate-400"}`}
              >
                {Number(date.slice(8, 10))}
              </span>

              {event ? (
                <span className="mt-0.5 hidden truncate text-[10px] leading-tight text-sky-700 sm:block">
                  {event.name}
                </span>
              ) : null}

              {/* Fixed slots, one per condo, so a bar's row always means the same unit. */}
              <span className="mt-1 flex flex-col gap-0.5">
                {shown.map((p) => {
                  const entry = dayEntries.find((e) => e.propertyId === p.id);
                  if (!entry) {
                    return <span key={p.id} className="h-3.5 rounded-sm border border-dashed border-slate-200" />;
                  }
                  const style = STATE_STYLES[entry.state];
                  return (
                    <span
                      key={p.id}
                      title={`${p.name}: ${entry.customerName}${entry.isTurnaround ? " (turnaround)" : ""}`}
                      className={`flex h-3.5 items-center gap-1 overflow-hidden rounded-sm px-1 text-[9px] font-bold leading-none ${style.bar} ${style.text} ${
                        entry.isTurnaround ? "opacity-40" : ""
                      }`}
                    >
                      <span>{p.initial}</span>
                      <span className="hidden truncate font-medium sm:inline">
                        {entry.customerName}
                      </span>
                    </span>
                  );
                })}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
        {shown.map((p) => (
          <span key={p.id} className="inline-flex items-center gap-1.5">
            <span className="inline-flex size-4 items-center justify-center rounded-sm bg-slate-200 text-[9px] font-bold text-slate-700">
              {p.initial}
            </span>
            {p.name}
          </span>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
        {(["hold", "committed", "booked", "confirmed"] as DerivedState[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-4 rounded-sm ${STATE_STYLES[s].bar}`} />
            {STATE_LABELS[s]}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-sm bg-slate-400 opacity-40" />
          Turnaround
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-sm bg-sky-100" />
          Event
        </span>
      </div>

      {start ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {end ? formatRange(start, rangeEnd as string) : formatDate(start)}
              </p>
              {selectedEvent ? (
                <Link
                  href={`/events/${selectedEvent.id}`}
                  className="text-sm text-sky-700 hover:underline"
                >
                  {selectedEvent.name}
                </Link>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => {
                setStart(null);
                setEnd(null);
              }}
              className="btn-quiet shrink-0"
            >
              Clear
            </button>
          </div>

          {selectedEntries.length === 0 && !end ? (
            <p className="mt-2 text-sm text-slate-500">All condos open.</p>
          ) : null}

          {!end && selectedEntries.length > 0 ? (
            <ul className="mt-2 divide-y divide-slate-100">
              {selectedEntries.map((entry) => {
                const property = properties.find((p) => p.id === entry.propertyId);
                return (
                  <li key={`${entry.propertyId}-${entry.bookingId}`} className="py-2">
                    <Link href={`/stays/${entry.bookingId}`} className="hover:underline">
                      <span className="font-medium text-slate-900">{property?.name}</span>
                      <span className="ml-2 text-slate-600">{entry.customerName}</span>
                      <span className="ml-2 text-xs text-slate-400">
                        {entry.isTurnaround ? "Turnaround" : STATE_LABELS[entry.state]}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : null}

          <div className="mt-3 border-t border-slate-100 pt-3">
            <Link href={logHref} className="btn-primary inline-block text-center">
              Log a stay, {nights} {nights === 1 ? "night" : "nights"}
            </Link>
            <p className="mt-1.5 text-xs text-slate-500">
              Check in {formatDate(checkIn)}, check out {formatDate(checkOut)}.
              {end ? "" : " Tap a later day to extend."}
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">
          Tap a day to see what is on it. Tap a second day to select a range and log a stay.
        </p>
      )}
    </div>
  );
}
