import Nav from "@/components/Nav";
import { requireAuth } from "@/lib/auth";
import { logout } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 pt-4 sm:px-6">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Suite South
            <span className="ml-2 hidden text-sm font-normal text-slate-400 sm:inline">
              Booking Log
            </span>
          </h1>
          <form action={logout}>
            <button type="submit" className="btn-quiet">
              Sign out
            </button>
          </form>
        </div>
        <Nav />
      </header>
      {children}
    </div>
  );
}
