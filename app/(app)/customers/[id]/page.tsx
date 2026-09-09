import Link from "next/link";
import { notFound } from "next/navigation";
import BookingsTable from "@/components/BookingsTable";
import { getCustomer } from "@/lib/db/customers";
import { listBookings } from "@/lib/db/bookings";
import { loadSettings } from "@/lib/db/settings";
import { saveCustomer } from "../actions";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [customer, bookings, settings] = await Promise.all([
    getCustomer(id),
    listBookings({ customerId: id }),
    loadSettings(),
  ]);

  if (!customer) notFound();

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <Link href="/customers" className="text-sm text-slate-500 hover:underline">
        Back to customers
      </Link>

      <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
        {customer.firstName ? `${customer.firstName} ${customer.lastName}` : customer.lastName}
      </h2>

      <form
        action={saveCustomer}
        className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <input type="hidden" name="id" value={customer.id} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="first_name">
              First name
            </label>
            <input
              id="first_name"
              name="first_name"
              defaultValue={customer.firstName ?? ""}
              className="field"
            />
          </div>
          <div>
            <label className="label" htmlFor="last_name">
              Last name
            </label>
            <input
              id="last_name"
              name="last_name"
              defaultValue={customer.lastName}
              className="field"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="phone">
              Phone
            </label>
            <input
              id="phone"
              name="phone"
              inputMode="tel"
              defaultValue={customer.phone ?? ""}
              className="field"
            />
          </div>
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              defaultValue={customer.email ?? ""}
              className="field"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="address">
              Address
            </label>
            <input
              id="address"
              name="address"
              defaultValue={customer.address ?? ""}
              className="field"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="notes">
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              defaultValue={customer.notes ?? ""}
              className="field"
            />
          </div>
        </div>
        <button type="submit" className="btn-primary mt-3">
          Save customer
        </button>
      </form>

      <section className="mt-8">
        <h3 className="mb-3 text-lg font-semibold text-slate-900">
          Booking history
          <span className="ml-2 text-sm font-normal text-slate-500">{bookings.length}</span>
        </h3>
        <BookingsTable
          bookings={bookings}
          requireSignatureForBooked={settings.requireSignatureForBooked}
          emptyMessage="No stays logged for this customer yet."
        />
      </section>
    </main>
  );
}
