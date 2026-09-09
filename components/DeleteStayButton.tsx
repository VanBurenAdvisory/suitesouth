"use client";

import { useState } from "react";
import { removeBooking } from "@/app/(app)/stays/actions";
import { money } from "@/lib/calc";

/**
 * Two-step on purpose. Cancelling is the reversible option and lives in the
 * details form; this one is for records that should never have existed, so it
 * asks first and says what goes with it.
 */
export default function DeleteStayButton({
  bookingId,
  customerName,
  paymentCount,
  amountReceived,
}: {
  bookingId: string;
  customerName: string;
  paymentCount: number;
  amountReceived: number;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-sm text-slate-400 hover:text-red-600 hover:underline"
      >
        Delete this stay
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-red-300 bg-red-50 p-4">
      <p className="text-sm font-semibold text-red-900">
        Permanently delete the stay for {customerName}?
      </p>
      <p className="mt-1 text-sm text-red-800">
        This cannot be undone.
        {paymentCount > 0
          ? ` ${paymentCount} recorded ${paymentCount === 1 ? "payment" : "payments"} totalling ${money(amountReceived)} will be deleted with it.`
          : ""}
      </p>
      <p className="mt-2 text-sm text-red-800">
        If this booking was real and simply fell through, set its lifecycle to Cancelled instead.
        That keeps the history and still frees up the dates.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <form action={removeBooking}>
          <input type="hidden" name="id" value={bookingId} />
          <button
            type="submit"
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Yes, delete it
          </button>
        </form>
        <button type="button" onClick={() => setConfirming(false)} className="btn-quiet">
          Keep it
        </button>
      </div>
    </div>
  );
}
