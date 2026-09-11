import "server-only";
import { randomUUID } from "node:crypto";
import { connection, displayName, nullableNum, nullableStr, num, str, type Row } from "./index.ts";
import { calculate, isFeeTreatment } from "../calc.ts";
import type { ContractStatus, InvoiceStatus, Lifecycle } from "../booking-state.ts";
import type { Booking, BookingWindow, NewBooking, Payment } from "../types.ts";

const lifecycleOf = (v: unknown): Lifecycle =>
  v === "hold" || v === "cancelled" ? v : "active";

const contractOf = (v: unknown): ContractStatus =>
  v === "sent" || v === "signed" ? v : "not_sent";

const invoiceOf = (v: unknown): InvoiceStatus =>
  v === "sent" || v === "deposit_received" || v === "paid_in_full" ? v : "not_sent";

const RECEIVED = `coalesce((select sum(p.amount) from payments p where p.booking_id = b.id), 0)`;

const COLUMNS = `
  b.id, b.property_id, pr.name as property_name,
  b.customer_id, c.first_name, c.last_name,
  b.event_id, e.name as event_name,
  b.check_in::text as check_in, b.check_out::text as check_out,
  b.nights, b.turnaround_days, b.nightly_rate, b.fees, b.subtotal,
  b.owner_share_pct, b.commission_pct, b.fee_treatment,
  b.manager_commission, b.owner_due, b.coowner_due, b.tax_amount, b.amount_due,
  ${RECEIVED} as amount_received,
  b.lifecycle, b.hold_expires_at::text as hold_expires_at,
  b.contract_status, b.contract_sent_at::text as contract_sent_at,
  b.contract_signed_at::text as contract_signed_at,
  b.invoice_status, b.invoice_sent_at::text as invoice_sent_at,
  b.deposit_received_at::text as deposit_received_at,
  b.paid_in_full_at::text as paid_in_full_at,
  b.notes, b.created_at::text as created_at, b.updated_at::text as updated_at
`;

const FROM = `
  from bookings b
  join properties pr on pr.id = b.property_id
  join customers c on c.id = b.customer_id
  left join events e on e.id = b.event_id
`;

function toBooking(r: Row): Booking {
  return {
    id: str(r.id),
    propertyId: str(r.property_id),
    propertyName: str(r.property_name),
    customerId: str(r.customer_id),
    customerName: displayName(r.first_name, r.last_name),
    eventId: nullableStr(r.event_id),
    eventName: nullableStr(r.event_name),
    checkIn: str(r.check_in),
    checkOut: str(r.check_out),
    nights: num(r.nights),
    turnaroundDays: num(r.turnaround_days),
    nightlyRate: num(r.nightly_rate),
    fees: num(r.fees),
    subtotal: num(r.subtotal),
    ownerSharePct: num(r.owner_share_pct),
    commissionPct: num(r.commission_pct),
    feeTreatment: isFeeTreatment(r.fee_treatment) ? r.fee_treatment : "manager",
    managerCommission: num(r.manager_commission),
    ownerDue: num(r.owner_due),
    coownerDue: num(r.coowner_due),
    taxAmount: nullableNum(r.tax_amount),
    amountDue: num(r.amount_due),
    amountReceived: num(r.amount_received),
    lifecycle: lifecycleOf(r.lifecycle),
    holdExpiresAt: nullableStr(r.hold_expires_at),
    contractStatus: contractOf(r.contract_status),
    contractSentAt: nullableStr(r.contract_sent_at),
    contractSignedAt: nullableStr(r.contract_signed_at),
    invoiceStatus: invoiceOf(r.invoice_status),
    invoiceSentAt: nullableStr(r.invoice_sent_at),
    depositReceivedAt: nullableStr(r.deposit_received_at),
    paidInFullAt: nullableStr(r.paid_in_full_at),
    notes: nullableStr(r.notes),
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  };
}

export type BookingFilters = {
  propertyId?: string;
  eventId?: string;
  customerId?: string;
  from?: string;
  to?: string;
};

/** Storable filters run in SQL; derived state is filtered by the caller. */
export async function listBookings(filters: BookingFilters = {}): Promise<Booking[]> {
  const sql = connection();
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (clause: string, value: unknown) => {
    params.push(value);
    where.push(clause.replace("?", `$${params.length}`));
  };

  if (filters.propertyId) add("b.property_id = ?", filters.propertyId);
  if (filters.eventId) add("b.event_id = ?", filters.eventId);
  if (filters.customerId) add("b.customer_id = ?", filters.customerId);
  if (filters.from) add("b.check_out >= ?::date", filters.from);
  if (filters.to) add("b.check_in <= ?::date", filters.to);

  const rows = (await sql.query(
    `select ${COLUMNS} ${FROM}
     ${where.length ? `where ${where.join(" and ")}` : ""}
     order by b.check_in desc, b.created_at desc`,
    params,
  )) as Row[];
  return rows.map(toBooking);
}

