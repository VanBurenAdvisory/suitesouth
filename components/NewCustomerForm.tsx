"use client";

import { useActionState } from "react";
import { addCustomer, type CustomerFormState } from "@/app/(app)/customers/actions";

const INITIAL: CustomerFormState = { error: null, duplicates: [] };

export default function NewCustomerForm({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [state, formAction, pending] = useActionState(addCustomer, INITIAL);

  // Collapsed by default so the list is what you land on, but forced open when
  // there is feedback to read, which would otherwise be hidden behind a summary.
  const hasFeedback = Boolean(state.error) || state.duplicates.length > 0;

  return (
    <details
      id="add"
      open={defaultOpen || hasFeedback}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <summary className="disclosure">Add a customer</summary>
      <form action={formAction} className="mt-3">
      {state.error ? (
        <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {state.error}
        </p>
      ) : null}

      {state.duplicates.length > 0 ? (
        <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-900">Possible duplicate</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-amber-900">
            {state.duplicates.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
          <button
            type="submit"
            name="acknowledge_duplicate"
            value="1"
            className="mt-3 rounded-lg border border-amber-400 bg-white px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100"
          >
            Add anyway
          </button>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="first_name">
            First name
          </label>
          <input id="first_name" name="first_name" className="field" autoComplete="off" />
        </div>
        <div>
          <label className="label" htmlFor="last_name">
            Last name
          </label>
          <input id="last_name" name="last_name" className="field" autoComplete="off" required />
        </div>
        <div>
          <label className="label" htmlFor="phone">
            Phone
          </label>
          <input id="phone" name="phone" inputMode="tel" className="field" />
        </div>
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input id="email" name="email" type="email" className="field" />
        </div>
      </div>

      <button type="submit" className="btn-primary mt-3" disabled={pending}>
        {pending ? "Saving..." : "Add customer"}
      </button>
      </form>
    </details>
  );
}
