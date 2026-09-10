import "server-only";
import { connection, nullableStr, str, type Row } from "./index.ts";
import type { Customer, CustomerInput } from "../types.ts";

export const OWNER_CUSTOMER_ID = "00000000-0000-0000-0000-000000000001";

function toCustomer(r: Row): Customer {
  return {
    id: str(r.id),
    firstName: nullableStr(r.first_name),
    lastName: str(r.last_name),
    phone: nullableStr(r.phone),
    email: nullableStr(r.email),
    address: nullableStr(r.address),
    notes: nullableStr(r.notes),
    hasStandingContract: Boolean(r.has_standing_contract),
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  };
}

const COLUMNS = `id, first_name, last_name, phone, email, address, notes,
                 has_standing_contract,
                 created_at::text as created_at, updated_at::text as updated_at`;

export async function listCustomers(search?: string): Promise<Customer[]> {
  const sql = connection();
  const term = (search ?? "").trim();
  const rows = term
    ? ((await sql.query(
        `select ${COLUMNS} from customers
         where lower(first_name || ' ' || last_name) like $1
            or lower(last_name) like $1
            or coalesce(phone, '') like $2
         order by last_name, first_name
         limit 50`,
        [`%${term.toLowerCase()}%`, `%${term}%`],
      )) as Row[])
    : ((await sql.query(
        `select ${COLUMNS} from customers order by last_name, first_name limit 200`,
      )) as Row[]);
  return rows.map(toCustomer);
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const sql = connection();
  const rows = (await sql.query(`select ${COLUMNS} from customers where id = $1`, [id])) as Row[];
  return rows[0] ? toCustomer(rows[0]) : null;
}

export async function createCustomer(input: CustomerInput): Promise<string> {
  const sql = connection();
  const rows = (await sql`
    insert into customers (first_name, last_name, phone, email, address, notes,
                           has_standing_contract)
    values (${input.firstName}, ${input.lastName}, ${input.phone},
            ${input.email}, ${input.address}, ${input.notes},
            ${input.hasStandingContract})
    returning id
  `) as Row[];
  return str(rows[0].id);
}

export async function updateCustomer(id: string, input: CustomerInput): Promise<void> {
  const sql = connection();
  await sql`
    update customers
    set first_name = ${input.firstName},
        last_name  = ${input.lastName},
        phone      = ${input.phone},
        email      = ${input.email},
        address    = ${input.address},
        notes      = ${input.notes},
        has_standing_contract = ${input.hasStandingContract},
        updated_at = now()
    where id = ${id}
  `;
}

/**
 * Cheap duplicate warning: same phone, or same last name with a matching or
 * missing first name. Advisory only, never blocks a save.
 */
export async function findPossibleDuplicates(
  input: { firstName: string | null; lastName: string; phone: string | null },
  excludeId?: string,
): Promise<Customer[]> {
  const sql = connection();
  const rows = (await sql.query(
    `select ${COLUMNS} from customers
     where ($3::uuid is null or id <> $3::uuid)
       and (
         ($2 <> '' and phone = $2)
         or (lower(last_name) = lower($1))
       )
     order by last_name, first_name
     limit 5`,
    [input.lastName, input.phone ?? "", excludeId ?? null],
  )) as Row[];
  return rows.map(toCustomer);
}

export async function countBookingsForCustomer(id: string): Promise<number> {
  const sql = connection();
  const rows = (await sql`
    select count(*)::int as n from bookings where customer_id = ${id}
  `) as Row[];
  return Number(rows[0]?.n ?? 0);
}

/** Only for customers with no bookings. Callers must check first. */
export async function deleteCustomer(id: string): Promise<void> {
  const sql = connection();
  await sql`delete from customers where id = ${id}`;
}
