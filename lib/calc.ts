/**
 * Booking math. Pure and dependency-free so the exact same function runs in the
 * browser for the live preview and on the server as the authoritative source of
 * the values that get stored.
 *
 * All arithmetic is done in integer cents and rounded once, and the co-owner
 * share is derived by subtraction, so the parts always reconcile to the whole.
 */

/** Where a fee ends up. Snapshotted per booking so history never shifts. */
export type FeeTreatment =
  /** Manager keeps it to cover a cost, e.g. card processing or insurance. */
  | "manager"
  /** Passed through to the owners, added to the pool before the ownership split. */
  | "owner"
  /** Folded into the subtotal, so commission is charged on it. */
  | "commissionable";

export const FEE_TREATMENTS: FeeTreatment[] = ["manager", "owner", "commissionable"];

export function isFeeTreatment(value: unknown): value is FeeTreatment {
  return typeof value === "string" && (FEE_TREATMENTS as string[]).includes(value);
}

export type RateTerms = {
  /** 0-100. Ownership share, used both in the commission formula and to split the remainder. */
  ownerSharePct: number;
  /** 0-100. Manager's cut. */
  commissionPct: number;
  feeTreatment: FeeTreatment;
};

export type CalcInput = RateTerms & {
  /** Total revenue for the whole stay, as entered. Not a nightly figure. */
  roomRevenue: number;
  nights: number;
  fees: number;
  taxAmount: number | null;
};

export type CalcResult = {
  roomRevenue: number;
  /** Derived for display only. Never used as the basis for any other figure. */
  nightlyRate: number;
  fees: number;
  subtotal: number;
  managerCommission: number;
  /** Fees the manager retains to cover a cost. Zero unless treatment is "manager". */
  managerFees: number;
  managerTotal: number;
  /** What is left after commission, before the ownership split. */
  ownerPool: number;
  ownerDue: number;
  coownerDue: number;
  taxAmount: number;
  /** Gross owed by the guest. */
  amountDue: number;
};

const toCents = (n: number): number => Math.round((Number.isFinite(n) ? n : 0) * 100);
const toDollars = (cents: number): number => cents / 100;

export function calculate(input: CalcInput): CalcResult {
  const nights = Math.max(0, Math.trunc(input.nights) || 0);
  const roomCents = toCents(input.roomRevenue);
  const feeCents = toCents(input.fees);
  const taxCents = toCents(input.taxAmount ?? 0);

  const treatment = input.feeTreatment;
  const subtotalCents = treatment === "commissionable" ? roomCents + feeCents : roomCents;
  const ownerFeeCents = treatment === "owner" ? feeCents : 0;
  const managerFeeCents = treatment === "manager" ? feeCents : 0;

  // Commission comes off the top of the subtotal. Both percentages are applied
  // in one step so there is no intermediate rounding between them.
  const commissionCents = Math.round(
    (subtotalCents * input.ownerSharePct * input.commissionPct) / 10_000,
  );

  // Everything left after commission is split by ownership share.
  const poolCents = subtotalCents - commissionCents + ownerFeeCents;
  const ownerDueCents = Math.round((poolCents * input.ownerSharePct) / 100);
  const coownerDueCents = poolCents - ownerDueCents;

  const guestFeeCents = treatment === "commissionable" ? 0 : feeCents;

  return {
    roomRevenue: toDollars(roomCents),
    nightlyRate: nights > 0 ? toDollars(Math.round(roomCents / nights)) : 0,
    fees: toDollars(feeCents),
    subtotal: toDollars(subtotalCents),
    managerCommission: toDollars(commissionCents),
    managerFees: toDollars(managerFeeCents),
    managerTotal: toDollars(commissionCents + managerFeeCents),
    ownerPool: toDollars(poolCents),
    ownerDue: toDollars(ownerDueCents),
    coownerDue: toDollars(coownerDueCents),
    taxAmount: toDollars(taxCents),
    amountDue: toDollars(subtotalCents + guestFeeCents + taxCents),
  };
}

/** Whole nights between two YYYY-MM-DD dates. Parsed as UTC so DST never shifts the count. */
export function nightsBetween(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  const a = Date.parse(`${checkIn}T00:00:00Z`);
  const b = Date.parse(`${checkOut}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  const nights = Math.round((b - a) / 86_400_000);
  return nights > 0 ? nights : 0;
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function money(n: number): string {
  return usd.format(Number.isFinite(n) ? n : 0);
}

export type PaymentStatus = "paid" | "partial" | "unpaid";

export function paymentStatus(amountDue: number, amountReceived: number): PaymentStatus {
  const due = toCents(amountDue);
  const received = toCents(amountReceived);
  if (received <= 0) return "unpaid";
  if (received >= due) return "paid";
  return "partial";
}
