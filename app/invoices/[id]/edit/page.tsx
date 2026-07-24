"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  invoiceTotals,
  taxLabel as getTaxLabel,
  deriveActivity,
  deriveDescription,
  groupProductLines,
  packageLabel,
  comparePackageSizeDesc,
} from "@/lib/calculations";
import { generateInvoicePdf, loadLogoDataUrl, invoiceFilename } from "@/lib/pdf";
import InvoicePreview from "@/components/InvoicePreview";

type Province = { province: string; taxType: string; gstHstRate: string; pstQstRate: string };
type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  street: string | null;
  poBox: string | null;
  city: string | null;
  postalCode: string | null;
  province: Province | null;
};
type Product = {
  id: string;
  name: string;
  variant: string | null;
  description: string | null;
  packageType: string | null;
  packageSize: string | null;
  unit: string;
  defaultPrice: string | null;
};
type LineItem = {
  lineKey: string;
  productId: string;
  activity: string;
  description: string;
  unitPrice: string;
  quantity: string;
};

// Converts a stored Date/ISO string to a bare "YYYY-MM-DD" for a date input.
// Safe from timezone shift here because both the original write (new
// Date("YYYY-MM-DD")) and this read use UTC internally — they round-trip
// consistently as long as neither side mixes in local-time parsing.
function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 10);
}

function lineKeyForProduct(productId: string | null, products: Product[]): string {
  if (!productId) return "";
  const p = products.find((pr) => pr.id === productId);
  if (!p) return "";
  return `${p.name}__${p.variant ?? ""}`;
}

