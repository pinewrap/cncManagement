"use client";

import { useEffect, useState } from "react";

type Product = {
  id: string;
  sku: string | null;
  name: string;
  defaultPrice: string;
  baseUnit: string;
  purchaseUnit: string | null;
  unitsPerPurchaseUnit: number;
  reorderLevel: number | null;
  currentQuantity: number;
};

const emptyForm = {
  name: "",
  sku: "",
  defaultActivity: "",
  defaultPrice: "",
  baseUnit: "",
  purchaseUnit: "",
  unitsPerPurchaseUnit: "1",
  reorderLevel: "",
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/products");
    setProducts(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        sku: form.sku || undefined,
        defaultActivity: form.defaultActivity || undefined,
        defaultPrice: parseFloat(form.defaultPrice),
        baseUnit: form.baseUnit,
        purchaseUnit: form.purchaseUnit || undefined,
        unitsPerPurchaseUnit: parseInt(form.unitsPerPurchaseUnit, 10) || 1,
        reorderLevel: form.reorderLevel ? parseInt(form.reorderLevel, 10) : undefined,
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
        <h1 className="text-2xl font-semibold">Inventory</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded bg-brand px-3 py-1.5 text-sm text-white hover:opacity-90"
        >
          {showForm ? "Cancel" : "+ Add product"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="grid gap-3 rounded-lg border bg-white p-4 sm:grid-cols-2">
          <input
            required
            placeholder="Product name"
            className="rounded border px-3 py-2"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            placeholder="SKU (optional)"
            className="rounded border px-3 py-2"
            value={form.sku}
            onChange={(e) => setForm({ ...form, sku: e.target.value })}
          />
          <input
            placeholder="Default activity (e.g. Grease-Pail)"
            className="rounded border px-3 py-2"
            value={form.defaultActivity}
            onChange={(e) => setForm({ ...form, defaultActivity: e.target.value })}
          />
          <input
            required
            type="number"
            step="0.01"
            placeholder="Default price"
            className="rounded border px-3 py-2"
            value={form.defaultPrice}
            onChange={(e) => setForm({ ...form, defaultPrice: e.target.value })}
          />
          <input
            required
            placeholder="Base unit (e.g. bottle, pail)"
            className="rounded border px-3 py-2"
            value={form.baseUnit}
            onChange={(e) => setForm({ ...form, baseUnit: e.target.value })}
          />
          <input
            placeholder="Purchase unit (e.g. box) — optional"
            className="rounded border px-3 py-2"
            value={form.purchaseUnit}
            onChange={(e) => setForm({ ...form, purchaseUnit: e.target.value })}
          />
          <input
            type="number"
            placeholder="Units per purchase unit (e.g. 24)"
            className="rounded border px-3 py-2"
            value={form.unitsPerPurchaseUnit}
            onChange={(e) => setForm({ ...form, unitsPerPurchaseUnit: e.target.value })}
          />
          <input
            type="number"
            placeholder="Reorder level (optional)"
            className="rounded border px-3 py-2"
            value={form.reorderLevel}
            onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })}
          />
          <button
            disabled={saving}
            className="rounded bg-brand px-3 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save product"}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : products.length === 0 ? (
        <p className="text-gray-500">No products yet — add your first one above.</p>
      ) : (
        <table className="w-full overflow-hidden rounded-lg border bg-white text-sm">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">SKU</th>
              <th className="p-3">Unit</th>
              <th className="p-3">Price</th>
              <th className="p-3">Current Qty</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const low = p.reorderLevel != null && p.currentQuantity <= p.reorderLevel;
              return (
                <tr key={p.id} className="border-t">
                  <td className="p-3">{p.name}</td>
                  <td className="p-3 text-gray-500">{p.sku ?? "-"}</td>
                  <td className="p-3">{p.baseUnit}</td>
                  <td className="p-3">${Number(p.defaultPrice).toFixed(2)}</td>
                  <td className={`p-3 font-medium ${low ? "text-red-600" : ""}`}>
                    {p.currentQuantity}
                    {low && " (low)"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </main>
  );
}
