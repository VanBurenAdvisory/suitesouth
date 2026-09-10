"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createBooking, type FormState } from "@/app/actions";
import { calculate, money, nightsBetween } from "@/lib/calc";
import { addDays } from "@/lib/dates";
import type { Customer, Property } from "@/lib/types";
import CalcPreview from "./CalcPreview";
import CustomerPicker from "./CustomerPicker";
import PropertyPicker from "./PropertyPicker";

const INITIAL: FormState = { ok: false, error: null, savedAt: 0 };

/** Tolerates "1,250" and "$1250" while typing. */
function parseAmount(value: string): number {
  const n = Number(value.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export default function BookingForm({
  properties,
  customers,
  initialPropertyId,
  initialCheckIn,
  initialCheckOut,
}: {
  properties: Property[];
  customers: Customer[];
  /** Prefilled when arriving from a calendar selection. */
  initialPropertyId?: string;
  initialCheckIn?: string;
  initialCheckOut?: string;
}) {
  const [state, formAction, pending] = useActionState(createBooking, INITIAL);

  const [propertyId, setPropertyId] = useState(
    initialPropertyId || properties[0]?.id || "",
  );
  const [checkIn, setCheckIn] = useState(initialCheckIn ?? "");
  const [checkOut, setCheckOut] = useState(initialCheckOut ?? "");
  const [nightsOverride, setNightsOverride] = useState("");
  const [roomRevenue, setRoomRevenue] = useState("");
  const [fees, setFees] = useState("");
  const [taxAmount, setTaxAmount] = useState("");
  const [amountReceived, setAmountReceived] = useState("");
  const [paidDate, setPaidDate] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const computedNights = nightsBetween(checkIn, checkOut);
  const nights = nightsOverride === "" ? computedNights : Math.max(0, Number(nightsOverride) || 0);
  const property = properties.find((p) => p.id === propertyId);

  const result = calculate({
    ownerSharePct: property?.ownerSharePct ?? 0,
    commissionPct: property?.commissionPct ?? 0,
    feeTreatment: property?.feeTreatment ?? "manager",
    roomRevenue: parseAmount(roomRevenue),
    nights,
    fees: parseAmount(fees),
    taxAmount: taxAmount === "" ? null : parseAmount(taxAmount),
  });

  // Clear the entry fields after a successful save but keep the property
  // selected, since stays are usually logged in batches for one unit.
  const lastSaved = useRef(0);
  useEffect(() => {
    if (state.ok && state.savedAt !== lastSaved.current) {
      lastSaved.current = state.savedAt;
      setCheckIn("");
      setCheckOut("");
      setNightsOverride("");
      setRoomRevenue("");
      setFees("");
      setTaxAmount("");
      setAmountReceived("");
      setPaidDate("");
      setNotes("");
      setConfirmed(false);
    }
  }, [state]);

  const ready = Boolean(propertyId && checkIn && checkOut && nights > 0);

  return (
    <form
      action={formAction}
      className="grid gap-5 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] md:items-start"
    >
      <input type="hidden" name="property_id" value={propertyId} />
      <input type="hidden" name="nights" value={nights} />

      <div className="space-y-3 sm:space-y-4">
        {state.error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
            {state.error}
          </p>
        ) : null}
        {state.ok ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            Saved. Ready for the next one.
          </p>
        ) : null}

        {state.warnings?.length ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
            <p className="text-sm font-semibold text-amber-900">
              This overlaps something already booked
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-amber-900">
              {state.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
            <button
              type="submit"
              name="acknowledge_overlap"
              value="1"
              className="mt-3 rounded-lg border border-amber-400 bg-white px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100"
            >
              Save anyway
            </button>
          </div>
        ) : null}

        <PropertyPicker properties={properties} value={propertyId} onChange={setPropertyId} />

        {/* Remounted after each save so the picker clears with the rest. */}
        <CustomerPicker key={state.savedAt} customers={customers} />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="check_in">
              Check-in
            </label>
            <input
              id="check_in"
              name="check_in"
              type="date"
              className="field"
              value={checkIn}
              onChange={(e) => {
                const value = e.target.value;
                setCheckIn(value);
                setNightsOverride("");
                // Move check-out along so its picker opens on the right month
                // instead of today, and a one-night stay needs no second tap.
                if (value && (!checkOut || checkOut <= value)) setCheckOut(addDays(value, 1));
              }}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="check_out">
              Check-out
            </label>
            <input
              id="check_out"
              name="check_out"
              type="date"
              className="field"
              min={checkIn || undefined}
              value={checkOut}
              onChange={(e) => {
                setCheckOut(e.target.value);
                setNightsOverride("");
              }}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="nights_display">
              Nights
              <span className="ml-1.5 text-xs font-normal text-slate-400">auto</span>
            </label>
            <input
              id="nights_display"
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              className="field"
              value={nightsOverride === "" ? computedNights || "" : nightsOverride}
              onChange={(e) => setNightsOverride(e.target.value)}
              placeholder="0"
            />
          </div>
          <div>
            <label className="label" htmlFor="room_revenue">
              Total revenue
              <span className="ml-1.5 text-xs font-normal text-slate-400">whole stay</span>
            </label>
            <input
              id="room_revenue"
              name="room_revenue"
              type="text"
              inputMode="decimal"
              className="field"
              placeholder="0.00"
              value={roomRevenue}
              onChange={(e) => setRoomRevenue(e.target.value)}
            />
            {nights > 0 && result.nightlyRate > 0 ? (
              <p className="mt-1.5 text-xs text-slate-500">
                {money(result.nightlyRate)} per night over {nights}{" "}
                {nights === 1 ? "night" : "nights"}
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="fees">
              Fees
              <span className="ml-1.5 text-xs font-normal text-slate-400">optional</span>
            </label>
            <input
              id="fees"
              name="fees"
              type="text"
              inputMode="decimal"
              className="field"
              placeholder="0.00"
              value={fees}
              onChange={(e) => setFees(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="tax_amount">
              Tax
              <span className="ml-1.5 text-xs font-normal text-slate-400">optional</span>
            </label>
            <input
              id="tax_amount"
              name="tax_amount"
              type="text"
              inputMode="decimal"
              className="field"
              placeholder="0.00"
              value={taxAmount}
              onChange={(e) => setTaxAmount(e.target.value)}
            />
          </div>
        </div>

        {/* The common case: a returning guest who has already paid. */}
        <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <input
            type="checkbox"
            name="confirmed"
            value="1"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 size-5 shrink-0 rounded border-slate-300"
          />
          <span className="text-sm font-medium text-slate-800">
            Confirmed
            <span className="block text-xs font-normal text-slate-500">
              Contract signed and paid in full
              {confirmed && result.amountDue > 0
                ? `, recording ${money(result.amountDue)} received`
                : ""}
              .
            </span>
          </span>
        </label>

        <details className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-600">
            Payment and notes
          </summary>
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="amount_received">
                  Amount received
                </label>
                <input
                  id="amount_received"
                  name="amount_received"
                  type="text"
                  inputMode="decimal"
                  className="field"
                  placeholder="0.00"
                  value={amountReceived}
                  onChange={(e) => setAmountReceived(e.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="paid_date">
                  Paid date
                </label>
                <input
                  id="paid_date"
                  name="paid_date"
                  type="date"
                  className="field"
                  value={paidDate}
                  onChange={(e) => setPaidDate(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="notes">
                Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={2}
                className="field"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        </details>
      </div>

      <div className="space-y-3 sm:space-y-4">
        <CalcPreview result={result} property={property} nights={nights} />
        <button type="submit" className="btn-primary" disabled={pending || !ready}>
          {pending ? "Saving..." : "Log stay"}
          {!pending && result.amountDue > 0 ? ` ${money(result.amountDue)}` : ""}
        </button>
      </div>
    </form>
  );
}