export async function getBooking(id: string): Promise<Booking | null> {
  const sql = connection();
  const rows = (await sql.query(`select ${COLUMNS} ${FROM} where b.id = $1`, [id])) as Row[];
  return rows[0] ? toBooking(rows[0]) : null;
}

/**
 * Everything needed to compute blocking over a window. Cancelled bookings are
 * excluded here, so they can never block anything downstream.
 */
export async function listBookingWindows(
  from: string,
  through: string,
): Promise<BookingWindow[]> {
  const sql = connection();
  const rows = (await sql.query(
    `select b.id, b.property_id, b.check_in::text as check_in, b.check_out::text as check_out,
            b.turnaround_days, b.lifecycle, b.contract_status, b.invoice_status,
            c.first_name, c.last_name
     from bookings b
     join customers c on c.id = b.customer_id
     where b.lifecycle <> 'cancelled'
       and b.check_in <= $2::date
       and (b.check_out + b.turnaround_days) >= $1::date`,
    [from, through],
  )) as Row[];
  return rows.map((r) => ({
    id: str(r.id),
    propertyId: str(r.property_id),
    checkIn: str(r.check_in),
    checkOut: str(r.check_out),
    turnaroundDays: num(r.turnaround_days),
    lifecycle: lifecycleOf(r.lifecycle),
    contractStatus: contractOf(r.contract_status),
    invoiceStatus: invoiceOf(r.invoice_status),
    customerName: displayName(r.first_name, r.last_name),
  }));
}

/**
 * Snapshots the property's rate terms AND turnaround onto the row, then
 * computes every stored figure from those copies. Nothing here reads the
 * properties table again, so later rate or turnaround edits cannot reach back.
 */
export async function insertBooking(input: NewBooking): Promise<string> {
  const sql = connection();

  const properties = (await sql`
    select owner_share_pct, commission_pct, fee_treatment, turnaround_days
    from properties where id = ${input.propertyId} and active = true
  `) as Row[];
  const property = properties[0];
  if (!property) throw new Error("Unknown property");

  const terms = {
    ownerSharePct: num(property.owner_share_pct),
    commissionPct: num(property.commission_pct),
    feeTreatment: isFeeTreatment(property.fee_treatment) ? property.fee_treatment : "manager",
  };
  const turnaroundDays = num(property.turnaround_days);

  const c = calculate({
    ...terms,
    roomRevenue: input.roomRevenue,
    nights: input.nights,
    fees: input.fees,
    taxAmount: input.taxAmount,
  });

  // A customer on a standing agreement needs no contract for this stay, and
  // recording one as signed would assert a signature that never happened.
  const customers = (await sql`
    select has_standing_contract from customers where id = ${input.customerId}
  `) as Row[];
  const standing = Boolean(customers[0]?.has_standing_contract);

  // Confirming at entry stamps both tracks now, the same shape the detail view
  // and a future email parser would write.
  const stamp = input.confirmed ? new Date().toISOString() : null;
  const contractStatus = standing ? "standing" : input.confirmed ? "signed" : "not_sent";
  const contractStamp = standing ? null : stamp;
  const invoiceStatus = input.confirmed ? "paid_in_full" : "not_sent";

  // Confirmed with no amount typed means the whole thing was paid.
  const received =
    input.confirmed && input.amountReceived === 0 ? c.amountDue : input.amountReceived;

  // Id generated here so the booking and its first payment commit together.
  const id = randomUUID();
  const statements = [
    sql`
      insert into bookings (
        id, property_id, customer_id, event_id, check_in, check_out,
        nightly_rate, nights, turnaround_days, fees, subtotal,
        owner_share_pct, commission_pct, fee_treatment,
        manager_commission, owner_due, coowner_due, tax_amount, amount_due, notes,
        contract_status, contract_sent_at, contract_signed_at,
        invoice_status, invoice_sent_at, deposit_received_at, paid_in_full_at
      ) values (
        ${id}, ${input.propertyId}, ${input.customerId}, ${input.eventId},
        ${input.checkIn}, ${input.checkOut},
        ${c.nightlyRate}, ${input.nights}, ${turnaroundDays}, ${input.fees}, ${c.subtotal},
        ${terms.ownerSharePct}, ${terms.commissionPct}, ${terms.feeTreatment},
        ${c.managerCommission}, ${c.ownerDue}, ${c.coownerDue},
        ${input.taxAmount}, ${c.amountDue}, ${input.notes},
        ${contractStatus}, ${contractStamp}, ${contractStamp},
        ${invoiceStatus}, ${stamp}, ${stamp}, ${stamp}
      )
    `,
  ];

  if (received > 0) {
    statements.push(sql`
      insert into payments (booking_id, amount) values (${id}, ${received})
    `);
  }

  await sql.transaction(statements);
  return id;
}

