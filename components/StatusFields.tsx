"use client";

import { useState } from "react";
import {
  CONTRACT_LABELS,
  CONTRACT_STATUSES,
  INVOICE_LABELS,
  INVOICE_STATUSES,
  type ContractStatus,
  type InvoiceStatus,
} from "@/lib/booking-state";

/**
 * Both tracks in one form with a single Save. The Confirmed checkbox is a
 * shortcut that sets the selects in front of you rather than overriding them
 * on the server, so what you see is what gets saved. Unchecking puts back the
 * values that were there before.
 */
export default function StatusFields({
  contractStatus,
  invoiceStatus,
}: {
  contractStatus: ContractStatus;
  invoiceStatus: InvoiceStatus;
}) {
  const [contract, setContract] = useState<ContractStatus>(contractStatus);
  const [invoice, setInvoice] = useState<InvoiceStatus>(invoiceStatus);

  const isConfirmed = contract === "signed" && invoice === "paid_in_full";

  function toggleConfirmed(checked: boolean) {
    if (checked) {
      setContract("signed");
      setInvoice("paid_in_full");
    } else {
      setContract(contractStatus === "signed" ? "not_sent" : contractStatus);
      setInvoice(invoiceStatus === "paid_in_full" ? "not_sent" : invoiceStatus);
    }
  }

  return (
    <div className="mt-3 space-y-3">
      <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <input
          type="checkbox"
          checked={isConfirmed}
          onChange={(e) => toggleConfirmed(e.target.checked)}
          className="mt-0.5 size-5 shrink-0 rounded border-slate-300"
        />
        <span className="text-sm font-medium text-slate-800">
          Confirmed
          <span className="block text-xs font-normal text-slate-500">
            Contract signed and paid in full.
          </span>
        </span>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="contract_status">
            Contract
          </label>
          <select
            id="contract_status"
            name="contract_status"
            value={contract}
            onChange={(e) => setContract(e.target.value as ContractStatus)}
            className="field"
          >
            {CONTRACT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {CONTRACT_LABELS[s]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="invoice_status">
            Invoice
          </label>
          <select
            id="invoice_status"
            name="invoice_status"
            value={invoice}
            onChange={(e) => setInvoice(e.target.value as InvoiceStatus)}
            className="field"
          >
            {INVOICE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {INVOICE_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button type="submit" className="btn-primary">
        Save status
      </button>
    </div>
  );
}
