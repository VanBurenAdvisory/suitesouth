"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import {
  addPayment,
  deleteBooking,
  deletePayment,
  setContractStatus,
  setInvoiceStatus,
  updateBooking,
} from "@/lib/db/bookings";
import { CONTRACT_STATUSES, INVOICE_STATUSES, LIFECYCLES } from "@/lib/booking-state";
import { todayLocal } from "@/lib/dates";

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

function refresh(id: string) {
  revalidatePath(`/stays/${id}`);
  revalidatePath("/stays");
  revalidatePath("/calendar");
  revalidatePath("/availability");
  revalidatePath("/");
}

export async function saveBookingDetails(formData: FormData): Promise<void> {
  await requireAuth();
  const id = text(formData, "id");
  if (!id) return;

  const lifecycleRaw = text(formData, "lifecycle");
  const lifecycle = LIFECYCLES.includes(lifecycleRaw as never)
    ? (lifecycleRaw as (typeof LIFECYCLES)[number])
    : "active";

  const turnaroundRaw = Number(text(formData, "turnaround_days"));
  const turnaroundDays = Number.isFinite(turnaroundRaw) ? Math.max(0, Math.trunc(turnaroundRaw)) : 1;

  await updateBooking(id, {
    eventId: text(formData, "event_id") || null,
    turnaroundDays,
    lifecycle,
    holdExpiresAt: text(formData, "hold_expires_at") || null,
    notes: text(formData, "notes") || null,
  });
  refresh(id);
}

/**
 * Both tracks save together. They used to have a Save each, so editing both and
 * pressing one silently discarded the other.
 */
export async function saveStatus(formData: FormData): Promise<void> {
  await requireAuth();
  const id = text(formData, "id");
  if (!id) return;

  const contract = text(formData, "contract_status");
  const invoice = text(formData, "invoice_status");

  if (CONTRACT_STATUSES.includes(contract as never)) {
    await setContractStatus(id, contract as (typeof CONTRACT_STATUSES)[number]);
  }
  if (INVOICE_STATUSES.includes(invoice as never)) {
    await setInvoiceStatus(id, invoice as (typeof INVOICE_STATUSES)[number]);
  }
  refresh(id);
}

export async function recordPayment(formData: FormData): Promise<void> {
  await requireAuth();
  const id = text(formData, "id");
  const amount = Number(text(formData, "amount").replace(/[$,\s]/g, ""));
  if (!id || !Number.isFinite(amount) || amount <= 0) return;

  await addPayment(
    id,
    amount,
    text(formData, "received_at") || todayLocal(),
    text(formData, "note") || null,
  );
  refresh(id);
}

/**
 * For records that should not exist, such as a duplicate or a wrong-condo
 * entry. A booking that was real but fell through belongs in Cancelled
 * instead, which keeps the history and stops blocking dates.
 */
export async function removeBooking(formData: FormData): Promise<void> {
  await requireAuth();
  const id = text(formData, "id");
  if (!id) return;

  await deleteBooking(id);
  refresh(id);
  redirect("/stays");
}

export async function removePayment(formData: FormData): Promise<void> {
  await requireAuth();
  const id = text(formData, "id");
  const paymentId = text(formData, "payment_id");
  if (!id || !paymentId) return;
  await deletePayment(paymentId);
  refresh(id);
}
