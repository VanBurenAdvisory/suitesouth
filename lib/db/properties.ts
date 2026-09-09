import "server-only";
import { connection, num, str, type Row } from "./index.ts";
import { isFeeTreatment } from "../calc.ts";
import type { Property } from "../types.ts";

function toProperty(r: Row): Property {
  return {
    id: str(r.id),
    name: str(r.name),
    ownerSharePct: num(r.owner_share_pct),
    commissionPct: num(r.commission_pct),
    feeTreatment: isFeeTreatment(r.fee_treatment) ? r.fee_treatment : "manager",
    turnaroundDays: num(r.turnaround_days),
  };
}

export async function listProperties(): Promise<Property[]> {
  const sql = connection();
  const rows = (await sql`
    select id, name, owner_share_pct, commission_pct, fee_treatment, turnaround_days
    from properties
    where active = true
    order by sort_order, name
  `) as Row[];
  return rows.map(toProperty);
}

export async function updateTurnaroundDays(id: string, days: number): Promise<void> {
  const sql = connection();
  await sql`
    update properties set turnaround_days = ${Math.max(0, Math.trunc(days))}
    where id = ${id}
  `;
}
