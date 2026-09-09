import "server-only";
import { connection, type Row } from "./index.ts";
import { isFeeTreatment, type FeeTreatment } from "../calc.ts";

/**
 * Configurable assumptions live here rather than as constants in components,
 * so changing a rule is a Settings edit instead of a code change.
 */
export type AppSettings = {
  defaultTurnaroundDays: number;
  holdExpiryDays: number;
  includeCancelledInTotals: boolean;
  requireSignatureForBooked: boolean;
  defaultFeeTreatment: FeeTreatment;
};

export const DEFAULT_SETTINGS: AppSettings = {
  defaultTurnaroundDays: 1,
  holdExpiryDays: 7,
  includeCancelledInTotals: false,
  requireSignatureForBooked: true,
  defaultFeeTreatment: "manager",
};

const KEYS: Record<keyof AppSettings, string> = {
  defaultTurnaroundDays: "default_turnaround_days",
  holdExpiryDays: "hold_expiry_days",
  includeCancelledInTotals: "include_cancelled_in_totals",
  requireSignatureForBooked: "require_signature_for_booked",
  defaultFeeTreatment: "default_fee_treatment",
};

function coerce(key: keyof AppSettings, raw: unknown): unknown {
  switch (key) {
    case "defaultTurnaroundDays":
    case "holdExpiryDays": {
      const n = Number(raw);
      return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : DEFAULT_SETTINGS[key];
    }
    case "includeCancelledInTotals":
    case "requireSignatureForBooked":
      return typeof raw === "boolean" ? raw : DEFAULT_SETTINGS[key];
    case "defaultFeeTreatment":
      return isFeeTreatment(raw) ? raw : DEFAULT_SETTINGS[key];
  }
}

export async function loadSettings(): Promise<AppSettings> {
  const sql = connection();
  let rows: Row[] = [];
  try {
    rows = (await sql`select key, value from settings`) as Row[];
  } catch {
    // Settings table missing (migration not yet run) should not take the app down.
    return { ...DEFAULT_SETTINGS };
  }

  const byKey = new Map(rows.map((r) => [String(r.key), r.value]));
  const result = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(KEYS) as (keyof AppSettings)[]) {
    if (byKey.has(KEYS[key])) {
      // @ts-expect-error each branch of coerce returns the matching field type
      result[key] = coerce(key, byKey.get(KEYS[key]));
    }
  }
  return result;
}

export async function saveSetting(key: keyof AppSettings, value: unknown): Promise<void> {
  const sql = connection();
  await sql`
    insert into settings (key, value, updated_at)
    values (${KEYS[key]}, ${JSON.stringify(value)}::jsonb, now())
    on conflict (key) do update set value = excluded.value, updated_at = now()
  `;
}
