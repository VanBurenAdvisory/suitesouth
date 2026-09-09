import Link from "next/link";
import { notFound } from "next/navigation";
import DeleteStayButton from "@/components/DeleteStayButton";
import StateChip from "@/components/StateChip";
import { money } from "@/lib/calc";
import { formatDate, formatRange, todayLocal } from "@/lib/dates";
import {
  CONTRACT_LABELS,
  CONTRACT_STATUSES,
  INVOICE_LABELS,
  INVOICE_STATUSES,
  LIFECYCLES,
  deriveState,
  isStaleHold,
} from "@/lib/booking-state";
import { getBooking, listPayments } from "@/lib/db/bookings";
import { listEvents } from "@/lib/db/events";
import { loadSettings } from "@/lib/db/settings";
import {
  recordPayment,
  removePayment,
  saveBookingDetails,
  saveContractStatus,
  saveInvoiceStatus,
} from "../actions";

export const dynamic = "force-dynamic";

const LIFECYCLE_LABELS: Record<string, string> = {
  hold: "Hold",
  active: "Active",
  cancelled: "Cancelled",
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <span className="text-sm text-slate-600">{label}</span>
      <span className="tabular-nums text-slate-900">{value}</span>
    </div>
  );
}

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [booking, payments, events, settings] = await Promise.all([
    getBooking(id),
    listPayments(id),
    listEvents(),
    loadSettings(),
  ]);

  if (!booking) notFound();

  const state = deriveState(booking, {
    requireSignatureForBooked: settings.requireSignatureForBooked,
  });
  const stale = isStaleHold(booking, todayLocal());
  const balance = booking.amountDue - booking.amountReceived;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <Link href="/stays" className="text-sm text-slate-500 hover:underline">
        Back to stays
      </Link>

      <header className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            {booking.customerName}
          </h2>
          <p className="text-slate-600">
            {booking.propertyName}, {formatRange(booking.checkIn, booking.checkOut)}
            <span className="ml-1.5 text-slate-400">
              {booking.nights} {booking.nights === 1 ? "night" : "nights"}
            </span>
          </p>
          {booking.eventName ? (
            <p className="mt-1 text-sm text-slate-500">{booking.eventName}</p>
          ) : null}
        </div>
        <StateChip state={state} stale={stale} />
      </header>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* Money, computed at insert from the snapshotted terms */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Money</h3>
          <div className="mt-2 divide-y divide-slate-100">
            <Row label="Stay revenue" value={money(booking.subtotal)} />
            <Row label="Per night, derived" value={money(booking.nightlyRate)} />
            {booking.fees > 0 ? <Row label="Fees" value={money(booking.fees)} /> : null}
            <Row
              label={`Manager commission, ${booking.ownerSharePct}% x ${booking.commissionPct}%`}
              value={money(booking.managerCommission)}
            />
            <Row label="Owner due" value={money(booking.ownerDue)} />
            {booking.coownerDue > 0 ? (
              <Row label="Co-owner distribution" value={money(booking.coownerDue)} />
            ) : null}
            {booking.taxAmount ? <Row label="Tax" value={money(booking.taxAmount)} /> : null}
            <Row label="Total due from guest" value={money(booking.amountDue)} />
            <Row label="Received" value={money(booking.amountReceived)} />
            <Row label="Balance" value={money(balance)} />
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Calculated from the rates stored on this booking, not the property's current
            settings.
          </p>
        </section>

        {/* Status tracks */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Status</h3>

          <form action={saveContractStatus} className="mt-3">
            <input type="hidden" name="id" value={booking.id} />
            <label className="label" htmlFor="contract_status">
              Contract
              {booking.contractSignedAt ? (
                <span className="ml-1.5 text-xs font-normal text-slate-400">
                  signed {formatDate(booking.contractSignedAt.slice(0, 10))}
                </span>
              ) : booking.contractSentAt ? (
                <span className="ml-1.5 text-xs font-normal text-slate-400">
                  sent {formatDate(booking.contractSentAt.slice(0, 10))}
                </span>
              ) : null}
            </label>
            <div className="flex gap-2">
              <select
                id="contract_status"
                name="contract_status"
                defaultValue={booking.contractStatus}
                className="field"
              >
                {CONTRACT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {CONTRACT_LABELS[s]}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn-quiet shrink-0 px-4">
                Save
              </button>
            </div>
          </form>

          <form action={saveInvoiceStatus} className="mt-4">
            <input type="hidden" name="id" value={booking.id} />
            <label className="label" htmlFor="invoice_status">
              Invoice
              {booking.paidInFullAt ? (
                <span className="ml-1.5 text-xs font-normal text-slate-400">
                  paid {formatDate(booking.paidInFullAt.slice(0, 10))}
                </span>
              ) : booking.depositReceivedAt ? (
                <span className="ml-1.5 text-xs font-normal text-slate-400">
                  deposit {formatDate(booking.depositReceivedAt.slice(0, 10))}
                </span>
              ) : null}
            </label>
            <div className="flex gap-2">
              <select
                id="invoice_status"
                name="invoice_status"
                defaultValue={booking.invoiceStatus}
                className="field"
              >
                {INVOICE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {INVOICE_LABELS[s]}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn-quiet shrink-0 px-4">
                Save
              </button>
            </div>
          </form>
        </section>

        {/* Payments */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Payments</h3>

          {payments.length > 0 ? (
            <ul className="mt-2 divide-y divide-slate-100">
              {payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="text-sm text-slate-600">
                    {formatDate(p.receivedAt)}
                    {p.note ? <span className="ml-1.5 text-slate-400">{p.note}</span> : null}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="tabular-nums text-slate-900">{money(p.amount)}</span>
                    <form action={removePayment}>
                      <input type="hidden" name="id" value={booking.id} />
                      <input type="hidden" name="payment_id" value={p.id} />
                      <button
                        type="submit"
                        className="text-xs text-slate-400 hover:text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </form>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-500">Nothing received yet.</p>
          )}

          <form action={recordPayment} className="mt-4 grid grid-cols-2 gap-2">
            <input type="hidden" name="id" value={booking.id} />
            <input
              name="amount"
              inputMode="decimal"
              placeholder={balance > 0 ? String(balance) : "0.00"}
              className="field"
              aria-label="Amount"
            />
            <input
              name="received_at"
              type="date"
              defaultValue={todayLocal()}
              className="field"
              aria-label="Received on"
            />
            <button type="submit" className="btn-primary col-span-2">
              Add payment
            </button>
          </form>
        </section>

        {/* Editable booking fields */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Details</h3>
          <form action={saveBookingDetails} className="mt-3 space-y-3">
            <input type="hidden" name="id" value={booking.id} />

            <div>
              <label className="label" htmlFor="lifecycle">
                Lifecycle
              </label>
              <select
                id="lifecycle"
                name="lifecycle"
                defaultValue={booking.lifecycle}
                className="field"
              >
                {LIFECYCLES.map((l) => (
                  <option key={l} value={l}>
                    {LIFECYCLE_LABELS[l]}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="hold_expires_at">
                  Hold expires
                </label>
                <input
                  id="hold_expires_at"
                  name="hold_expires_at"
                  type="date"
                  defaultValue={booking.holdExpiresAt ?? ""}
                  className="field"
                />
              </div>
              <div>
                <label className="label" htmlFor="turnaround_days">
                  Turnaround days
                </label>
                <input
                  id="turnaround_days"
                  name="turnaround_days"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={booking.turnaroundDays}
                  className="field"
                />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="event_id">
                Event
              </label>
              <select
                id="event_id"
                name="event_id"
                defaultValue={booking.eventId ?? ""}
                className="field"
              >
                <option value="">None</option>
                {events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} {e.year}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="notes">
                Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                defaultValue={booking.notes ?? ""}
                className="field"
              />
            </div>

            <button type="submit" className="btn-primary">
              Save details
            </button>
          </form>
        </section>
      </div>

      <div className="mt-6">
        <DeleteStayButton
          bookingId={booking.id}
          customerName={booking.customerName}
          paymentCount={payments.length}
          amountReceived={booking.amountReceived}
        />
      </div>
    </main>
  );
}
