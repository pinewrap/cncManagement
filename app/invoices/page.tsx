"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { generateInvoicePdf } from "@/lib/pdf";

type InvoiceListItem = {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  paymentStatus: string;
  otherChargesLabel: string | null;
  footerNote: string | null;
  customer: {
    name: string;
    street: string | null;
    city: string | null;
    postalCode: string | null;
    province: { province: string; gstHstRate: string; pstQstRate: string } | null;
  };
  lineItems: { activity: string; description: string; quantity: number; unitPrice: string }[];
  taxLabel: string | null;
  subtotal: number;
  otherChargesAmount: number;
  gstHstAmount: number;
  pstQstAmount: number;
  total: number;
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/invoices")
      .then((r) => r.json())
      .then((data) => {
        setInvoices(data);
        setLoading(false);
      });
  }, []);

  function download(inv: InvoiceListItem) {
    const doc = generateInvoicePdf({
      invoiceNumber: inv.invoiceNumber,
      invoiceDate: new Date(inv.invoiceDate).toLocaleDateString("en-CA"),
      dueDate: inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("en-CA") : null,
      customer: inv.customer,
      lineItems: inv.lineItems.map((li) => ({
        ...li,
        unitPrice: Number(li.unitPrice),
      })),
      taxLabel: inv.taxLabel,
      gstHstRateDisplay: inv.customer.province ? `${(Number(inv.customer.province.gstHstRate) * 100).toFixed(0)}%` : "0%",
      pstQstRateDisplay:
        inv.customer.province && Number(inv.customer.province.pstQstRate) > 0
          ? `${(Number(inv.customer.province.pstQstRate) * 100).toFixed(3)}%`
          : null,
      subtotal: inv.subtotal,
      otherChargesLabel: inv.otherChargesLabel,
      otherChargesAmount: inv.otherChargesAmount,
      gstHstAmount: inv.gstHstAmount,
      pstQstAmount: inv.pstQstAmount,
      total: inv.total,
      footerNote: inv.footerNote,
    });
    doc.save(`invoice-${inv.invoiceNumber}.pdf`);
  }

  return (
    <main className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Invoices</h1>
        <Link href="/invoices/new" className="rounded bg-brand px-3 py-1.5 text-sm text-white hover:opacity-90">
          + Create invoice
        </Link>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : invoices.length === 0 ? (
        <p className="text-gray-500">No invoices yet.</p>
      ) : (
        <table className="w-full overflow-hidden rounded-lg border bg-white text-sm">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="p-3">#</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Date</th>
              <th className="p-3">Status</th>
              <th className="p-3">Total</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-t">
                <td className="p-3">{inv.invoiceNumber}</td>
                <td className="p-3">{inv.customer.name}</td>
                <td className="p-3">{new Date(inv.invoiceDate).toLocaleDateString()}</td>
                <td className="p-3">{inv.paymentStatus}</td>
                <td className="p-3">${inv.total.toFixed(2)}</td>
                <td className="p-3">
                  <button onClick={() => download(inv)} className="text-brand underline">
                    Download PDF
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
