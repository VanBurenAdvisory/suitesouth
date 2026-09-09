"use client";

import { useState } from "react";
import { removeCustomer } from "@/app/(app)/customers/actions";

/**
 * Two-step, like deleting a stay. A customer with bookings is not offered the
 * option at all, since their name is attached to those records.
 */
export default function DeleteCustomerButton({
  customerId,
  customerName,
  bookingCount,
}: {
  customerId: string;
  customerName: string;
  bookingCount: number;
}) {
  const [confirming, setConfirming] = useState(false);

  if (bookingCount > 0) {
    return (
      <p className="text-sm text-slate-400">
        {customerName} has {bookingCount} {bookingCount === 1 ? "stay" : "stays"} logged and cannot
        be deleted. Cancel or delete those first if this record is a mistake.
      </p>
    );
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-sm text-slate-400 hover:text-red-600 hover:underline"
      >
        Delete this customer
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-red-300 bg-red-50 p-4">
      <p className="text-sm font-semibold text-red-900">Permanently delete {customerName}?</p>
      <p className="mt-1 text-sm text-red-800">
        This cannot be undone. They have no stays logged, so nothing else is affected.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <form action={removeCustomer}>
          <input type="hidden" name="id" value={customerId} />
          <button
            type="submit"
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Yes, delete
          </button>
        </form>
        <button type="button" onClick={() => setConfirming(false)} className="btn-quiet">
          Keep it
        </button>
      </div>
    </div>
  );
}
