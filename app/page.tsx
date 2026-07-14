import Link from "next/link";

const sections = [
  { href: "/invoices/new", label: "Create Invoice", desc: "Build a new invoice for a customer" },
  { href: "/products", label: "Inventory", desc: "View stock levels and manage products" },
  { href: "/stock", label: "Stock", desc: "Log stock received or adjustments" },
  { href: "/invoices", label: "Invoices", desc: "View and download past invoices" },
];

export default function Home() {
  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="rounded-lg border border-gray-200 bg-white p-4 hover:border-brand hover:shadow-sm"
          >
            <div className="font-medium text-brand">{s.label}</div>
            <div className="text-sm text-gray-500">{s.desc}</div>
          </Link>
        ))}
      </div>
    </main>
  );
}
