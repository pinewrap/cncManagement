"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { generateInvoicePdf, loadLogoDataUrl, invoiceFilename } from "@/lib/pdf";
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
    poBox: string | null;
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
  const [results, setResults] = useState<InvoiceListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("UNPAID");
  const [toggling, setToggling] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function buildParams(cursor?: string) {
    const params = new URLSearchParams();
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    if (selectedCustomerId) params.set("customerId", selectedCustomerId);
    if (cursor) params.set("cursor", cursor);
    return params;
  }

  async function loadFirstPage() {
    setLoading(true);
    const [countData, invoiceData] = await Promise.all([
      fetch("/api/invoices?count=true").then((r) => r.json()),
      fetch(`/api/invoices?${buildParams()}`).then((r) => r.json()),
    ]);
    setTotalCount(countData.count);
    setResults(invoiceData.invoices);
    setNextCursor(invoiceData.nextCursor);
    setLoading(false);
  }

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    const data = await fetch(`/api/invoices?${buildParams(nextCursor)}`).then((r) => r.json());
    setResults((prev) => [...prev, ...data.invoices]);
    setNextCursor(data.nextCursor);
    setLoadingMore(false);
  }

  // Load the customer list once, for the search dropdown
  useEffect(() => {
    fetch("/api/customers")
      .then((r) => r.json())
      .then((data) => setCustomers(data.sort((a: Customer, b: Customer) => a.name.localeCompare(b.name))));
  }, []);

  // Re-fetch page 1 whenever the status filter or selected customer changes —
  // both are now real server-side filters, not client-side filtering of
  // whatever happened to already be loaded.
  useEffect(() => {
    loadFirstPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, selectedCustomerId]);

  function clearCustomer() {
    setSelectedCustomerId("");
  }

  async function toggleStatus(inv: InvoiceListItem) {
    const next = inv.paymentStatus === "PAID" ? "UNPAID" : "PAID";
    setToggling(inv.id);
    await fetch(`/api/invoices/${inv.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentStatus: next }),
    });
    // If the new status no longer matches the active filter, just drop it
    // from view rather than trying to patch it in place — simpler and
    // always correct now that filtering happens server-side.
    setResults((prev) => {
      const updated = prev.map((r) => (r.id === inv.id ? { ...r, paymentStatus: next } : r));
      if (statusFilter !== "ALL" && next !== statusFilter) {
        return updated.filter((r) => r.id !== inv.id);
      }
      return updated;
    });
    setToggling(null);
  }

  async function handleDelete(inv: InvoiceListItem) {
    if (
      !confirm(
        `Delete invoice ${inv.invoiceNumber} for ${inv.customer.name}? This also reverses the stock that was deducted when it was created. This can't be undone.`
      )
    )
      return;
    setDeletingId(inv.id);
    const res = await fetch(`/api/invoices/${inv.id}`, { method: "DELETE" });
    setDeletingId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Couldn't delete this invoice.");
      return;
    }
    setResults((prev) => prev.filter((r) => r.id !== inv.id));
    setTotalCount((prev) => (prev !== null ? prev - 1 : prev));
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
    doc.save(invoiceFilename(inv.invoiceNumber));
  }

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

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
              onChange={(id) => setSelectedCustomerId(id)}
            />
          </div>

          {/* Status filter pills — now trigger a real server-side re-fetch */}
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
        </div>

        {/* Results */}
        <div className="mt-4">
          {loading ? (
            <p className="text-sm text-gray-400">Loading...</p>
          ) : (
            <>
              <p className="mb-2 text-sm text-gray-600">
                {results.length === 0
                  ? `No ${statusFilter !== "ALL" ? statusFilter.toLowerCase() + " " : ""}invoices${
                      selectedCustomer ? ` for ${selectedCustomer.name}` : ""
                    }.`
                  : `Showing ${results.length}${nextCursor ? "+" : ""} ${
                      statusFilter !== "ALL" ? statusFilter.toLowerCase() + " " : ""
                    }invoice${results.length !== 1 ? "s" : ""}${
                      selectedCustomer ? ` for ${selectedCustomer.name}` : ""
                    }`}
              </p>
              {results.length > 0 && (
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
                      {results.map((inv) => {
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
                                <Link
                                  href={`/invoices/${inv.id}/edit`}
                                  className="whitespace-nowrap text-brand-navy underline"
                                >
                                  Edit
                                </Link>
                                <button
                                  disabled={deletingId === inv.id}
                                  onClick={() => handleDelete(inv)}
                                  className="whitespace-nowrap text-xs text-red-600 underline disabled:opacity-40"
                                >
                                  {deletingId === inv.id ? "Deleting…" : "Delete"}
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
              {nextCursor && (
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="mx-auto mt-3 block rounded border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                >
                  {loadingMore ? "Loading..." : "Load more"}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
