import Link from "next/link";
import { money } from "@/lib/calc";
import { formatDate } from "@/lib/dates";
import { deriveState, isStaleHold } from "@/lib/booking-state";
import { todayLocal } from "@/lib/dates";
import type { Booking } from "@/lib/types";
import StateChip from "./StateChip";

type Props = {
  bookings: Booking[];
  requireSignatureForBooked: boolean;
  emptyMessage?: string;
};

function Stay({ booking }: { booking: Booking }) {
  return (
    <>
      {formatDate(booking.checkIn)} to {formatDate(booking.checkOut)}
      <span className="ml-1.5 text-slate-400">
        {booking.nights}
        {booking.nights === 1 ? " night" : " nights"}
      </span>
    </>
  );
}

export default function BookingsTable({
  bookings,
  requireSignatureForBooked,
  emptyMessage = "No stays logged yet. The first one will appear here.",
}: Props) {
  if (bookings.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-slate-500">
        {emptyMessage}
      </p>
    );
  }

  const today = todayLocal();
  const rows = bookings.map((booking) => ({
    booking,
    state: deriveState(booking, { requireSignatureForBooked }),
    stale: isStaleHold(booking, today),
  }));

  return (
    <>
      {/* Desktop */}
      <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
        <table className="w-full min-w-[860px] text-left">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Property</th>
              <th className="px-4 py-3 font-semibold">Guest</th>
              <th className="px-4 py-3 font-semibold">Stay</th>
              <th className="px-4 py-3 text-right font-semibold">Total</th>
              <th className="px-4 py-3 text-right font-semibold">Received</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(({ booking, state, stale }) => (
              <tr key={booking.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{booking.propertyName}</td>
                <td className="px-4 py-3 text-slate-700">
                  <Link
                    href={`/customers/${booking.customerId}`}
                    className="font-medium hover:underline"
                  >
                    {booking.customerName}
                  </Link>
                  {booking.eventName ? (
                    <span className="block text-xs text-slate-400">{booking.eventName}</span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  <Stay booking={booking} />
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/stays/${booking.id}`}
                    className="font-semibold tabular-nums text-slate-900 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-900"
                  >
                    {money(booking.amountDue)}
                  </Link>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                  {money(booking.amountReceived)}
                </td>
                <td className="px-4 py-3">
                  <StateChip state={state} stale={stale} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <ul className="space-y-3 md:hidden">
        {rows.map(({ booking, state, stale }) => (
          <li
            key={booking.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <Link
                  href={`/customers/${booking.customerId}`}
                  className="font-semibold text-slate-900 hover:underline"
                >
                  {booking.customerName}
                </Link>
                <p className="text-sm text-slate-500">{booking.propertyName}</p>
              </div>
              <Link
                href={`/stays/${booking.id}`}
                className="shrink-0 text-lg font-bold tabular-nums text-slate-900 underline decoration-slate-300 underline-offset-4"
              >
                {money(booking.amountDue)}
              </Link>
            </div>

            <p className="mt-2 text-sm text-slate-600">
              <Stay booking={booking} />
            </p>

            <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
              <StateChip state={state} stale={stale} />
              {booking.amountReceived > 0 ? (
                <span className="text-sm tabular-nums text-slate-500">
                  {money(booking.amountReceived)} in
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
