import "server-only";
import { blockedWindow, conflictsWith, windowBlocks } from "./turnaround.ts";
import { deriveState, type DerivedState } from "./booking-state.ts";
import { eachDay } from "./dates.ts";
import { listBookingWindows } from "./db/bookings.ts";
import { listProperties } from "./db/properties.ts";
import { listEventPropertyRates } from "./db/events.ts";
import { loadSettings } from "./db/settings.ts";
import type { BookingWindow, EventRecord, Property } from "./types.ts";

export type Conflict = {
  bookingId: string;
  customerName: string;
  checkIn: string;
  checkOut: string;
  state: DerivedState;
};

export type PropertyAvailability = {
  property: Property;
  available: boolean;
  conflicts: Conflict[];
  /** Per-property override when set, otherwise the event's flat rate. */
  suggestedRate: number | null;
  rateSource: "property" | "event" | null;
  priorYears: { year: number; subtotal: number; nightlyRate: number; nights: number }[];
};

/**
 * Availability for a check-in/check-out window across every property.
 * The proposal's own turnaround counts, since booking it would block those days
 * as well and collide with anything arriving right afterwards.
 */
export async function checkAvailability(args: {
  checkIn: string;
  checkOut: string;
  event?: EventRecord | null;
  priorYears?: { year: number; propertyId: string; subtotal: number; nightlyRate: number; nights: number }[];
}): Promise<PropertyAvailability[]> {
  const { checkIn, checkOut, event, priorYears = [] } = args;

  const [properties, settings] = await Promise.all([listProperties(), loadSettings()]);
  const windows = await listBookingWindows(checkIn, checkOut);
  const overrides = event ? await listEventPropertyRates(event.id) : [];

  return properties.map((property) => {
    const existing: BookingWindow[] = windows.filter((w) => w.propertyId === property.id);
    const proposed = { checkIn, checkOut, turnaroundDays: property.turnaroundDays };
    const hits = conflictsWith(proposed, existing) as BookingWindow[];

    const override = overrides.find((o) => o.propertyId === property.id);
    const suggestedRate = override?.suggestedRate ?? event?.suggestedRate ?? null;
    const rateSource = override ? "property" : event?.suggestedRate != null ? "event" : null;

    return {
      property,
      available: hits.length === 0,
      conflicts: hits.map((w) => ({
        bookingId: w.id,
        customerName: w.customerName,
        checkIn: w.checkIn,
        checkOut: w.checkOut,
        state: deriveState(w, {
          requireSignatureForBooked: settings.requireSignatureForBooked,
        }),
      })),
      suggestedRate,
      rateSource,
      priorYears: priorYears
        .filter((p) => p.propertyId === property.id)
        .map(({ year, subtotal, nightlyRate, nights }) => ({ year, subtotal, nightlyRate, nights })),
    };
  });
}

/**
 * Per-day availability. This is what backs the public endpoint, so it returns
 * nothing but the property, the date, and a boolean. No names, no rates, no
 * reason a date is unavailable.
 */
export type DayAvailability = { property: string; date: string; available: boolean };

export async function availabilityByDay(from: string, through: string): Promise<DayAvailability[]> {
  const properties = await listProperties();
  const windows = await listBookingWindows(from, through);
  const blocked = windows.map((w) => ({ propertyId: w.propertyId, window: blockedWindow(w) }));
  const days = eachDay(from, through);

  const out: DayAvailability[] = [];
  for (const property of properties) {
    const mine = blocked.filter((b) => b.propertyId === property.id);
    for (const date of days) {
      out.push({
        property: property.name,
        date,
        available: !mine.some((b) => windowBlocks(b.window, date)),
      });
    }
  }
  return out;
}

/** Internal calendar needs the reason a day is blocked; the public page does not. */
export type CalendarDay = {
  date: string;
  bookingId: string;
  state: DerivedState;
  customerName: string;
  isTurnaround: boolean;
};

export async function calendarDays(
  from: string,
  through: string,
): Promise<Map<string, CalendarDay[]>> {
  const [windows, settings] = await Promise.all([
    listBookingWindows(from, through),
    loadSettings(),
  ]);

  const byProperty = new Map<string, CalendarDay[]>();
  for (const w of windows) {
    const state = deriveState(w, {
      requireSignatureForBooked: settings.requireSignatureForBooked,
    });
    const blocked = blockedWindow(w);
    const firstTurnaroundDay = w.checkOut; // the night after the last occupied one
    for (const date of eachDay(blocked.from, blocked.through)) {
      if (date < from || date > through) continue;
      const list = byProperty.get(w.propertyId) ?? [];
      list.push({
        date,
        bookingId: w.id,
        state,
        customerName: w.customerName,
        isTurnaround: date >= firstTurnaroundDay,
      });
      byProperty.set(w.propertyId, list);
    }
  }
  return byProperty;
}

/**
 * Conflicts for one property, used by the soft overlap warning on save.
 * Advisory only: the caller decides whether to proceed.
 */
export async function findConflicts(args: {
  propertyId: string;
  checkIn: string;
  checkOut: string;
  turnaroundDays: number;
  excludeBookingId?: string;
}): Promise<Conflict[]> {
  const settings = await loadSettings();
  const windows = await listBookingWindows(args.checkIn, args.checkOut);
  const existing = windows.filter(
    (w) => w.propertyId === args.propertyId && w.id !== args.excludeBookingId,
  );
  const proposed = {
    checkIn: args.checkIn,
    checkOut: args.checkOut,
    turnaroundDays: args.turnaroundDays,
  };
  return (conflictsWith(proposed, existing) as BookingWindow[]).map((w) => ({
    bookingId: w.id,
    customerName: w.customerName,
    checkIn: w.checkIn,
    checkOut: w.checkOut,
    state: deriveState(w, { requireSignatureForBooked: settings.requireSignatureForBooked }),
  }));
}
