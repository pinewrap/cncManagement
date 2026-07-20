"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { invoiceTotals, taxLabel as getTaxLabel, deriveActivity, deriveDescription, groupProductLines, packageLabel } from "@/lib/calculations";
import { generateInvoicePdf, loadLogoDataUrl } from "@/lib/pdf";
import InvoicePreview from "@/components/InvoicePreview";

type Province = { province: string; taxType: string; gstHstRate: string; pstQstRate: string };
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

const emptyLine: LineItem = {
  lineKey: "",
  productId: "",
  activity: "",
  description: "",
  unitPrice: "",
  quantity: "1",
};
const emptyCustomerForm = {
  name: "",
  phone: "",
  email: "",
  street: "",
  city: "",
  postalCode: "",
  provinceId: "",
};

export default function NewInvoicePage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [customerForm, setCustomerForm] = useState(emptyCustomerForm);
  const [provinces, setProvinces] = useState<Province[]>([]);

  const [lineItems, setLineItems] = useState<LineItem[]>([{ ...emptyLine }]);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [otherChargesLabel, setOtherChargesLabel] = useState("");
  const [otherChargesAmount, setOtherChargesAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [footerNote, setFooterNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/customers").then((r) => r.json()).then(setCustomers);
    fetch("/api/products").then((r) => r.json()).then(setProducts);
    fetch("/api/provinces").then((r) => r.json()).then(setProvinces);
  }, []);

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

  async function handleAddCustomer(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: customerForm.name,
        phone: customerForm.phone || undefined,
        email: customerForm.email || undefined,
        street: customerForm.street || undefined,
        city: customerForm.city || undefined,
        postalCode: customerForm.postalCode || undefined,
        provinceId: customerForm.provinceId || undefined,
      }),
    });
    const created = await res.json();
    setCustomers((c) => [...c, created]);
    setSelectedCustomer(created);
    setShowNewCustomer(false);
    setCustomerForm(emptyCustomerForm);
    setCustomerSearch("");
  }

  // Live totals, using the exact same functions the backend uses — no drift
  // between what you see here and what gets saved.
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

  async function handleSubmit() {
    if (!selectedCustomer) {
      alert("Select or add a customer first.");
      return;
    }
    const validLines = lineItems.filter((li) => li.description && li.unitPrice && li.quantity);
    if (validLines.length === 0) {
      alert("Add at least one line item.");
      return;
    }

    setSubmitting(true);
    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: selectedCustomer.id,
        invoiceNumber: invoiceNumber.trim() || undefined,
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

    // Generate + download the PDF immediately, matching CNC's reference layout
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
    doc.save(`invoice-${invoice.invoiceNumber}.pdf`);

    router.push("/invoices");
  }

  return (
    <main className="flex flex-col gap-6 pb-10">
      <h1 className="text-2xl font-semibold">Create Invoice</h1>

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
            <button
              className="mt-2 text-sm text-brand-navy underline"
              onClick={() => setShowNewCustomer((s) => !s)}
            >
              {showNewCustomer ? "Cancel" : "+ Add new customer"}
            </button>
            {showNewCustomer && (
              <form onSubmit={handleAddCustomer} className="mt-3 grid gap-2 rounded border p-3 sm:grid-cols-2">
                <input
                  required
                  placeholder="Name"
                  className="rounded border px-3 py-2"
                  value={customerForm.name}
                  onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                />
                <input
                  placeholder="Phone"
                  className="rounded border px-3 py-2"
                  value={customerForm.phone}
                  onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                />
                <input
                  placeholder="Email"
                  className="rounded border px-3 py-2"
                  value={customerForm.email}
                  onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                />
                <input
                  placeholder="Street"
                  className="rounded border px-3 py-2"
                  value={customerForm.street}
                  onChange={(e) => setCustomerForm({ ...customerForm, street: e.target.value })}
                />
                <input
                  placeholder="City"
                  className="rounded border px-3 py-2"
                  value={customerForm.city}
                  onChange={(e) => setCustomerForm({ ...customerForm, city: e.target.value })}
                />
                <input
                  placeholder="Postal code"
                  className="rounded border px-3 py-2"
                  value={customerForm.postalCode}
                  onChange={(e) => setCustomerForm({ ...customerForm, postalCode: e.target.value })}
                />
                <select
                  required
                  className="rounded border px-3 py-2"
                  value={customerForm.provinceId}
                  onChange={(e) => setCustomerForm({ ...customerForm, provinceId: e.target.value })}
                >
                  <option value="">Select province...</option>
                  {provinces.map((p) => (
                    <option key={p.province} value={p.province}>
                      {p.province} ({p.taxType})
                    </option>
                  ))}
                </select>
                <button className="rounded bg-brand px-3 py-2 text-sm text-brand-navy hover:opacity-90">
                  Save customer
                </button>
              </form>
            )}
          </>
        )}
      </section>

      {/* Line items */}
      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-2 font-medium">Line items</h2>
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
                {selectedLine?.products.map((p) => (
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
          onClick={() => setLineItems((items) => [...items, { ...emptyLine }])}
        >
          + Add line item
        </button>
      </section>

      {/* Other details */}
      <section className="grid gap-3 rounded-lg border bg-white p-4 sm:grid-cols-2">
        <input
          placeholder="Invoice # — leave blank to auto-generate (e.g. CNC-INV 3017)"
          className="rounded border px-3 py-2 sm:col-span-2"
          value={invoiceNumber}
          onChange={(e) => setInvoiceNumber(e.target.value)}
        />
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
          placeholder="Footer note override — optional"
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
        {!selectedCustomer && (
          <p className="mt-2 text-xs text-amber-600">Select a customer to calculate tax.</p>
        )}
      </section>

      {/* Live invoice preview */}
      <section>
        <h2 className="mb-3 font-medium text-gray-700">Invoice Preview</h2>
        <div className="overflow-x-auto">
        <div className="min-w-[600px]">
        <InvoicePreview
          invoiceDate={new Date().toLocaleDateString("en-CA")}
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
          pstQstRateDisplay={rates && Number(rates.pstQstRate) > 0 ? `${(Number(rates.pstQstRate) * 100).toFixed(3)}%` : null}
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
        onClick={handleSubmit}
        className="w-full rounded bg-brand px-4 py-2 text-brand-navy hover:opacity-90 disabled:opacity-50 sm:ml-auto sm:w-auto"
      >
        {submitting ? "Creating..." : "Create invoice + download PDF"}
      </button>
    </main>
  );
}
