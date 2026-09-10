/**
 * Derived booking state. Pure and isolated so the rules are cheap to change.
 *
 * Two independent tracks are stored on the booking (contract and invoice) plus
 * a lifecycle. What the UI shows is computed from all three, never stored, so
 * there is no state to get out of sync with the underlying timestamps.
 */

export type Lifecycle = "hold" | "active" | "cancelled";
export type ContractStatus = "not_sent" | "sent" | "signed" | "standing";
export type InvoiceStatus = "not_sent" | "sent" | "deposit_received" | "paid_in_full";
export type DerivedState = "hold" | "committed" | "booked" | "confirmed" | "cancelled";

export const LIFECYCLES: Lifecycle[] = ["hold", "active", "cancelled"];
export const CONTRACT_STATUSES: ContractStatus[] = ["not_sent", "sent", "signed", "standing"];
export const INVOICE_STATUSES: InvoiceStatus[] = [
  "not_sent",
  "sent",
  "deposit_received",
  "paid_in_full",
];

export type StateInput = {
  lifecycle: Lifecycle;
  contractStatus: ContractStatus;
  invoiceStatus: InvoiceStatus;
};

export type StateOptions = {
  /**
   * When true (the default, and the `require_signature_for_booked` setting),
   * money alone never advances past Committed. Turn it off to let a deposit or
   * full payment promote the state regardless of signature.
   */
  requireSignatureForBooked?: boolean;
};

/**
 * Total function: ordered checks, and anything unmatched falls through to hold.
 * That covers the cases the plain rules leave open, such as a deposit arriving
 * before any contract went out.
 */
export function deriveState(b: StateInput, opts: StateOptions = {}): DerivedState {
  if (b.lifecycle === "cancelled") return "cancelled";

  const requireSignature = opts.requireSignatureForBooked ?? true;
  // A standing agreement covers the stay as fully as a fresh signature does.
  const covered = b.contractStatus === "signed" || b.contractStatus === "standing";
  const paperworkOk = requireSignature ? covered : true;

  if (paperworkOk && b.invoiceStatus === "paid_in_full") return "confirmed";
  if (paperworkOk && b.invoiceStatus === "deposit_received") return "booked";
  if (b.contractStatus !== "not_sent") return "committed";
  return "hold";
}

/** A hold whose expiry has passed. Rendered as a badge, not a sixth state. */
export function isStaleHold(
  b: { lifecycle: Lifecycle; holdExpiresAt: string | null },
  today: string,
): boolean {
  return b.lifecycle === "hold" && b.holdExpiresAt !== null && b.holdExpiresAt < today;
}

/** Cancelled bookings block nothing, anywhere. */
export function blocksAvailability(b: { lifecycle: Lifecycle }): boolean {
  return b.lifecycle !== "cancelled";
}

export const STATE_LABELS: Record<DerivedState, string> = {
  hold: "Hold",
  committed: "Committed",
  booked: "Booked",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
};

/**
 * Shared across the calendar, the stays list, and the availability screen.
 * `text` is the readable foreground for a label sitting on top of `bar`.
 */
export const STATE_STYLES: Record<DerivedState, { chip: string; bar: string; text: string }> = {
  hold: {
    chip: "border-slate-200 bg-slate-100 text-slate-600",
    bar: "bg-slate-300",
    text: "text-slate-700",
  },
  committed: {
    chip: "border-amber-200 bg-amber-50 text-amber-900",
    bar: "bg-amber-400",
    text: "text-amber-950",
  },
  booked: {
    chip: "border-sky-200 bg-sky-50 text-sky-800",
    bar: "bg-sky-500",
    text: "text-white",
  },
  confirmed: {
    chip: "border-emerald-200 bg-emerald-50 text-emerald-800",
    bar: "bg-emerald-600",
    text: "text-white",
  },
  cancelled: {
    chip: "border-slate-200 bg-white text-slate-400 line-through",
    bar: "bg-slate-200",
    text: "text-slate-500",
  },
};

export const CONTRACT_LABELS: Record<ContractStatus, string> = {
  not_sent: "Not sent",
  sent: "Sent",
  signed: "Signed",
  standing: "Standing agreement",
};

export const INVOICE_LABELS: Record<InvoiceStatus, string> = {
  not_sent: "Not sent",
  sent: "Sent",
  deposit_received: "Deposit received",
  paid_in_full: "Paid in full",
};

/**
 * The timestamp column each status implies. Kept here so a future inbound-email
 * parser can set a status and stamp the matching column without duplicating
 * this mapping.
 */
export const CONTRACT_TIMESTAMP: Record<ContractStatus, string | null> = {
  not_sent: null,
  sent: "contract_sent_at",
  signed: "contract_signed_at",
  // A standing agreement was not signed for this stay, so nothing is stamped.
  standing: null,
};

export const INVOICE_TIMESTAMP: Record<InvoiceStatus, string | null> = {
  not_sent: null,
  sent: "invoice_sent_at",
  deposit_received: "deposit_received_at",
  paid_in_full: "paid_in_full_at",
};
