import Link from "next/link";
import NewCustomerForm from "@/components/NewCustomerForm";
import { listCustomers } from "@/lib/db/customers";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined): string =>
  Array.isArray(v) ? (v[0] ?? "") : (v ?? "");

export default async function CustomersPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const query = one(sp.q);
  const customers = await listCustomers(query);

  // Opening the form is a URL, so it survives a reload and keeps the search.
  const addParams = new URLSearchParams();
  if (query) addParams.set("q", query);
  addParams.set("add", "1");
  const addHref = `/customers?${addParams.toString()}#add`;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">
          Customers
          <span className="ml-2 text-sm font-normal text-slate-500">{customers.length}</span>
        </h2>
        <a href={addHref} className="btn-add">
          Add
        </a>
      </div>

      <form method="get" className="flex items-center gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search name or phone"
          className="field py-2 text-sm sm:py-2 sm:text-sm"
          aria-label="Search customers"
        />
        <button type="submit" className="btn-add w-auto">
          Search
        </button>
      </form>

      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {customers.map((c) => (
          <li key={c.id}>
            <Link
              href={`/customers/${c.id}`}
              className="flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm hover:border-slate-300"
            >
              <span className="font-medium text-slate-900">
                {c.firstName ? `${c.firstName} ${c.lastName}` : c.lastName}
              </span>
            </Link>
          </li>
        ))}
        {customers.length === 0 ? (
          <li className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-slate-500">
            No customers match that search.
          </li>
        ) : null}
      </ul>

      <div className="mt-6">
        <NewCustomerForm defaultOpen={one(sp.add) === "1"} />
      </div>
    </main>
  );
}
