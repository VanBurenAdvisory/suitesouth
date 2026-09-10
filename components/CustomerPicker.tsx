"use client";

import { useMemo, useState } from "react";
import type { Customer } from "@/lib/types";

/**
 * One field on the fast path. She types a name; matches appear as she types.
 * If nothing matches, the typed text becomes a new customer on save, so she
 * never has to leave the form to create one. Phone only appears when the name
 * is new, keeping the common case a single keystroke-driven field.
 */
export default function CustomerPicker({ customers }: { customers: Customer[] }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Customer | null>(null);
  const [phone, setPhone] = useState("");

  const fullName = (c: Customer) => (c.firstName ? `${c.firstName} ${c.lastName}` : c.lastName);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || selected) return [];
    return customers
      .filter((c) => fullName(c).toLowerCase().includes(q) || (c.phone ?? "").includes(q))
      .slice(0, 6);
  }, [customers, query, selected]);

  // "John Smith" splits; "Smith" becomes a last name only.
  const trimmed = query.trim();
  const cut = trimmed.lastIndexOf(" ");
  const newFirst = cut > 0 ? trimmed.slice(0, cut) : "";
  const newLast = cut > 0 ? trimmed.slice(cut + 1) : trimmed;
  const isNew = !selected && trimmed.length > 0 && matches.length === 0;

  if (selected) {
    return (
      <div>
        <span className="label">Guest</span>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3">
          <span className="min-w-0">
            <span className="block truncate text-lg font-medium text-slate-900">
              {fullName(selected)}
            </span>
            {selected.hasStandingContract ? (
              <span className="block text-xs text-slate-500">
                Standing contract, nothing to sign
              </span>
            ) : null}
          </span>
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              setQuery("");
            }}
            className="btn-quiet shrink-0"
          >
            Change
          </button>
        </div>
        <input type="hidden" name="customer_id" value={selected.id} />
      </div>
    );
  }

  return (
    <div>
      <label className="label" htmlFor="customer_query">
        Guest
        <span className="ml-1.5 text-xs font-normal text-slate-400">search or type a new name</span>
      </label>
      <input
        id="customer_query"
        className="field"
        autoComplete="off"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        required
      />

      {matches.length > 0 ? (
        <ul className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {matches.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setSelected(c)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
              >
                <span className="font-medium text-slate-900">{fullName(c)}</span>
                {c.phone ? <span className="text-sm text-slate-500">{c.phone}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {isNew ? (
        <div className="mt-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
          <p className="text-sm text-sky-900">
            New customer: <span className="font-semibold">{trimmed}</span>
          </p>
          <input
            className="field mt-2"
            inputMode="tel"
            placeholder="Phone (optional)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
      ) : null}

      <input type="hidden" name="new_first_name" value={isNew ? newFirst : ""} />
      <input type="hidden" name="new_last_name" value={isNew ? newLast : ""} />
      <input type="hidden" name="new_phone" value={isNew ? phone : ""} />
    </div>
  );
}
