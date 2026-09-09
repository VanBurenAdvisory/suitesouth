import { STATE_LABELS, STATE_STYLES, type DerivedState } from "@/lib/booking-state";

export default function StateChip({
  state,
  stale,
}: {
  state: DerivedState;
  stale?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${STATE_STYLES[state].chip}`}
      >
        {STATE_LABELS[state]}
      </span>
      {stale ? (
        <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
          Expired
        </span>
      ) : null}
    </span>
  );
}
