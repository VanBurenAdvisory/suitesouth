import "server-only";
import { neon } from "@neondatabase/serverless";

/**
 * The Neon integration prefixes the variables it injects, so the connection
 * string can arrive under a few different names depending on how the resource
 * was connected. Empty strings are treated as absent, which is what a manually
 * created but unfilled Vercel variable looks like at runtime.
 */
function connectionString(): string {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.SW_DATABASE_URL,
    process.env.POSTGRES_URL,
    process.env.SW_POSTGRES_URL,
  ];
  const url = candidates.find((value) => typeof value === "string" && value.trim() !== "");
  if (!url) {
    throw new Error(
      "No database connection string found. Expected DATABASE_URL or SW_DATABASE_URL.",
    );
  }
  return url;
}

export function connection() {
  return neon(connectionString());
}

export type Row = Record<string, unknown>;

/** Postgres numeric arrives as a string; dates are cast to text in the queries. */
export const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));

export const nullableNum = (v: unknown): number | null =>
  v === null || v === undefined ? null : Number(v);

export const str = (v: unknown): string => String(v ?? "");

export const nullableStr = (v: unknown): string | null =>
  v === null || v === undefined ? null : String(v);

/** "Jane Smith", "Smith" when there is no first name. */
export function displayName(firstName: unknown, lastName: unknown): string {
  const first = nullableStr(firstName);
  const last = str(lastName);
  return first ? `${first} ${last}` : last;
}
