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
  reorderLevel: string | null;
  currentQuantity: number;
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((data) => {
        setProducts(data);
        setLoading(false);
      });
  }, []);

  const lines = groupProductLines(products);

  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Inventory</h1>
      <p className="text-sm text-gray-500">
        The product catalog is fixed to CNC&apos;s official product range. To add or change a
        product, contact Pinewrap — everything below is available to select from Stock and
        Invoices.
      </p>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <div className="flex flex-col gap-4">
          {lines.map((line) => (
            <div key={line.key} className="rounded-lg border bg-white p-4">
              <h2 className="mb-2 font-medium text-brand">{line.label}</h2>
              <table className="w-full text-sm">
                <thead className="text-left text-gray-500">
                  <tr>
                    <th className="py-1">Package</th>
                    <th className="py-1">Current Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {line.products.map((p) => {
                    const full = products.find((fp) => fp.id === p.id)!;
                    const low =
                      full.reorderLevel != null && full.currentQuantity <= Number(full.reorderLevel);
                    return (
                      <tr key={p.id} className="border-t">
                        <td className="py-1.5">{packageLabel(p)}</td>
                        <td className={`py-1.5 font-medium ${low ? "text-red-600" : ""}`}>
                          {full.currentQuantity} {full.unit}
                          {low && " (low)"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
