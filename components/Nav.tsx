"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Log a Stay" },
  { href: "/availability", label: "Availability" },
  { href: "/calendar", label: "Calendar" },
  { href: "/stays", label: "Stays" },
  { href: "/customers", label: "Customers" },
  { href: "/events", label: "Events" },
  { href: "/settings", label: "Settings" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-slate-200 bg-white">
      {/* Scrolls horizontally on a phone rather than wrapping into a tall block. */}
      <div className="mx-auto flex w-full max-w-5xl gap-1 overflow-x-auto px-2 py-2 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]{display:none}">
        {LINKS.map((link) => {
          const active =
            link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition ${
                active
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
