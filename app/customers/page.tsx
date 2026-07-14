"use client";

import { useEffect, useState } from "react";

type Province = { province: string; taxType: string };
type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  street: string | null;
  city: string | null;
  postalCode: string | null;
  province: Province | null;
};

const emptyForm = {
  name: "",
  phone: "",
  email: "",
  street: "",
  city: "",
  postalCode: "",
  provinceId: "",
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    const [custRes, provRes] = await Promise.all([fetch("/api/customers"), fetch("/api/provinces")]);
    setCustomers(await custRes.json());
    setProvinces(await provRes.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/customers", {
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
    setSaving(false);
    setForm(emptyForm);
    setShowForm(false);
    load();
  }

  return (
    <main className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Customers</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded bg-brand px-3 py-1.5 text-sm text-white hover:opacity-90"
        >
          {showForm ? "Cancel" : "+ Add customer"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="grid gap-3 rounded-lg border bg-white p-4 sm:grid-cols-2">
          <input
            required
            placeholder="Customer name"
            className="rounded border px-3 py-2"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            placeholder="Phone"
            className="rounded border px-3 py-2"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <input
            placeholder="Email"
            className="rounded border px-3 py-2"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <input
            placeholder="Street address"
            className="rounded border px-3 py-2"
            value={form.street}
            onChange={(e) => setForm({ ...form, street: e.target.value })}
          />
          <input
            placeholder="City"
            className="rounded border px-3 py-2"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
          />
          <input
            placeholder="Postal code"
            className="rounded border px-3 py-2"
            value={form.postalCode}
            onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
          />
          <select
            required
            className="rounded border px-3 py-2"
            value={form.provinceId}
            onChange={(e) => setForm({ ...form, provinceId: e.target.value })}
          >
            <option value="">Select province...</option>
            {provinces.map((p) => (
              <option key={p.province} value={p.province}>
                {p.province} ({p.taxType})
              </option>
            ))}
          </select>
          <button
            disabled={saving}
            className="rounded bg-brand px-3 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save customer"}
          </button>
        </form>
      )}

      <table className="w-full overflow-hidden rounded-lg border bg-white text-sm">
        <thead className="bg-gray-100 text-left">
          <tr>
            <th className="p-3">Name</th>
            <th className="p-3">Phone</th>
            <th className="p-3">City</th>
            <th className="p-3">Province</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((c) => (
            <tr key={c.id} className="border-t">
              <td className="p-3">{c.name}</td>
              <td className="p-3 text-gray-500">{c.phone ?? "-"}</td>
              <td className="p-3">{c.city ?? "-"}</td>
              <td className="p-3">{c.province?.province ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