export default function EditInvoicePage() {
  const params = useParams();
  const invoiceId = params.id as string;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");

  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [otherChargesLabel, setOtherChargesLabel] = useState("");
  const [otherChargesAmount, setOtherChargesAmount] = useState("");
  const [footerNote, setFooterNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/invoices/${invoiceId}`).then((r) => r.json()),
      fetch("/api/customers").then((r) => r.json()),
      fetch("/api/products").then((r) => r.json()),
      fetch("/api/provinces").then((r) => r.json()),
    ]).then(([invoice, customerData, productData, provinceData]) => {
      if (invoice.error) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setCustomers(customerData);
      setProducts(productData);
      setProvinces(provinceData);

      setSelectedCustomer(invoice.customer);
      setInvoiceNumber(invoice.invoiceNumber);
      setInvoiceDate(toDateInputValue(invoice.invoiceDate));
      setDueDate(toDateInputValue(invoice.dueDate));
      setOtherChargesLabel(invoice.otherChargesLabel ?? "");
      setOtherChargesAmount(invoice.otherChargesAmount ? String(invoice.otherChargesAmount) : "");
      setFooterNote(invoice.footerNote ?? "");
      setLineItems(
        invoice.lineItems.map((li: any) => ({
          lineKey: lineKeyForProduct(li.productId, productData),
          productId: li.productId ?? "",
          activity: li.activity,
          description: li.description,
          unitPrice: String(li.unitPrice),
          quantity: String(li.quantity),
        }))
      );
      setLoading(false);
    });
  }, [invoiceId]);

  const matchingCustomers = useMemo(() => {
    if (!customerSearch) return [];
    const q = customerSearch.toLowerCase();
    return customers.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone?.includes(q) || c.email?.toLowerCase().includes(q)
    );
  }, [customerSearch, customers]);

  function updateLine(index: number, patch: Partial<LineItem>) {
    setLineItems((items) => items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  const productLines = groupProductLines(products);

  function handleLinePick(index: number, lineKey: string) {
    updateLine(index, { lineKey, productId: "", activity: "", description: "", unitPrice: "" });
  }

  function handlePackagePick(index: number, productId: string) {
    const product = products.find((p) => p.id === productId);
    updateLine(index, {
      productId,
      activity: product ? deriveActivity(product) : "",
      description: product ? deriveDescription(product) : "",
      unitPrice: product?.defaultPrice ? String(product.defaultPrice) : "",
    });
  }

  const numericLineItems = lineItems
    .filter((li) => li.unitPrice && li.quantity)
    .map((li) => ({ unitPrice: parseFloat(li.unitPrice) || 0, quantity: parseFloat(li.quantity) || 0 }));
  const rates = selectedCustomer?.province;
  const totals = invoiceTotals(
    numericLineItems,
    rates ? Number(rates.gstHstRate) : 0,
    rates ? Number(rates.pstQstRate) : 0,
    parseFloat(otherChargesAmount) || 0
  );
  const taxLabelDisplay = rates ? getTaxLabel(rates.taxType) : null;

  async function handleSave() {
    if (!selectedCustomer) {
      alert("Select a customer first.");
      return;
    }
    const validLines = lineItems.filter((li) => li.description && li.unitPrice && li.quantity);
    if (validLines.length === 0) {
      alert("Add at least one line item.");
      return;
    }

    setSubmitting(true);
    const res = await fetch(`/api/invoices/${invoiceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: selectedCustomer.id,
        invoiceDate: invoiceDate || undefined,
        dueDate: dueDate || undefined,
        otherChargesLabel: otherChargesLabel || undefined,
        otherChargesAmount: parseFloat(otherChargesAmount) || undefined,
        footerNote: footerNote || undefined,
        lineItems: validLines.map((li) => ({
          productId: li.productId || undefined,
          activity: li.activity,
          description: li.description,
          unitPrice: parseFloat(li.unitPrice),
          quantity: parseFloat(li.quantity),
        })),
      }),
    });
    const invoice = await res.json();
    setSubmitting(false);

    if (invoice.error) {
      alert(invoice.error);
      return;
    }

    const [doc] = await Promise.all([
      loadLogoDataUrl().then((logoDataUrl) =>
        generateInvoicePdf({
          invoiceNumber: invoice.invoiceNumber,
          invoiceDate: new Date(invoice.invoiceDate).toLocaleDateString("en-CA"),
          dueDate: invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("en-CA") : null,
          logoDataUrl,
          customer: invoice.customer,
          lineItems: invoice.lineItems.map((li: any) => ({
            ...li,
            quantity: Number(li.quantity),
            unitPrice: Number(li.unitPrice),
          })),
          taxLabel: invoice.taxLabel,
          gstHstRateDisplay: rates ? `${(Number(rates.gstHstRate) * 100).toFixed(0)}%` : "0%",
          pstQstRateDisplay:
            rates && Number(rates.pstQstRate) > 0 ? `${(Number(rates.pstQstRate) * 100).toFixed(3)}%` : null,
          subtotal: invoice.subtotal,
          otherChargesLabel: invoice.otherChargesLabel,
          otherChargesAmount: invoice.otherChargesAmount,
          gstHstAmount: invoice.gstHstAmount,
          pstQstAmount: invoice.pstQstAmount,
          total: invoice.total,
          footerNote: invoice.footerNote,
        })
      ),
    ]);
    doc.save(invoiceFilename(invoice.invoiceNumber));

    router.push("/invoices");
  }

  if (loading) return <main className="p-6 text-gray-500">Loading invoice...</main>;
  if (notFound) return <main className="p-6 text-red-600">Invoice not found.</main>;

  return (
    <main className="flex flex-col gap-6 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Edit Invoice {invoiceNumber}</h1>
        <button onClick={() => router.push("/invoices")} className="text-sm text-gray-500 underline">
          Cancel
        </button>
      </div>

      {/* Customer */}
      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-2 font-medium">Customer</h2>
        {selectedCustomer ? (
          <div className="flex items-center justify-between rounded bg-gray-50 p-3 text-sm">
            <div>
              <div className="font-medium">{selectedCustomer.name}</div>
              <div className="text-gray-500">
                {[selectedCustomer.street, selectedCustomer.city, selectedCustomer.province?.province]
                  .filter(Boolean)
                  .join(", ")}
              </div>
            </div>
            <button className="text-brand-navy underline" onClick={() => setSelectedCustomer(null)}>
              Change
            </button>
          </div>
        ) : (
          <>
            <input
              placeholder="Search by name, phone, or email..."
              className="w-full rounded border px-3 py-2"
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
            />
            {matchingCustomers.length > 0 && (
              <ul className="mt-2 divide-y rounded border text-sm">
                {matchingCustomers.map((c) => (
                  <li
                    key={c.id}
                    className="cursor-pointer p-2 hover:bg-gray-50"
                    onClick={() => {
                      setSelectedCustomer(c);
                      setCustomerSearch("");
                    }}
                  >
                    {c.name} {c.phone && `— ${c.phone}`}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      {/* Line items */}
      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-2 font-medium">Line items</h2>
        <div className="mb-3 max-w-xs">
          <label className="mb-1 block text-xs text-gray-500">Invoice Date</label>
          <input
            type="date"
            className="rounded border px-3 py-2 text-sm"
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-3">
          {lineItems.map((line, i) => {
            const selectedLine = productLines.find((l) => l.key === line.lineKey);
            return (
              <div key={i} className="grid grid-cols-2 gap-2 rounded border p-3 sm:grid-cols-6">
                <select
                  className="col-span-2 rounded border px-2 py-1.5 text-sm sm:col-span-2"
                  value={line.lineKey}
                  onChange={(e) => handleLinePick(i, e.target.value)}
                >
                  <option value="">1. Select product...</option>
                  {productLines.map((l) => (
                    <option key={l.key} value={l.key}>
                      {l.label}
                    </option>
                  ))}
                </select>
                <select
                  className="col-span-2 rounded border px-2 py-1.5 text-sm disabled:bg-gray-100 sm:col-span-1"
                  disabled={!selectedLine}
                  value={line.productId}
                  onChange={(e) => handlePackagePick(i, e.target.value)}
                >
                  <option value="">2. Select package...</option>
                  {selectedLine?.products.slice().sort(comparePackageSizeDesc).map((p) => (
                    <option key={p.id} value={p.id}>
                      {packageLabel(p)}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Activity"
                  className="rounded border px-2 py-1.5 text-sm"
                  value={line.activity}
                  onChange={(e) => updateLine(i, { activity: e.target.value })}
                />
                <input
                  placeholder="Description"
                  className="rounded border px-2 py-1.5 text-sm"
                  value={line.description}
                  onChange={(e) => updateLine(i, { description: e.target.value })}
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Unit price"
                  className="rounded border px-2 py-1.5 text-sm"
                  value={line.unitPrice}
                  onChange={(e) => updateLine(i, { unitPrice: e.target.value })}
                />
                <input
                  type="number"
                  step="0.001"
                  placeholder="Qty"
                  className="rounded border px-2 py-1.5 text-sm"
                  value={line.quantity}
                  onChange={(e) => updateLine(i, { quantity: e.target.value })}
                />
                <div className="col-span-1 flex items-center text-sm text-gray-500 sm:col-span-5">
                  Line total: $
                  {((parseFloat(line.unitPrice) || 0) * (parseFloat(line.quantity) || 0)).toFixed(2)}
                </div>
                <button
                  className="text-sm text-red-600 underline"
                  onClick={() => setLineItems((items) => items.filter((_, idx) => idx !== i))}
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
        <button
          className="mt-3 text-sm text-brand-navy underline"
          onClick={() =>
            setLineItems((items) => [
              ...items,
              { lineKey: "", productId: "", activity: "", description: "", unitPrice: "", quantity: "1" },
            ])
          }
        >
          + Add line item
        </button>
      </section>

      {/* Other details */}
      <section className="grid gap-3 rounded-lg border bg-white p-4 sm:grid-cols-2">
        <input
          placeholder="Other charge label (e.g. Freight) — optional"
          className="rounded border px-3 py-2"
          value={otherChargesLabel}
          onChange={(e) => setOtherChargesLabel(e.target.value)}
        />
        <input
          type="number"
          step="0.01"
          placeholder="Other charge amount — optional"
          className="rounded border px-3 py-2"
          value={otherChargesAmount}
          onChange={(e) => setOtherChargesAmount(e.target.value)}
        />
        <input
          type="date"
          placeholder="Due date"
          className="rounded border px-3 py-2"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
        <input
          placeholder="Additional footer note — optional"
          className="rounded border px-3 py-2"
          value={footerNote}
          onChange={(e) => setFooterNote(e.target.value)}
        />
      </section>

      {/* Live totals */}
      <section className="ml-auto w-full max-w-xs rounded-lg border bg-white p-4 text-sm">
        <div className="flex justify-between py-1">
          <span>Subtotal</span>
          <span>${totals.subtotal.toFixed(2)}</span>
        </div>
        {totals.otherChargesAmount > 0 && (
          <div className="flex justify-between py-1">
            <span>{otherChargesLabel || "Other"}</span>
            <span>${totals.otherChargesAmount.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between py-1">
          <span>{taxLabelDisplay ?? "Tax"}</span>
          <span>${totals.gstHstAmount.toFixed(2)}</span>
        </div>
        {totals.pstQstAmount > 0 && (
          <div className="flex justify-between py-1">
            <span>PST/QST</span>
            <span>${totals.pstQstAmount.toFixed(2)}</span>
          </div>
        )}
        <div className="mt-2 flex justify-between border-t pt-2 font-semibold">
          <span>Total</span>
          <span>${totals.total.toFixed(2)}</span>
        </div>
      </section>

      {/* Live preview */}
      <section>
        <h2 className="mb-3 font-medium text-gray-700">Invoice Preview</h2>
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            <InvoicePreview
              invoiceNumber={invoiceNumber || undefined}
              invoiceDate={invoiceDate}
              dueDate={dueDate}
              customer={selectedCustomer}
              lineItems={lineItems
                .filter((li) => li.description && li.unitPrice && li.quantity)
                .map((li) => ({
                  activity: li.activity,
                  description: li.description,
                  unitPrice: parseFloat(li.unitPrice) || 0,
                  quantity: parseFloat(li.quantity) || 0,
                }))}
              taxLabel={taxLabelDisplay}
              gstHstRateDisplay={rates ? `${(Number(rates.gstHstRate) * 100).toFixed(0)}%` : "0%"}
              pstQstRateDisplay={
                rates && Number(rates.pstQstRate) > 0 ? `${(Number(rates.pstQstRate) * 100).toFixed(3)}%` : null
              }
              subtotal={totals.subtotal}
              otherChargesLabel={otherChargesLabel}
              otherChargesAmount={totals.otherChargesAmount}
              gstHstAmount={totals.gstHstAmount}
              pstQstAmount={totals.pstQstAmount}
              total={totals.total}
              footerNote={footerNote}
            />
          </div>
        </div>
      </section>

      <button
        disabled={submitting}
        onClick={handleSave}
        className="w-full rounded bg-brand px-4 py-2 text-brand-navy hover:opacity-90 disabled:opacity-50 sm:ml-auto sm:w-auto"
      >
        {submitting ? "Saving..." : "Save changes + download updated PDF"}
      </button>
    </main>
  );
}