export type BookingEdit = {
  eventId: string | null;
  turnaroundDays: number;
  lifecycle: Lifecycle;
  holdExpiresAt: string | null;
  notes: string | null;
};

export async function updateBooking(id: string, edit: BookingEdit): Promise<void> {
  const sql = connection();
  await sql`
    update bookings
    set event_id = ${edit.eventId},
        turnaround_days = ${Math.max(0, Math.trunc(edit.turnaroundDays))},
        lifecycle = ${edit.lifecycle},
        hold_expires_at = ${edit.holdExpiresAt},
        notes = ${edit.notes},
        updated_at = now()
    where id = ${id}
  `;
}

/** Sets the status and stamps its matching timestamp, leaving earlier ones intact. */
export async function setContractStatus(id: string, status: ContractStatus): Promise<void> {
  const sql = connection();
  if (status === "sent") {
    await sql`update bookings set contract_status = 'sent',
              contract_sent_at = coalesce(contract_sent_at, now()), updated_at = now()
              where id = ${id}`;
  } else if (status === "signed") {
    await sql`update bookings set contract_status = 'signed',
              contract_sent_at = coalesce(contract_sent_at, now()),
              contract_signed_at = coalesce(contract_signed_at, now()), updated_at = now()
              where id = ${id}`;
  } else if (status === "standing") {
    // Nothing was sent or signed for this stay, so nothing gets stamped.
    await sql`update bookings set contract_status = 'standing',
              contract_sent_at = null, contract_signed_at = null, updated_at = now()
              where id = ${id}`;
  } else {
    await sql`update bookings set contract_status = 'not_sent',
              contract_sent_at = null, contract_signed_at = null, updated_at = now()
              where id = ${id}`;
  }
}

export async function setInvoiceStatus(id: string, status: InvoiceStatus): Promise<void> {
  const sql = connection();
  if (status === "sent") {
    await sql`update bookings set invoice_status = 'sent',
              invoice_sent_at = coalesce(invoice_sent_at, now()), updated_at = now()
              where id = ${id}`;
  } else if (status === "deposit_received") {
    await sql`update bookings set invoice_status = 'deposit_received',
              invoice_sent_at = coalesce(invoice_sent_at, now()),
              deposit_received_at = coalesce(deposit_received_at, now()), updated_at = now()
              where id = ${id}`;
  } else if (status === "paid_in_full") {
    const balances = (await sql`
      select b.amount_due - coalesce(sum(p.amount), 0) as balance
      from bookings b
      left join payments p on p.booking_id = b.id
      where b.id = ${id}
      group by b.id, b.amount_due
    `) as Row[];
    const balance = Number(balances[0]?.balance ?? 0);

    await sql`update bookings set invoice_status = 'paid_in_full',
              invoice_sent_at = coalesce(invoice_sent_at, now()),
              deposit_received_at = coalesce(deposit_received_at, now()),
              paid_in_full_at = coalesce(paid_in_full_at, now()), updated_at = now()
              where id = ${id}`;

    if (balance > 0) {
      await sql`
        insert into payments (booking_id, amount, note)
        values (${id}, ${balance}, 'Confirmed payment')
      `;
    }
  } else {
    await sql`update bookings set invoice_status = 'not_sent',
              invoice_sent_at = null, deposit_received_at = null, paid_in_full_at = null,
              updated_at = now() where id = ${id}`;
  }
}

export async function addPayment(
  bookingId: string,
  amount: number,
  receivedAt: string,
  note: string | null,
): Promise<void> {
  const sql = connection();
  await sql`
    insert into payments (booking_id, amount, received_at, note)
    values (${bookingId}, ${amount}, ${receivedAt}, ${note})
  `;
}

export async function listPayments(bookingId: string): Promise<Payment[]> {
  const sql = connection();
  const rows = (await sql`
    select id, booking_id, amount, received_at::text as received_at, method, note
    from payments where booking_id = ${bookingId}
    order by received_at, created_at
  `) as Row[];
  return rows.map((r) => ({
    id: str(r.id),
    bookingId: str(r.booking_id),
    amount: num(r.amount),
    receivedAt: str(r.received_at),
    method: nullableStr(r.method),
    note: nullableStr(r.note),
  }));
}

export async function deletePayment(id: string): Promise<void> {
  const sql = connection();
  await sql`delete from payments where id = ${id}`;
}

/** Hard delete, for records that should never have existed. Payments cascade. */
export async function deleteBooking(id: string): Promise<void> {
  const sql = connection();
  await sql`delete from bookings where id = ${id}`;
}
