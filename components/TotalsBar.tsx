import { money } from "@/lib/calc";
import type { Totals } from "@/lib/totals";

function Cell({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd
        className={`tabular-nums ${strong ? "text-lg font-bold text-slate-900" : "text-base font-medium text-slate-800"}`}
      >
        {value}
      </dd>
    </div>
  );
}

export default function TotalsBar({
  totals,
  showCoowner,
}: {
  totals: Totals;
  showCoowner: boolean;
}) {
  return (
    <dl className="grid grid-cols-2 gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-3 lg:grid-cols-6">
      <Cell label="Stays" value={String(totals.count)} />
      <Cell label="Revenue" value={money(totals.revenue)} strong />
      <Cell label="Commission" value={money(totals.commission)} strong />
      <Cell label="Owner due" value={money(totals.ownerDue)} />
      {showCoowner ? <Cell label="Co-owner" value={money(totals.coownerDue)} /> : null}
      <Cell label="Outstanding" value={money(totals.outstanding)} />
    </dl>
  );
}
