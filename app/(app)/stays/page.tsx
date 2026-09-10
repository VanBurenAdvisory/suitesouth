import Link from "next/link";
import BookingsTable from "@/components/BookingsTable";
import TotalsBar from "@/components/TotalsBar";
import { deriveState, STATE_LABELS, type DerivedState } from "@/lib/booking-state";
import { paymentStatus, type PaymentStatus } from "@/lib/calc";
import { listBookings } from "@/lib/db/bookings";
import { listCustomers } from "@/lib/db/customers";
import { listEvents } from "@/lib/db/events";
import { listProperties } from "@/lib/db/properties";
import { loadSettings } from "@/lib/db/settings";
import { totalsFor } from "@/lib/totals";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined): string =>
  Array.isArray(v) ? (v[0] ?? "") : (v ?? "");

const STATES: DerivedState[] = ["hold", "committed", "booked", "confirmed", "cancelled"];
const PAYMENTS: PaymentStatus[] = ["unpaid", "partial", "paid"];

export default async function StaysPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const filters = {
    propertyId: one(sp.property) || undefined,
    eventId: one(sp.event) || undefined,
    customerId: one(sp.customer) || undefined,
    from: one(sp.from) || undefined,
    to: one(sp.to) || undefined,
  };
  const statusFilter = one(sp.status);
  const paymentFilter = one(sp.payment);

  const [properties, events, customers, settings, all] = await Promise.all([
    listProperties(),
    listEvents(),
    listCustomers(),
    loadSettings(),
    listBookings(filters),
  ]);

  // Derived state and payment status are computed, not stored, so they filter here.
  const bookings = all.filter((b) => {
    if (
      statusFilter &&
      deriveState(b, { requireSignatureForBooked: settings.requireSignatureForBooked }) !==
        statusFilter
    ) {
      return false;
    }
    if (paymentFilter && paymentStatus(b.amountDue, b.amountReceived) !== paymentFilter) {
      return false;
    }
    return true;
  });

  const totals = totalsFor(bookings, settings.includeCancelledInTotals);
  const showCoowner = bookings.some((b) => b.coownerDue > 0);
  const hasFilters = Object.values({ ...sp }).some(Boolean);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <h2 className="mb-3 text-lg font-semibold text-slate-900">Stays</h2>

      <details open={hasFilters} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <summary className="disclosure">
          Filters{hasFilters ? " (active)" : ""}
        </summary>
        <form method="get" className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div>
          <label className="label" htmlFor="property">
            Condo
          </label>
          <select id="property" name="property" defaultValue={filters.propertyId} className="field">
            <option value="">All</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="status">
            Status
          </label>
          <select id="status" name="status" defaultValue={statusFilter} className="field">
            <option value="">All</option>
            {STATES.map((s) => (
              <option key={s} value={s}>
                {STATE_LABELS[s]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="event">
            Event
          </label>
          <select id="event" name="event" defaultValue={filters.eventId} className="field">
            <option value="">All</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} {e.year}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="customer">
            Customer
          </label>
          <select id="customer" name="customer" defaultValue={filters.customerId} className="field">
            <option value="">All</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.firstName ? `${c.firstName} ${c.lastName}` : c.lastName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="from">
            From
          </label>
          <input id="from" name="from" type="date" defaultValue={filters.from} className="field" />
        </div>

        <div>
          <label className="label" htmlFor="to">
            To
          </label>
          <input id="to" name="to" type="date" defaultValue={filters.to} className="field" />
        </div>

        <div>
          <label className="label" htmlFor="payment">
            Payment
          </label>
          <select id="payment" name="payment" defaultValue={paymentFilter} className="field">
            <option value="">All</option>
            {PAYMENTS.map((p) => (
              <option key={p} value={p}>
                {p[0].toUpperCase() + p.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end gap-2">
          <button type="submit" className="btn-primary">
            Filter
          </button>
          {hasFilters ? (
            <Link href="/stays" className="btn-quiet shrink-0 py-3">
              Clear
            </Link>
          ) : null}
        </div>
        </form>
      </details>

      <div className="mt-4">
        <TotalsBar totals={totals} showCoowner={showCoowner} />
      </div>

      <div className="mt-4">
        <BookingsTable
          bookings={bookings}
          requireSignatureForBooked={settings.requireSignatureForBooked}
          emptyMessage="No stays match these filters."
        />
      </div>
    </main>
  );
}
