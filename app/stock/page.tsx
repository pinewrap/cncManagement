"use client";

import { useEffect, useState } from "react";

type Product = { id: string; name: string; baseUnit: string; purchaseUnit: string | null };
type Txn = {
  id: string;
  txnDate: string;
  txnType: string;
  entryUnit: string;
  entryQuantity: number;
  reference: string | null;
  product: Product;
};

const emptyForm = {
  productId: "",
  txnType: "STOCK_IN",
  entryUnit: "BASE_UNIT",
  entryQuantity: "",
  reference: "",
  notes: "",
};

export default function StockPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Txn[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    const [productsRes, txnsRes] = await Promise.all([
      fetch("/api/products"),
      fetch("/api/stock-transactions"),
    ]);
    setProducts(await productsRes.json());
    setTransactions(await txnsRes.json());
  }

  useEffect(() => {
    load();
  }, []);

  const selectedProduct = products.find((p) => p.id === form.productId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/stock-transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: form.productId,
        txnType: form.txnType,
        entryUnit: form.entryUnit,
        entryQuantity: parseInt(form.entryQuantity, 10),
        reference: form.reference || undefined,
        notes: form.notes || undefined,
      }),
    });
    setSaving(false);
    setForm(emptyForm);
    load();
  }

  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Stock</h1>

      <form onSubmit={handleSubmit} className="grid gap-3 rounded-lg border bg-white p-4 sm:grid-cols-2">
        <select
          required
          className="rounded border px-3 py-2"
          value={form.productId}
          onChange={(e) => setForm({ ...form, productId: e.target.value })}
        >
          <option value="">Select product...</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <select
          className="rounded border px-3 py-2"
          value={form.txnType}
          onChange={(e) => setForm({ ...form, txnType: e.target.value })}
        >
          <option value="STOCK_IN">Stock In</option>
          <option value="STOCK_OUT">Stock Out</option>
          <option value="ADJUSTMENT">Adjustment</option>
        </select>

        <select
          className="rounded border px-3 py-2"
          value={form.entryUnit}
          onChange={(e) => setForm({ ...form, entryUnit: e.target.value })}
        >
          <option value="BASE_UNIT">
            {selectedProduct ? `Base unit (${selectedProduct.baseUnit})` : "Base unit"}
          </option>
          {selectedProduct?.purchaseUnit && (
            <option value="PURCHASE_UNIT">Purchase unit ({selectedProduct.purchaseUnit})</option>
          )}
        </select>

        <input
          required
          type="number"
          placeholder="Quantity"
          className="rounded border px-3 py-2"
          value={form.entryQuantity}
          onChange={(e) => setForm({ ...form, entryQuantity: e.target.value })}
        />

        <input
          placeholder="Reference (optional)"
          className="rounded border px-3 py-2"
          value={form.reference}
          onChange={(e) => setForm({ ...form, reference: e.target.value })}
        />
        <input
          placeholder="Notes (optional)"
          className="rounded border px-3 py-2"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />

        <button
          disabled={saving}
          className="rounded bg-brand px-3 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50 sm:col-span-2"
        >
          {saving ? "Saving..." : "Log transaction"}
        </button>
      </form>

      <table className="w-full overflow-hidden rounded-lg border bg-white text-sm">
        <thead className="bg-gray-100 text-left">
          <tr>
            <th className="p-3">Date</th>
            <th className="p-3">Product</th>
            <th className="p-3">Type</th>
            <th className="p-3">Qty entered</th>
            <th className="p-3">Unit</th>
            <th className="p-3">Reference</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => (
            <tr key={t.id} className="border-t">
              <td className="p-3">{new Date(t.txnDate).toLocaleDateString()}</td>
              <td className="p-3">{t.product.name}</td>
              <td className="p-3">{t.txnType}</td>
              <td className="p-3">{t.entryQuantity}</td>
              <td className="p-3">{t.entryUnit === "PURCHASE_UNIT" ? "purchase unit" : "base unit"}</td>
              <td className="p-3 text-gray-500">{t.reference ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
