"use client";

import { useState } from "react";
import { addDays } from "@/lib/dates";

/**
 * GET form, so the result stays shareable and bookmarkable. The only reason
 * this is a client component is to keep check-out ahead of check-in, which
 * makes the second picker open on the right month instead of today.
 */
export default function DateRangeForm({
  checkIn: initialCheckIn,
  checkOut: initialCheckOut,
}: {
  checkIn: string;
  checkOut: string;
}) {
  const [checkIn, setCheckIn] = useState(initialCheckIn);
  const [checkOut, setCheckOut] = useState(initialCheckOut);

  return (
    <form method="get" className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label" htmlFor="from">
            Check-in
          </label>
          <input
            id="from"
            name="from"
            type="date"
            className="field py-2 text-sm sm:py-2 sm:text-sm"
            value={checkIn}
            onChange={(e) => {
              const value = e.target.value;
              setCheckIn(value);
              if (value && (!checkOut || checkOut <= value)) setCheckOut(addDays(value, 1));
            }}
          />
        </div>
        <div>
          <label className="label" htmlFor="to">
            Check-out
          </label>
          <input
            id="to"
            name="to"
            type="date"
            className="field py-2 text-sm sm:py-2 sm:text-sm"
            min={checkIn || undefined}
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
          />
        </div>
      </div>
      <button type="submit" className="btn-primary mt-2 py-2 text-sm sm:py-2 sm:text-sm">
        Check these dates
      </button>
    </form>
  );
}
