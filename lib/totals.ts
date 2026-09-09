import type { Booking } from "./types.ts";

export type Totals = {
  count: number;
  revenue: number;
  commission: number;
  ownerDue: number;
  coownerDue: number;
  received: number;
  outstanding: number;
};

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Cancelled bookings are excluded unless the setting says otherwise, so a
 * cancelled stay never inflates a revenue figure.
 */
export function totalsFor(bookings: Booking[], includeCancelled: boolean): Totals {
  const counted = includeCancelled
    ? bookings
    : bookings.filter((b) => b.lifecycle !== "cancelled");

  const sum = (pick: (b: Booking) => number) =>
    round(counted.reduce((acc, b) => acc + pick(b), 0));

  const revenue = sum((b) => b.subtotal);
  const received = sum((b) => b.amountReceived);
  const due = sum((b) => b.amountDue);

  return {
    count: counted.length,
    revenue,
    commission: sum((b) => b.managerCommission),
    ownerDue: sum((b) => b.ownerDue),
    coownerDue: sum((b) => b.coownerDue),
    received,
    outstanding: round(due - received),
  };
}
