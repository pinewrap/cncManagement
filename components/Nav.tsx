"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/stock", label: "Stock" },
  { href: "/invoices", label: "Invoices" },
  { href: "/customers", label: "Customers" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="bg-brand shadow-sm">
      <div className="mx-auto max-w-4xl px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
          <Link href="/" className="mr-3 flex items-center gap-2">
            <Image src="/icon-192.png" alt="CNC Lubricants" width={36} height={36} className="rounded" />
            <span className="hidden font-bold text-brand-navy sm:inline">CNC Grease &amp; Lubricants</span>
          </Link>
          {links.map((link) => {
            const active = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded px-3 py-1.5 text-sm font-medium ${
                  active
                    ? "bg-brand-navy text-white"
                    : "text-brand-navy/80 hover:bg-brand-navy/10"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
