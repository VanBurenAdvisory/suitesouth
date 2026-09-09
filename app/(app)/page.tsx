import BookingForm from "@/components/BookingForm";
import BookingsTable from "@/components/BookingsTable";
import { isValidDate } from "@/lib/dates";
import { listBookings } from "@/lib/db/bookings";
import { listCustomers } from "@/lib/db/customers";
import { listProperties } from "@/lib/db/properties";
import { loadSettings } from "@/lib/db/settings";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined): string =>
  Array.isArray(v) ? (v[0] ?? "") : (v ?? "");

export default async function LogAStayPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;

  const [properties, customers, bookings, settings] = await Promise.all([
    listProperties(),
    listCustomers(),
    listBookings(),
    loadSettings(),
  ]);

  // Arriving from a calendar selection, so the dates are already decided.
  const from = one(sp.from);
  const to = one(sp.to);
  const propertyParam = one(sp.property);
  const prefilled = isValidDate(from) && isValidDate(to) && to > from;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <BookingForm
          properties={properties}
          customers={customers}
          initialPropertyId={properties.some((p) => p.id === propertyParam) ? propertyParam : undefined}
          initialCheckIn={prefilled ? from : undefined}
          initialCheckOut={prefilled ? to : undefined}
        />
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">
          Recent stays
          <span className="ml-2 text-sm font-normal text-slate-500">{bookings.length} logged</span>
        </h2>
        <BookingsTable
          bookings={bookings.slice(0, 10)}
          requireSignatureForBooked={settings.requireSignatureForBooked}
        />
      </section>
    </main>
  );
}
