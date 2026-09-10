import type { FeeTreatment } from "./calc.ts";
import type { ContractStatus, InvoiceStatus, Lifecycle } from "./booking-state.ts";

export type Property = {
  id: string;
  name: string;
  ownerSharePct: number;
  commissionPct: number;
  feeTreatment: FeeTreatment;
  turnaroundDays: number;
};

export type Customer = {
  id: string;
  firstName: string | null;
  lastName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomerInput = {
  firstName: string | null;
  lastName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
};

/** Named weekend. `startDate` is check-in, `endDate` is check-out. */
export type EventRecord = {
  id: string;
  name: string;
  year: number;
  startDate: string;
  endDate: string;
  eventType: string;
  /** Flat rental rate for the whole stay. Nights do not affect price. */
  suggestedRate: number | null;
  suggestedNightlyRate: number | null;
  notes: string | null;
};

export type EventPropertyRate = {
  eventId: string;
  propertyId: string;
  suggestedRate: number;
  suggestedNightlyRate: number | null;
};

export type Payment = {
  id: string;
  bookingId: string;
  amount: number;
  receivedAt: string;
  method: string | null;
  note: string | null;
};

export type Booking = {
  id: string;
  propertyId: string;
  propertyName: string;
  customerId: string;
  customerName: string;
  eventId: string | null;
  eventName: string | null;
  checkIn: string;
  checkOut: string;
  nights: number;
  /** Snapshotted at insert, same principle as the rate terms. */
  turnaroundDays: number;
  /** Derived from the entered stay total. Display only. */
  nightlyRate: number;
  fees: number;
  subtotal: number;
  ownerSharePct: number;
  commissionPct: number;
  feeTreatment: FeeTreatment;
  managerCommission: number;
  ownerDue: number;
  coownerDue: number;
  taxAmount: number | null;
  amountDue: number;
  /** Summed from the payments table. */
  amountReceived: number;
  lifecycle: Lifecycle;
  holdExpiresAt: string | null;
  contractStatus: ContractStatus;
  contractSentAt: string | null;
  contractSignedAt: string | null;
  invoiceStatus: InvoiceStatus;
  invoiceSentAt: string | null;
  depositReceivedAt: string | null;
  paidInFullAt: string | null;
  notes: string | null;
  createdAt: string;
  /** Bumped on every save; used to remount edit forms with fresh defaults. */
  updatedAt: string;
};

export type NewBooking = {
  propertyId: string;
  customerId: string;
  eventId: string | null;
  checkIn: string;
  checkOut: string;
  /** Flat total revenue for the whole stay. */
  roomRevenue: number;
  nights: number;
  fees: number;
  taxAmount: number | null;
  amountReceived: number;
  notes: string | null;
  /** Shortcut for the common case: contract signed and paid in full at entry. */
  confirmed: boolean;
};

/** Just enough of a booking to compute blocking, for calendars and availability. */
export type BookingWindow = {
  id: string;
  propertyId: string;
  checkIn: string;
  checkOut: string;
  turnaroundDays: number;
  lifecycle: Lifecycle;
  contractStatus: ContractStatus;
  invoiceStatus: InvoiceStatus;
  customerName: string;
};
