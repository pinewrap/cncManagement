"use client";

import { useEffect, useState } from "react";
import { deriveActivity, deriveDescription } from "@/lib/calculations";

type Product = {
  id: string;
  sku: string | null;
  name: string;
  variant: string | null;
  packageType: string | null;
  packageSize: string | null;
  unit: string;
  unitsPerBox: number | null;
  boxesPerSkid: number | null;
  reorderLevel: string | null;
  currentQuantity: number;
};

const emptyForm = {
  sku: "",
  name: "",
  variant: "",
  packageType: "",
  packageSize: "",
  unit: "",
  unitsPerBox: "",
  boxesPerSkid: "",
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
        sku: form.sku || undefined,
        name: form.name,
        variant: form.variant || undefined,
        packageType: form.packageType || undefined,
        packageSize: form.packageSize ? parseFloat(form.packageSize) : undefined,
        unit: form.unit,
        unitsPerBox: form.unitsPerBox ? parseInt(form.unitsPerBox, 10) : undefined,
        boxesPerSkid: form.boxesPerSkid ? parseInt(form.boxesPerSkid, 10) : undefined,
        reorderLevel: form.reorderLevel ? parseFloat(form.reorderLevel) : undefined,
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
        <form onSubmit={handleSubmit} className="grid gap-3 rounded-lg border bg-white p-4 sm:grid-cols-4">
          <input
            placeholder="Product ID (e.g. ELG-181.4-DRUM)"
            className="rounded border px-3 py-2 sm:col-span-2"
            value={form.sku}
            onChange={(e) => setForm({ ...form, sku: e.target.value })}
          />
          <input
            required
            placeholder="Product name"
            className="rounded border px-3 py-2 sm:col-span-2"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            placeholder="Variant (e.g. 75W90, D3) — optional"
            className="rounded border px-3 py-2"
            value={form.variant}
            onChange={(e) => setForm({ ...form, variant: e.target.value })}
          />
          <input
            placeholder="Package type (Drum, Keg, Bucket...)"
            className="rounded border px-3 py-2"
            value={form.packageType}
            onChange={(e) => setForm({ ...form, packageType: e.target.value })}
          />
          <input
            type="number"
            step="0.001"
            placeholder="Package size (e.g. 181.4)"
            className="rounded border px-3 py-2"
            value={form.packageSize}
            onChange={(e) => setForm({ ...form, packageSize: e.target.value })}
          />
          <input
            required
            placeholder="Unit (KG, L)"
            className="rounded border px-3 py-2"
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
          />
          <input
            type="number"
            placeholder="Units per box — optional"
            className="rounded border px-3 py-2"
            value={form.unitsPerBox}
            onChange={(e) => setForm({ ...form, unitsPerBox: e.target.value })}
          />
          <input
            type="number"
            placeholder="Boxes per skid — optional"
            className="rounded border px-3 py-2"
            value={form.boxesPerSkid}
            onChange={(e) => setForm({ ...form, boxesPerSkid: e.target.value })}
          />
          <input
            type="number"
            step="0.001"
            placeholder="Reorder level — optional"
            className="rounded border px-3 py-2"
            value={form.reorderLevel}
            onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })}
          />
          <button
            disabled={saving}
            className="rounded bg-brand px-3 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50 sm:col-span-4"
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
              <th className="p-3">Product ID</th>
              <th className="p-3">Name</th>
              <th className="p-3">Package</th>
              <th className="p-3">Current Qty</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const low = p.reorderLevel != null && p.currentQuantity <= Number(p.reorderLevel);
              return (
                <tr key={p.id} className="border-t">
                  <td className="p-3 text-gray-500">{p.sku ?? "-"}</td>
                  <td className="p-3">{deriveDescription(p)}</td>
                  <td className="p-3">{deriveActivity(p) || "-"}</td>
                  <td className={`p-3 font-medium ${low ? "text-red-600" : ""}`}>
                    {p.currentQuantity} {p.unit}
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
