"use client";

import { useEffect, useMemo, useState } from "react";
import CustomerSearch from "@/components/CustomerSearch";

type Province = { province: string; taxType: string };
type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  street: string | null;
  city: string | null;
  postalCode: string | null;
  createdAt: string;
  province: Province | null;
};
type ProductSummary = { description: string; activity: string; totalQty: number; totalAmount: number };
type InvoiceSummary = { id: string; invoiceNumber: string; invoiceDate: string; paymentStatus: string; total: number };
type CustomerDetail = {
  invoiceCount: number;
  totalSpend: number;
  subtotal: number;
  products: ProductSummary[];
  invoices: InvoiceSummary[];
};

const emptyForm = { name: "", phone: "", email: "", street: "", city: "", postalCode: "", provinceId: "" };
type SortKey = "name-asc" | "name-desc" | "date-newest" | "date-oldest";

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoaded, setCustomersLoaded] = useState(false);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [sort, setSort] = useState<SortKey>("name-asc");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Lookup panel state
  const [showLookup, setShowLookup] = useState(false);
  const [lookupCustomerId, setLookupCustomerId] = useState("");
  const [lookupMonths, setLookupMonths] = useState(3);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<CustomerDetail | null>(null);

  // Only provinces load on mount — tiny, static reference data the "add
  // customer" form needs regardless. The customer list itself (can grow
  // large) is deferred to an explicit Refresh click instead.
  useEffect(() => {
    fetch("/api/provinces").then((r) => r.json()).then(setProvinces);
  }, []);

  async function loadCustomers() {
    setCustomersLoading(true);
    const res = await fetch("/api/customers");
    setCustomers(await res.json());
    setCustomersLoading(false);
    setCustomersLoaded(true);
  }

  const sorted = useMemo(() => {
    return [...customers].sort((a, b) => {
      if (sort === "name-asc") return a.name.localeCompare(b.name);
      if (sort === "name-desc") return b.name.localeCompare(a.name);
      if (sort === "date-newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }, [customers, sort]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        phone: form.phone || undefined,
        email: form.email || undefined,
        street: form.street || undefined,
        city: form.city || undefined,
        postalCode: form.postalCode || undefined,
        provinceId: form.provinceId || undefined,
      }),
    });
    const created = await res.json();
    setCustomers((c) => [...c, created]);
    setCustomersLoaded(true); // the list is now meaningfully non-empty/known, even without a manual refresh
    setSaving(false);
    setForm(emptyForm);
    setShowForm(false);
  }

  async function handleDelete(customer: Customer) {
    if (!confirm(`Delete "${customer.name}"? This can't be undone.`)) return;
    setDeletingId(customer.id);
    const res = await fetch(`/api/customers/${customer.id}`, { method: "DELETE" });
    setDeletingId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Couldn't delete this customer.");
      return;
    }
    setCustomers((prev) => prev.filter((c) => c.id !== customer.id));
  }

  async function handleLookup() {
    if (!lookupCustomerId) return;
    setLookupLoading(true);
    setLookupResult(null);
    const res = await fetch(`/api/customers/${lookupCustomerId}?months=${lookupMonths}`);
    setLookupResult(await res.json());
    setLookupLoading(false);
  }

  const lookupCustomer = customers.find((c) => c.id === lookupCustomerId);

  return (
    <main className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Customers</h1>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowLookup((s) => !s); setLookupResult(null); }}
            className="rounded border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            {showLookup ? "Close" : "Lookup"}
          </button>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="rounded bg-brand px-3 py-1.5 text-sm text-brand-navy hover:opacity-90"
          >
            {showForm ? "Cancel" : "+ Add customer"}
          </button>
        </div>
      </div>

      {/* Add customer form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="grid gap-3 rounded-lg border bg-white p-4 sm:grid-cols-2">
          <input required placeholder="Customer name" className="rounded border px-3 py-2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input placeholder="Phone" className="rounded border px-3 py-2" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input placeholder="Email" className="rounded border px-3 py-2" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input placeholder="Street address" className="rounded border px-3 py-2" value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} />
          <input placeholder="City" className="rounded border px-3 py-2" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          <input placeholder="Postal code" className="rounded border px-3 py-2" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} />
          <select required className="rounded border px-3 py-2" value={form.provinceId} onChange={(e) => setForm({ ...form, provinceId: e.target.value })}>
            <option value="">Select province...</option>
            {provinces.map((p) => (
              <option key={p.province} value={p.province}>{p.province} ({p.taxType})</option>
            ))}
          </select>
          <button disabled={saving} className="rounded bg-brand px-3 py-2 text-sm text-brand-navy hover:opacity-90 disabled:opacity-50">
            {saving ? "Saving..." : "Save customer"}
          </button>
        </form>
      )}

      {/* Lookup panel */}
      {showLookup && (
        <div className="rounded-lg border bg-white p-4">
          <h2 className="mb-3 font-medium">Customer Lookup</h2>
          {!customersLoaded ? (
            <p className="text-sm text-gray-400">Click Refresh below to load customers first.</p>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-48">
                <label className="mb-1 block text-xs text-gray-500">Customer</label>
                <CustomerSearch
                  customers={[...customers].sort((a, b) => a.name.localeCompare(b.name))}
                  value={lookupCustomerId}
                  onChange={(id) => { setLookupCustomerId(id); setLookupResult(null); }}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Period</label>
                <select
                  className="rounded border px-3 py-2 text-sm"
                  value={lookupMonths}
                  onChange={(e) => { setLookupMonths(Number(e.target.value)); setLookupResult(null); }}
                >
                  <option value={1}>Last 1 month</option>
                  <option value={3}>Last 3 months</option>
                  <option value={6}>Last 6 months</option>
                  <option value={12}>Last 12 months</option>
                </select>
              </div>
              <button
                disabled={!lookupCustomerId || lookupLoading}
                onClick={handleLookup}
                className="rounded bg-brand px-4 py-2 text-sm text-brand-navy hover:opacity-90 disabled:opacity-40"
              >
                {lookupLoading ? "Loading..." : "Fetch"}
              </button>
            </div>
          )}

          {/* Results */}
          {lookupResult && (
            <div className="mt-4">
              <div className="mb-3 text-sm font-medium text-gray-700">
                {lookupCustomer?.name} — last {lookupMonths} month{lookupMonths !== 1 ? "s" : ""}
              </div>

              {lookupResult.invoiceCount === 0 ? (
                <p className="text-sm text-gray-400">No invoices in this period.</p>
              ) : (
                <>
                  <div className="mb-4 flex gap-6 text-sm">
                    <div><div className="text-gray-500">Invoices</div><div className="font-semibold">{lookupResult.invoiceCount}</div></div>
                    <div><div className="text-gray-500">Subtotal</div><div className="font-semibold">${lookupResult.subtotal.toFixed(2)}</div></div>
                    <div><div className="text-gray-500">Total (incl. tax)</div><div className="font-semibold">${lookupResult.totalSpend.toFixed(2)}</div></div>
                  </div>

                  <div className="mb-4">
                    <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Products sold</div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs text-gray-500">
                          <th className="pb-1 pr-4">Product</th>
                          <th className="pb-1 pr-4">Package</th>
                          <th className="pb-1 pr-4 text-right">Qty</th>
                          <th className="pb-1 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lookupResult.products.map((p, i) => (
                          <tr key={i} className="border-b last:border-0">
                            <td className="py-1.5 pr-4">{p.description}</td>
                            <td className="py-1.5 pr-4 text-gray-500">{p.activity || "—"}</td>
                            <td className="py-1.5 pr-4 text-right">{p.totalQty}</td>
                            <td className="py-1.5 text-right">${p.totalAmount.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div>
                    <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Invoices</div>
                    <div className="flex flex-col gap-1">
                      {lookupResult.invoices.map((inv) => {
                        const isPaid = inv.paymentStatus === "PAID";
                        return (
                          <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2 text-sm">
                            <span className="font-mono font-semibold text-brand-navy">{inv.invoiceNumber}</span>
                            <span className="text-gray-500">{fmtDate(inv.invoiceDate)}</span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                isPaid ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {isPaid ? "Paid" : "Unpaid"}
                            </span>
                            <span className="font-semibold">${inv.total.toFixed(2)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sort controls + Refresh */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-gray-500">Sort:</span>
          {([["name-asc", "Name A→Z"], ["name-desc", "Name Z→A"], ["date-newest", "Newest"], ["date-oldest", "Oldest"]] as [SortKey, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSort(key)}
              className={`rounded px-2.5 py-1 ${sort === key ? "bg-brand text-brand-navy" : "border text-gray-600 hover:bg-gray-50"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={loadCustomers}
          disabled={customersLoading}
          className="rounded border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {customersLoading ? "Loading..." : customersLoaded ? "Refresh" : "Load customers"}
        </button>
      </div>

      {/* Customer table */}
      {!customersLoaded ? (
        <div className="rounded-lg border bg-white p-6 text-center text-sm text-gray-400">
          Click &quot;Load customers&quot; above to fetch the list.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
        <table className="w-full bg-white text-sm">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Phone</th>
              <th className="p-3">City</th>
              <th className="p-3">Province</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-3">{c.name}</td>
                <td className="p-3 whitespace-nowrap text-gray-500">{c.phone ?? "—"}</td>
                <td className="p-3">{c.city ?? "—"}</td>
                <td className="p-3">{c.province?.province ?? "—"}</td>
                <td className="p-3 text-right">
                  <button
                    disabled={deletingId === c.id}
                    onClick={() => handleDelete(c)}
                    className="text-xs text-red-600 underline disabled:opacity-50"
                  >
                    {deletingId === c.id ? "..." : "Delete"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </main>
  );
}
