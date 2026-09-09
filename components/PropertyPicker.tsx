"use client";

import type { Property } from "@/lib/types";

type Props = {
  properties: Property[];
  value: string;
  onChange: (id: string) => void;
};

export default function PropertyPicker({ properties, value, onChange }: Props) {
  return (
    <div>
      <span className="label">Property</span>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {properties.map((property) => {
          const selected = property.id === value;
          return (
            <button
              key={property.id}
              type="button"
              onClick={() => onChange(property.id)}
              aria-pressed={selected}
              className={[
                "rounded-xl border px-4 py-4 text-lg font-semibold transition",
                selected
                  ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                  : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50",
              ].join(" ")}
            >
              {property.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
