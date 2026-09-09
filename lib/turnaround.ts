/**
 * Turnaround blocking. One implementation, shared by the availability check,
 * the calendar, the overlap warning, and the public page.
 */

import { addDays, rangesOverlap } from "./dates.ts";

export type BlockingStay = {
  checkIn: string;
  checkOut: string;
  /** Snapshotted onto the booking at insert, never read live from the property. */
  turnaroundDays: number;
};

/** Inclusive range of dates a stay makes unbookable, occupancy plus turnaround. */
export type BlockedWindow = { from: string; through: string };

/**
 * The last night of a stay is checkOut - 1.
 *
 * turnaroundDays = 0 permits a same-day turn: blocking ends on the last night,
 * so the checkout day itself is bookable by the next guest.
 *
 * turnaroundDays >= 1 treats the checkout day as occupied and then adds that
 * many cleaning days after it. So checkout 10/1 with 1 blocks 10/1 and 10/2,
 * and the next guest can check in 10/3.
 *
 * The step from 0 to 1 therefore costs two days rather than one. That is
 * deliberate and matches how the business actually operates: either you allow
 * same-day turns or you do not, and once you do not, the checkout day is gone.
 */
export function blockedWindow(stay: BlockingStay): BlockedWindow {
  const turnaround = Math.max(0, Math.trunc(stay.turnaroundDays) || 0);
  const through =
    turnaround === 0 ? addDays(stay.checkOut, -1) : addDays(stay.checkOut, turnaround);
  return { from: stay.checkIn, through };
}

/** Nights actually slept in, excluding any turnaround. */
export function occupiedWindow(stay: BlockingStay): BlockedWindow {
  return { from: stay.checkIn, through: addDays(stay.checkOut, -1) };
}

export function windowBlocks(window: BlockedWindow, date: string): boolean {
  return date >= window.from && date <= window.through;
}

export function windowsConflict(a: BlockedWindow, b: BlockedWindow): boolean {
  return rangesOverlap(a.from, a.through, b.from, b.through);
}

/**
 * Whether a proposed stay can go on a property, given what is already booked.
 * The proposal's own turnaround counts, since booking it would block those days
 * too and collide with anything arriving right after.
 */
export function conflictsWith(proposed: BlockingStay, existing: BlockingStay[]): BlockingStay[] {
  const proposedWindow = blockedWindow(proposed);
  return existing.filter((stay) => windowsConflict(proposedWindow, blockedWindow(stay)));
}

/** Turnaround-only portion, for rendering those days differently from occupancy. */
export function turnaroundOnlyDays(stay: BlockingStay): string[] {
  const blocked = blockedWindow(stay);
  const occupied = occupiedWindow(stay);
  const days: string[] = [];
  for (let d = addDays(occupied.through, 1); d <= blocked.through; d = addDays(d, 1)) {
    days.push(d);
  }
  return days;
}
