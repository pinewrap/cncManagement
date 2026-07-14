"use client";

import { useEffect, useState } from "react";
import { groupProductLines, packageLabel } from "@/lib/calculations";

type Product = {
  id: string;
  name: string;
  variant: string | null;
  packageType: string | null;
  packageSize: string | null;
  unit: string;
};
type Txn = {
  id: string;
  txnDate: string;
  txnType: string;
  entryUnit: string;
  entryQuantity: string;
  reference: string | null;
  product: Product;
};

const emptyForm = {
  lineKey: "",
  productId: "",
  txnType: "STOCK_IN",
  entryUnit: "PACKAGE",
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

  const lines = groupProductLines(products);
  const selectedLine = lines.find((l) => l.key === form.lineKey);
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
        entryQuantity: parseFloat(form.entryQuantity),
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
          value={form.lineKey}
          onChange={(e) => setForm({ ...form, lineKey: e.target.value, productId: "" })}
        >
          <option value="">1. Select product...</option>
          {lines.map((l) => (
            <option key={l.key} value={l.key}>
              {l.label}
            </option>
          ))}
        </select>

        <select
          required
          disabled={!selectedLine}
          className="rounded border px-3 py-2 disabled:bg-gray-100"
          value={form.productId}
          onChange={(e) => setForm({ ...form, productId: e.target.value })}
        >
          <option value="">2. Select package...</option>
          {selectedLine?.products.map((p) => (
            <option key={p.id} value={p.id}>
              {packageLabel(p)}
            </option>
          ))}
        </select>

        <select
          className="rounded border px-3 py-2"
          value={form.txnType}
          onChange={(e) => setForm({ ...form, txnType: e.target.value })}
        >
          <option value="STOCK_IN">Stock In (received)</option>
          <option value="STOCK_OUT">Stock Out</option>
          <option value="ADJUSTMENT">Adjustment</option>
        </select>

        <select
          className="rounded border px-3 py-2"
          value={form.entryUnit}
          onChange={(e) => setForm({ ...form, entryUnit: e.target.value })}
        >
          <option value="PACKAGE">
            By the {selectedProduct?.packageType?.toLowerCase() ?? "package"}
          </option>
          <option value="BASE_UNIT">By the {selectedProduct?.unit ?? "unit"} (partial package)</option>
        </select>

        <input
          required
          type="number"
          step="0.001"
          placeholder={
            form.entryUnit === "PACKAGE"
              ? `How many ${selectedProduct?.packageType?.toLowerCase() ?? "packages"}?`
              : `How many ${selectedProduct?.unit ?? "units"}?`
          }
          className="rounded border px-3 py-2 sm:col-span-2"
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
            <th className="p-3">Level</th>
            <th className="p-3">Reference</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => (
            <tr key={t.id} className="border-t">
              <td className="p-3">{new Date(t.txnDate).toLocaleDateString()}</td>
              <td className="p-3">
                {t.product.name} {t.product.variant} — {packageLabel(t.product)}
              </td>
              <td className="p-3">{t.txnType}</td>
              <td className="p-3">{t.entryQuantity}</td>
              <td className="p-3">{t.entryUnit === "PACKAGE" ? t.product.packageType : t.product.unit}</td>
              <td className="p-3 text-gray-500">{t.reference ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
