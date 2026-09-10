"use client";

import { useRef } from "react";

/**
 * GET form so the result stays shareable, but it submits on change rather than
 * making her tap a second button. Picking an event is the whole interaction.
 */
export default function EventSelectForm({
  events,
  selectedId,
}: {
  events: { id: string; name: string; year: number }[];
  selectedId: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      method="get"
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <label className="label" htmlFor="event">
        Event
      </label>
      <select
        id="event"
        name="event"
        defaultValue={selectedId}
        onChange={() => formRef.current?.requestSubmit()}
        className="field"
      >
        <option value="">Choose an event</option>
        {events.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name} {e.year}
          </option>
        ))}
      </select>

      {/* Only reachable if scripting is off, where change events cannot submit. */}
      <noscript>
        <button type="submit" className="btn-primary mt-3">
          Check
        </button>
      </noscript>
    </form>
  );
}
