"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/products", label: "Inventory" },
  { href: "/stock", label: "Stock" },
  { href: "/invoices", label: "Invoices" },
  { href: "/customers", label: "Customers" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="bg-brand text-white">
      <div className="mx-auto flex max-w-4xl items-center gap-1 px-4 py-3">
        <Link href="/" className="mr-4 font-semibold">
          Invoicing App
        </Link>
        {links.map((link) => {
          const active = pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded px-3 py-1.5 text-sm ${
                active ? "bg-white/15 font-medium" : "text-white/80 hover:bg-white/10"
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
