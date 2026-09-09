/**
 * Every date in this app is a YYYY-MM-DD string handled in UTC, so a timezone
 * never shifts a booking by a day. Nothing here constructs a local-time Date.
 */

const DAY_MS = 86_400_000;

export function toEpoch(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

export function fromEpoch(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function isValidDate(iso: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(toEpoch(iso));
}

export function addDays(iso: string, days: number): string {
  return fromEpoch(toEpoch(iso) + days * DAY_MS);
}

/** Whole days from `a` to `b`. Negative when `b` precedes `a`. */
export function daysBetween(a: string, b: string): number {
  return Math.round((toEpoch(b) - toEpoch(a)) / DAY_MS);
}

export function compareDates(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function minDate(a: string, b: string): string {
  return a <= b ? a : b;
}

export function maxDate(a: string, b: string): string {
  return a >= b ? a : b;
}

/** Every date from `from` through `through`, inclusive on both ends. */
export function eachDay(from: string, through: string): string[] {
  const days: string[] = [];
  if (!isValidDate(from) || !isValidDate(through) || from > through) return days;
  for (let d = from; d <= through; d = addDays(d, 1)) days.push(d);
  return days;
}

/** Inclusive ranges. Touching endpoints count as overlapping. */
export function rangesOverlap(
  aFrom: string,
  aThrough: string,
  bFrom: string,
  bThrough: string,
): boolean {
  return aFrom <= bThrough && bFrom <= aThrough;
}

/** Today in the viewer's own timezone, as YYYY-MM-DD. */
export function todayLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Formats YYYY-MM-DD without letting the local timezone shift the day. */
export function formatDate(iso: string, opts?: Intl.DateTimeFormatOptions): string {
  if (!isValidDate(iso)) return iso;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
    ...opts,
  });
}

/** "Oct 2 to Oct 5, 2026", collapsing the repeated year and month. */
export function formatRange(from: string, through: string): string {
  if (!isValidDate(from) || !isValidDate(through)) return `${from} to ${through}`;
  const sameYear = from.slice(0, 4) === through.slice(0, 4);
  const left = formatDate(from, sameYear ? { year: undefined } : {});
  return `${left} to ${formatDate(through)}`;
}
