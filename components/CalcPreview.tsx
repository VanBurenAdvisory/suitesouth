"use client";

import { money } from "@/lib/calc";
import type { CalcResult } from "@/lib/calc";
import type { Property } from "@/lib/types";

type Props = {
  result: CalcResult;
  property: Property | undefined;
  nights: number;
};

function Line({
  label,
  value,
  hint,
  emphasis,
}: {
  label: string;
  value: string;
  hint?: string;
  emphasis?: "total";
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <span
        className={
          emphasis === "total"
            ? "text-base font-semibold text-slate-900"
            : "text-sm text-slate-600"
        }
      >
        {label}
        {hint ? <span className="ml-1.5 text-xs text-slate-400">{hint}</span> : null}
      </span>
      <span
        className={
          emphasis === "total"
            ? "text-xl font-bold tabular-nums text-slate-900"
            : "text-base tabular-nums text-slate-900"
        }
      >
        {value}
      </span>
    </div>
  );
}

const pct = (n: number): string => `${Number(n.toFixed(2))}%`;

export default function CalcPreview({ result, property, nights }: Props) {
  const commissionRate = property
    ? (property.ownerSharePct * property.commissionPct) / 100
    : 0;
  const hasCoowner = Boolean(property && property.ownerSharePct < 100);

  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:sticky md:top-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Live calculation
      </h2>

      <div className="mt-3 divide-y divide-slate-100">
        <Line
          label="Stay revenue"
          hint={
            nights > 0 && result.nightlyRate > 0
              ? `${money(result.nightlyRate)}/night x ${nights}`
              : undefined
          }
          value={money(result.roomRevenue)}
        />
        {result.fees > 0 ? (
          <Line
            label="Fees"
            hint={
              result.managerFees > 0
                ? "manager keeps"
                : result.subtotal > result.roomRevenue
                  ? "commissionable"
                  : "to owners"
            }
            value={money(result.fees)}
          />
        ) : null}
        <Line label="Subtotal" value={money(result.subtotal)} />
      </div>

      <div className="mt-3 divide-y divide-slate-100 border-t border-slate-200 pt-2">
        <Line
          label="Manager commission"
          hint={property ? `${pct(commissionRate)} of subtotal` : undefined}
          value={money(result.managerCommission)}
        />
        {result.managerFees > 0 ? (
          <Line label="Fees retained by manager" value={money(result.managerFees)} />
        ) : null}
        <Line label="Left to owners" value={money(result.ownerPool)} />
      </div>

      <div className="mt-3 divide-y divide-slate-100 border-t border-slate-200 pt-2">
        <Line
          label={hasCoowner ? "Majority owner" : "Owner due"}
          hint={hasCoowner && property ? pct(property.ownerSharePct) : undefined}
          value={money(result.ownerDue)}
        />
        {hasCoowner ? (
          <Line
            label="Co-owner distribution"
            hint={property ? pct(100 - property.ownerSharePct) : undefined}
            value={money(result.coownerDue)}
          />
        ) : null}
      </div>

      <div className="mt-3 divide-y divide-slate-100 border-t border-slate-200 pt-2">
        {result.taxAmount > 0 ? <Line label="Tax" value={money(result.taxAmount)} /> : null}
        <Line label="Total due from guest" value={money(result.amountDue)} emphasis="total" />
      </div>
    </aside>
  );
}
