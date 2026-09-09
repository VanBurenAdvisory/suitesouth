"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createSession,
  destroySession,
  isAuthenticated,
  requireAuth,
  verifyPassword,
} from "@/lib/auth";
import { insertBooking } from "@/lib/db/bookings";
import { createCustomer } from "@/lib/db/customers";
import { findEventForStay } from "@/lib/db/events";
import { listProperties } from "@/lib/db/properties";
import { findConflicts } from "@/lib/availability";
import { nightsBetween } from "@/lib/calc";
import { formatRange } from "@/lib/dates";
import { STATE_LABELS } from "@/lib/booking-state";

export type FormState = {
  ok: boolean;
  error: string | null;
  savedAt: number;
  /** Non-blocking overlap notices. Present means the save was held for a confirm. */
  warnings?: string[];
};

const fail = (error: string): FormState => ({ ok: false, error, savedAt: 0 });

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

/** Accepts "1,250.00" or "$1250" and returns NaN for anything that is not a non-negative number. */
function amount(formData: FormData, name: string): number {
  const raw = text(formData, name).replace(/[$,\s]/g, "");
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

function optionalAmount(formData: FormData, name: string): number | null {
  const raw = text(formData, name).replace(/[$,\s]/g, "");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const password = String(formData.get("password") ?? "");

  let ok = false;
  try {
    ok = verifyPassword(password);
  } catch {
    return fail("Server is not configured: APP_PASSWORD is missing.");
  }
  if (!ok) return fail("Incorrect password.");

  await createSession();
  redirect("/");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}

export async function createBooking(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await isAuthenticated())) return fail("Session expired. Reload the page and sign in again.");

  const propertyId = text(formData, "property_id");
  const checkIn = text(formData, "check_in");
  const checkOut = text(formData, "check_out");

  if (!propertyId) return fail("Pick a property.");
  if (!checkIn || !checkOut) return fail("Both dates are required.");

  const computedNights = nightsBetween(checkIn, checkOut);
  if (computedNights <= 0) return fail("Check-out must be after check-in.");

  const nightsRaw = text(formData, "nights");
  const nights = nightsRaw ? Number(nightsRaw) : computedNights;
  if (!Number.isInteger(nights) || nights <= 0) return fail("Nights must be a whole number above zero.");

  const roomRevenue = amount(formData, "room_revenue");
  const fees = amount(formData, "fees");
  const taxAmount = optionalAmount(formData, "tax_amount");
  const amountReceived = amount(formData, "amount_received");
  if ([roomRevenue, fees, amountReceived].some(Number.isNaN) || Number.isNaN(taxAmount)) {
    return fail("Amounts must be non-negative numbers.");
  }

  // Overlaps warn but never block. The first save is held so she can see the
  // conflict; pressing Save anyway comes back with the acknowledgement set.
  if (!text(formData, "acknowledge_overlap")) {
    const property = (await listProperties()).find((p) => p.id === propertyId);
    if (property) {
      const conflicts = await findConflicts({
        propertyId,
        checkIn,
        checkOut,
        turnaroundDays: property.turnaroundDays,
      });
      if (conflicts.length > 0) {
        return {
          ok: false,
          error: null,
          savedAt: 0,
          warnings: conflicts.map(
            (c) =>
              `${property.name} overlaps ${c.customerName}, ${formatRange(c.checkIn, c.checkOut)} (${STATE_LABELS[c.state]})`,
          ),
        };
      }
    }
  }

  // Either an existing customer was picked, or the typed name becomes a new one.
  let customerId = text(formData, "customer_id");
  if (!customerId) {
    const lastName = text(formData, "new_last_name");
    if (!lastName) return fail("A guest name is required.");
    const firstName = text(formData, "new_first_name") || null;
    const phone = text(formData, "new_phone") || null;
    try {
      customerId = await createCustomer({
        firstName,
        lastName,
        phone,
        email: null,
        address: null,
        notes: null,
      });
    } catch (error) {
      console.error("createCustomer failed", error);
      return fail("Could not save the customer. Check the connection and try again.");
    }
  }

  const notes = text(formData, "notes") || null;

  try {
    // Auto-associate with whichever event overlaps this stay the most.
    const event = await findEventForStay(checkIn, checkOut);
    await insertBooking({
      propertyId,
      customerId,
      eventId: event?.id ?? null,
      checkIn,
      checkOut,
      roomRevenue,
      nights,
      fees,
      taxAmount,
      amountReceived,
      notes,
    });
  } catch (error) {
    console.error("createBooking failed", error);
    return fail("Could not save the booking. Check the connection and try again.");
  }

  revalidatePath("/");
  revalidatePath("/stays");
  revalidatePath("/calendar");
  return { ok: true, error: null, savedAt: Date.now() };
}

export async function requireSession(): Promise<void> {
  await requireAuth();
}
