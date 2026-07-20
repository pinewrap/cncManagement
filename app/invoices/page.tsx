"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { generateInvoicePdf, loadLogoDataUrl } from "@/lib/pdf";
import CustomerSearch from "@/components/CustomerSearch";

type Customer = { id: string; name: string };
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
  lineItems: { activity: string; description: string; quantity: string; unitPrice: string }[];
  taxLabel: string | null;
  subtotal: number;
  otherChargesAmount: number;
  gstHstAmount: number;
  pstQstAmount: number;
  total: number;
};

type StatusFilter = "ALL" | "PAID" | "UNPAID";

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
}

export default function InvoicesPage() {
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [results, setResults] = useState<InvoiceListItem[] | null>(null);
  const [fetching, setFetching] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("UNPAID");
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/invoices?count=true").then((r) => r.json()),
      fetch("/api/customers").then((r) => r.json()),
      fetch("/api/invoices").then((r) => r.json()), // load everyone's invoices up front, not gated behind picking a customer
    ]).then(([countData, customerData, allInvoices]) => {
      setTotalCount(countData.count);
      setCustomers(customerData.sort((a: Customer, b: Customer) => a.name.localeCompare(b.name)));
      setResults(allInvoices);
    });
  }, []);

  // Accepts an explicit override so "Clear" can re-fetch "all" immediately,
  // without waiting on React's state batching for selectedCustomerId to settle.
  async function handleFetch(customerIdOverride?: string) {
    const id = customerIdOverride !== undefined ? customerIdOverride : selectedCustomerId;
    setFetching(true);
    setResults(null);
    const url = id ? `/api/invoices?customerId=${id}` : "/api/invoices";
    const res = await fetch(url);
    setResults(await res.json());
    setFetching(false);
  }

  function clearCustomer() {
    setSelectedCustomerId("");
    handleFetch("");
  }

  async function toggleStatus(inv: InvoiceListItem) {
    const next = inv.paymentStatus === "PAID" ? "UNPAID" : "PAID";
    setToggling(inv.id);
    await fetch(`/api/invoices/${inv.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentStatus: next }),
    });
    setResults((prev) =>
      prev ? prev.map((r) => (r.id === inv.id ? { ...r, paymentStatus: next } : r)) : prev
    );
    setToggling(null);
  }

  async function download(inv: InvoiceListItem) {
    const logoDataUrl = await loadLogoDataUrl();
    const doc = generateInvoicePdf({
      invoiceNumber: inv.invoiceNumber,
      invoiceDate: new Date(inv.invoiceDate).toLocaleDateString("en-CA"),
      dueDate: inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("en-CA") : null,
      logoDataUrl,
      customer: inv.customer,
      lineItems: inv.lineItems.map((li) => ({
        ...li,
        quantity: Number(li.quantity),
        unitPrice: Number(li.unitPrice),
      })),
      taxLabel: inv.taxLabel,
      gstHstRateDisplay: inv.customer.province
        ? `${(Number(inv.customer.province.gstHstRate) * 100).toFixed(0)}%`
        : "0%",
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

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  const filteredResults =
    results === null
      ? null
      : statusFilter === "ALL"
      ? results
      : results.filter((r) => r.paymentStatus === statusFilter);

  return (
    <main className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Invoices</h1>
          {totalCount !== null && (
            <p className="text-sm text-gray-500">
              {totalCount} invoice{totalCount !== 1 ? "s" : ""} total
            </p>
          )}
        </div>
        <Link
          href="/invoices/new"
          className="rounded bg-brand px-3 py-1.5 text-sm text-brand-navy hover:opacity-90"
        >
          + Create invoice
        </Link>
      </div>

      {/* Filter panel */}
      <div className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 font-medium">All Invoices</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1" style={{ minWidth: "200px" }}>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs text-gray-500">Customer (optional)</label>
              {selectedCustomerId && (
                <button type="button" onClick={clearCustomer} className="text-xs text-brand-navy underline">
                  Clear — show everyone
                </button>
              )}
            </div>
            <CustomerSearch
              customers={customers}
              value={selectedCustomerId}
              onChange={(id) => {
                setSelectedCustomerId(id);
                setResults(null);
              }}
            />
          </div>

          {/* Status filter pills — work immediately, no customer required */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Status</label>
            <div className="flex rounded-lg border overflow-hidden text-sm">
              {(["ALL", "UNPAID", "PAID"] as StatusFilter[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 font-medium transition-colors ${
                    statusFilter === s
                      ? "bg-brand-navy text-white"
                      : "bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          <button
            disabled={fetching}
            onClick={() => handleFetch()}
            className="rounded bg-brand px-4 py-2 text-sm text-brand-navy hover:opacity-90 disabled:opacity-40"
          >
            {fetching ? "Loading..." : selectedCustomerId ? "Fetch invoices" : "Refresh"}
          </button>
        </div>

        {/* Results */}
        {filteredResults !== null && (
          <div className="mt-4">
            <p className="mb-2 text-sm text-gray-600">
              {filteredResults.length === 0
                ? `No ${statusFilter !== "ALL" ? statusFilter.toLowerCase() + " " : ""}invoices${
                    selectedCustomer ? ` for ${selectedCustomer.name}` : ""
                  }.`
                : `${filteredResults.length} ${statusFilter !== "ALL" ? statusFilter.toLowerCase() + " " : ""}invoice${
                    filteredResults.length !== 1 ? "s" : ""
                  }${selectedCustomer ? ` for ${selectedCustomer.name}` : ""}`}
            </p>
            {filteredResults.length > 0 && (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full bg-white text-sm">
                  <thead className="bg-gray-100 text-left">
                    <tr>
                      <th className="p-3">Invoice #</th>
                      <th className="p-3">Customer</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Total</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResults.map((inv) => {
                      const isPaid = inv.paymentStatus === "PAID";
                      return (
                        <tr key={inv.id} className="border-t">
                          <td className="p-3 font-mono font-semibold text-brand-navy">
                            {inv.invoiceNumber}
                          </td>
                          <td className="p-3 whitespace-nowrap">{inv.customer.name}</td>
                          <td className="p-3 whitespace-nowrap text-gray-500">
                            {fmtDate(inv.invoiceDate)}
                          </td>
                          <td className="p-3">
                            <span
                              className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                                isPaid
                                  ? "bg-green-100 text-green-700"
                                  : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {isPaid ? "Paid" : "Unpaid"}
                            </span>
                          </td>
                          <td className="p-3 whitespace-nowrap font-semibold">
                            ${inv.total.toFixed(2)}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center justify-end gap-3">
                              <button
                                disabled={toggling === inv.id}
                                onClick={() => toggleStatus(inv)}
                                className={`whitespace-nowrap rounded px-2 py-1 text-xs font-medium transition-colors disabled:opacity-40 ${
                                  isPaid
                                    ? "border border-amber-400 text-amber-700 hover:bg-amber-50"
                                    : "border border-green-500 text-green-700 hover:bg-green-50"
                                }`}
                              >
                                {toggling === inv.id
                                  ? "Saving…"
                                  : isPaid
                                  ? "Mark Unpaid"
                                  : "Mark Paid"}
                              </button>
                              <button
                                onClick={() => download(inv)}
                                className="whitespace-nowrap text-brand-navy underline"
                              >
                                PDF
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
