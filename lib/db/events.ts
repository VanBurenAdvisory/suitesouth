import "server-only";
import { connection, nullableNum, nullableStr, num, str, type Row } from "./index.ts";
import { daysBetween } from "../dates.ts";
import type { EventPropertyRate, EventRecord } from "../types.ts";

function toEvent(r: Row): EventRecord {
  return {
    id: str(r.id),
    name: str(r.name),
    year: num(r.year),
    startDate: str(r.start_date),
    endDate: str(r.end_date),
    eventType: str(r.event_type),
    suggestedRate: nullableNum(r.suggested_rate),
    suggestedNightlyRate: nullableNum(r.suggested_nightly_rate),
    notes: nullableStr(r.notes),
  };
}

const COLUMNS = `id, name, year, start_date::text as start_date, end_date::text as end_date,
                 event_type, suggested_rate, suggested_nightly_rate, notes`;

/** Year matches the event's label year; month matches the check-in date. */
export type EventFilters = { year?: number; month?: number };

export async function listEvents(filters: EventFilters = {}): Promise<EventRecord[]> {
  const sql = connection();
  const rows = (await sql.query(
    `select ${COLUMNS} from events
     where ($1::int is null or year = $1::int)
       and ($2::int is null or extract(month from start_date) = $2::int)
     order by start_date desc`,
    [filters.year ?? null, filters.month ?? null],
  )) as Row[];
  return rows.map(toEvent);
}

/** Unfiltered, so the filter dropdown and the name datalist stay complete. */
export async function listEventYears(): Promise<number[]> {
  const sql = connection();
  const rows = (await sql`select distinct year from events order by year desc`) as Row[];
  return rows.map((r) => num(r.year));
}

export async function listEventNames(): Promise<string[]> {
  const sql = connection();
  const rows = (await sql`select distinct name from events order by name`) as Row[];
  return rows.map((r) => str(r.name));
}

/** Upcoming first, for the availability screen's event picker. */
export async function listUpcomingEvents(from: string): Promise<EventRecord[]> {
  const sql = connection();
  const rows = (await sql.query(
    `select ${COLUMNS} from events where end_date >= $1 order by start_date limit 50`,
    [from],
  )) as Row[];
  return rows.map(toEvent);
}

export async function getEvent(id: string): Promise<EventRecord | null> {
  const sql = connection();
  const rows = (await sql.query(`select ${COLUMNS} from events where id = $1`, [id])) as Row[];
  return rows[0] ? toEvent(rows[0]) : null;
}

/** Nightly is derived from the flat rate over the event window, then stored. */
function nightlyFrom(rate: number | null, startDate: string, endDate: string): number | null {
  if (rate === null) return null;
  const nights = daysBetween(startDate, endDate);
  if (nights <= 0) return null;
  return Math.round((rate / nights) * 100) / 100;
}

export type EventInput = {
  name: string;
  year: number;
  startDate: string;
  endDate: string;
  eventType: string;
  suggestedRate: number | null;
  notes: string | null;
};

export async function createEvent(input: EventInput): Promise<string> {
  const sql = connection();
  const nightly = nightlyFrom(input.suggestedRate, input.startDate, input.endDate);
  const rows = (await sql`
    insert into events (name, year, start_date, end_date, event_type,
                        suggested_rate, suggested_nightly_rate, notes)
    values (${input.name}, ${input.year}, ${input.startDate}, ${input.endDate},
            ${input.eventType}, ${input.suggestedRate}, ${nightly}, ${input.notes})
    returning id
  `) as Row[];
  return str(rows[0].id);
}

export async function updateEvent(id: string, input: EventInput): Promise<void> {
  const sql = connection();
  const nightly = nightlyFrom(input.suggestedRate, input.startDate, input.endDate);
  await sql`
    update events
    set name = ${input.name}, year = ${input.year},
        start_date = ${input.startDate}, end_date = ${input.endDate},
        event_type = ${input.eventType},
        suggested_rate = ${input.suggestedRate},
        suggested_nightly_rate = ${nightly},
        notes = ${input.notes}, updated_at = now()
    where id = ${id}
  `;
}

export async function deleteEvent(id: string): Promise<void> {
  const sql = connection();
  await sql`delete from events where id = ${id}`;
}

export async function listEventPropertyRates(eventId: string): Promise<EventPropertyRate[]> {
  const sql = connection();
  const rows = (await sql`
    select event_id, property_id, suggested_rate, suggested_nightly_rate
    from event_property_rates where event_id = ${eventId}
  `) as Row[];
  return rows.map((r) => ({
    eventId: str(r.event_id),
    propertyId: str(r.property_id),
    suggestedRate: num(r.suggested_rate),
    suggestedNightlyRate: nullableNum(r.suggested_nightly_rate),
  }));
}

export async function setEventPropertyRate(
  eventId: string,
  propertyId: string,
  rate: number | null,
  window: { startDate: string; endDate: string },
): Promise<void> {
  const sql = connection();
  if (rate === null) {
    await sql`
      delete from event_property_rates
      where event_id = ${eventId} and property_id = ${propertyId}
    `;
    return;
  }
  const nightly = nightlyFrom(rate, window.startDate, window.endDate);
  await sql`
    insert into event_property_rates (event_id, property_id, suggested_rate, suggested_nightly_rate)
    values (${eventId}, ${propertyId}, ${rate}, ${nightly})
    on conflict (event_id, property_id) do update
      set suggested_rate = excluded.suggested_rate,
          suggested_nightly_rate = excluded.suggested_nightly_rate
  `;
}

/**
 * The event a stay falls in. When several overlap, the one sharing the most
 * nights wins, tie-broken by the earlier start. Always editable afterwards.
 */
export async function findEventForStay(
  checkIn: string,
  checkOut: string,
): Promise<EventRecord | null> {
  const sql = connection();
  const rows = (await sql.query(
    `select ${COLUMNS},
            least(end_date, $2::date) - greatest(start_date, $1::date) as overlap_nights
     from events
     where start_date < $2::date and end_date > $1::date
     order by overlap_nights desc, start_date asc
     limit 1`,
    [checkIn, checkOut],
  )) as Row[];
  return rows[0] ? toEvent(rows[0]) : null;
}

/**
 * What we actually charged for the same named event in earlier years, per
 * property. Matched on event name, which is why (name, year) is unique.
 */
export type PriorYearPrice = {
  year: number;
  propertyId: string;
  subtotal: number;
  nightlyRate: number;
  nights: number;
};

export async function priorYearPrices(
  eventName: string,
  beforeYear: number,
): Promise<PriorYearPrice[]> {
  const sql = connection();
  const rows = (await sql.query(
    `select e.year, b.property_id, b.subtotal, b.nightly_rate, b.nights
     from bookings b
     join events e on e.id = b.event_id
     where e.name = $1 and e.year < $2 and b.lifecycle <> 'cancelled'
     order by e.year desc`,
    [eventName, beforeYear],
  )) as Row[];
  return rows.map((r) => ({
    year: num(r.year),
    propertyId: str(r.property_id),
    subtotal: num(r.subtotal),
    nightlyRate: num(r.nightly_rate),
    nights: num(r.nights),
  }));
}
