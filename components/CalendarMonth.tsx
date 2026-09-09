"use client";

import { useState } from "react";
import Link from "next/link";
import { STATE_LABELS, STATE_STYLES, type DerivedState } from "@/lib/booking-state";
import { formatDate } from "@/lib/dates";

export type CalendarEntry = {
  date: string;
  propertyId: string;
  bookingId: string;
  state: DerivedState;
  customerName: string;
  isTurnaround: boolean;
};

type Props = {
  /** Every date shown in the grid, including the leading and trailing padding days. */
  grid: string[];
  month: string;
  properties: { id: string; name: string }[];
  entries: CalendarEntry[];
  eventDays: Record<string, string>;
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
  const [selected, setSelected] = useState<string | null>(null);

  const shown = propertyFilter
    ? properties.filter((p) => p.id === propertyFilter)
    : properties;

  const byDate = new Map<string, CalendarEntry[]>();
  for (const entry of entries) {
    if (propertyFilter && entry.propertyId !== propertyFilter) continue;
    const list = byDate.get(entry.date) ?? [];
    list.push(entry);
    byDate.set(entry.date, list);
  }

  const selectedEntries = selected ? (byDate.get(selected) ?? []) : [];

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
          const eventName = eventDays[date];
          const isSelected = selected === date;

          return (
            <button
              key={date}
              type="button"
              onClick={() => setSelected(isSelected ? null : date)}
              className={`min-h-[62px] p-1 text-left align-top transition sm:min-h-[86px] sm:p-2 ${
                isSelected ? "bg-slate-100" : eventName ? "bg-sky-50" : "bg-white"
              } ${inMonth ? "" : "opacity-40"}`}
            >
              <span
                className={`text-xs ${inMonth ? "font-medium text-slate-700" : "text-slate-400"}`}
              >
                {Number(date.slice(8, 10))}
              </span>

              {eventName ? (
                <span className="mt-0.5 hidden truncate text-[10px] leading-tight text-sky-700 sm:block">
                  {eventName}
                </span>
              ) : null}

              <span className="mt-1 flex flex-col gap-0.5">
                {shown.map((p) => {
                  const entry = dayEntries.find((e) => e.propertyId === p.id);
                  if (!entry) return <span key={p.id} className="h-1.5 rounded-sm bg-transparent" />;
                  return (
                    <span
                      key={p.id}
                      title={`${p.name}: ${entry.customerName}`}
                      className={`h-1.5 rounded-sm ${STATE_STYLES[entry.state].bar} ${
                        entry.isTurnaround ? "opacity-40" : ""
                      }`}
                    />
                  );
                })}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
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

      {selected ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">{formatDate(selected)}</p>
          {eventDays[selected] ? (
            <p className="text-sm text-sky-700">{eventDays[selected]}</p>
          ) : null}

          {selectedEntries.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">All condos open.</p>
          ) : (
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
          )}
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">Tap a day to see what is on it.</p>
      )}
    </div>
  );
}
