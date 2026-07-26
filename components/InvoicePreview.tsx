"use client";

import { businessConfig } from "@/lib/business-config";
import { toDDMMYYYY } from "@/lib/pdf";

type Province = { province: string; taxType: string; gstHstRate: string; pstQstRate: string };
type Customer = {
  name: string;
  street?: string | null;
  city?: string | null;
  postalCode?: string | null;
  province?: Province | null;
};
type LineItemPreview = {
  activity: string;
  description: string;
  unitPrice: number;
  quantity: number;
};

type Props = {
  invoiceNumber?: string;
  poNumber?: string;
  invoiceDate: string;
  dueDate: string;
  customer: Customer | null;
  lineItems: LineItemPreview[];
  taxLabel: string | null;
  gstHstRateDisplay: string;
  pstQstRateDisplay: string | null;
  subtotal: number;
  otherChargesLabel: string;
  otherChargesAmount: number;
  gstHstAmount: number;
  pstQstAmount: number;
  total: number;
  footerNote: string;
};

const gold = businessConfig.colors.gold;
const navy = businessConfig.colors.text;

// Matches lib/pdf.ts exactly: grand total always shows 2 decimals, every
// other number drops the trailing ".00" when it's a whole number.
const money = (n: number) => n.toFixed(2);
const smartMoney = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

const HR = ({ color = "#aaa", mt = 10, mb = 10 }: { color?: string; mt?: number; mb?: number }) => (
  <div style={{ borderTop: `1px solid ${color}`, marginTop: mt, marginBottom: mb }} />
);

export default function InvoicePreview({
  invoiceNumber,
  poNumber,
  invoiceDate,
  dueDate,
  customer,
  lineItems,
  taxLabel,
  gstHstRateDisplay,
  pstQstRateDisplay,
  subtotal,
  otherChargesLabel,
  otherChargesAmount,
  gstHstAmount,
  pstQstAmount,
  total,
  footerNote,
}: Props) {
  const cityLine = customer
    ? [customer.city, customer.province?.province, customer.postalCode].filter(Boolean).join(", ")
    : "";

  const combinedFooterText = footerNote
    ? `${businessConfig.defaultFooterNote}\n${footerNote}`
    : businessConfig.defaultFooterNote;

  return (
    <div
      style={{ fontFamily: "Helvetica, Arial, sans-serif", color: navy, fontSize: 13 }}
      className="rounded-lg border bg-white p-8 shadow-sm"
    >
      {/* ── Title ── */}
      <div style={{ textAlign: "center", color: gold, fontSize: 18, fontWeight: "bold", marginBottom: 20 }}>
        INVOICE {invoiceNumber ? invoiceNumber : <span style={{ opacity: 0.45 }}>#PREVIEW</span>}
      </div>

      {/* ── Business info (left) + Logo placeholder (right) ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ lineHeight: 1.6 }}>
          <div style={{ fontSize: 17, fontWeight: "bold" }}>{businessConfig.name}</div>
          <div style={{ fontWeight: "bold", fontSize: 13, color: navy }}>{businessConfig.legalName}</div>
          <div style={{ fontSize: 13 }}>{businessConfig.contactName}</div>
          <div style={{ fontSize: 13 }}>{businessConfig.phone}</div>
          <div style={{ fontSize: 13, fontWeight: "bold", color: "rgb(0,100,210)" }}>
            {businessConfig.email}
          </div>
          <div style={{ fontSize: 13 }}>{businessConfig.website}</div>
          <div style={{ fontSize: 13 }}>GST/HST Registration No:</div>
          <div style={{ fontSize: 13 }}>{businessConfig.gstHstNumber}</div>
          <div style={{ fontSize: 13 }}>Business Number {businessConfig.businessNumber}</div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="logo" style={{ width: 72, height: 72, objectFit: "contain" }} />
      </div>

      <HR color="#aaa" mt={14} mb={14} />

      {/* ── Bill To (left) + Date/Pay/Due box (right) ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div style={{ fontSize: 13 }}>
          <div style={{ fontWeight: "bold", fontSize: 15, marginBottom: 5 }}>BILL TO:-</div>
          {customer ? (
            <>
              <div>{customer.name}</div>
              {customer.street && <div>{customer.street}</div>}
              {cityLine && <div>{cityLine}</div>}
              {/* PO Number — the customer's own purchase-order reference,
                  shown only when provided. Not part of the address. */}
              {poNumber && <div style={{ fontWeight: "bold" }}>PO #: {poNumber}</div>}
            </>
          ) : (
            <div style={{ color: "#aaa", fontStyle: "italic" }}>No customer selected</div>
          )}
        </div>

        <div
          style={{
            border: "1px solid #bbb",
            minWidth: 264,
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            fontSize: 12,
            flexShrink: 0,
          }}
        >
          {(["DATE", "PLEASE PAY", "DUE DATE"] as const).map((label, i) => (
            <div
              key={label}
              style={{
                backgroundColor: i === 1 ? "#FFC20E" : "#F3FE8C",
                padding: "9px 4px",
                textAlign: "center",
                fontWeight: "bold",
                fontSize: 12,
                color: navy,
                borderRight: i < 2 ? "1px solid #bbb" : undefined,
                borderBottom: "1px solid #bbb",
              }}
            >
              {label}
            </div>
          ))}
          {[toDDMMYYYY(invoiceDate), `CAD$ ${money(total)}`, dueDate ? toDDMMYYYY(dueDate) : "-"].map((val, i) => (
            <div
              key={i}
              style={{
                backgroundColor: i === 1 ? "#FFC20E" : "#F3FE8C",
                padding: "9px 4px",
                textAlign: "center",
                fontWeight: "bold",
                fontSize: 13,
                color: navy,
                borderRight: i < 2 ? "1px solid #bbb" : undefined,
              }}
            >
              {val}
            </div>
          ))}
        </div>
      </div>

      <HR color="#111" mt={4} mb={0} />

      {/* ── Line items table — no DATE column ── */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            {["PRODUCT", "DESCRIPTION", "TAX", "QTY", "RATE", "AMOUNT"].map((h) => (
              <th
                key={h}
                style={{
                  textAlign: h === "QTY" || h === "RATE" || h === "AMOUNT" ? "right" : "left",
                  padding: "6px 6px",
                  fontWeight: "bold",
                  fontSize: 13,
                  borderBottom: "1px solid #111",
                  color: navy,
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lineItems.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ padding: "10px 6px", color: "#aaa", fontStyle: "italic", fontSize: 13 }}>
                No line items yet
              </td>
            </tr>
          ) : (
            lineItems.map((item, i) => (
              <tr key={i}>
                <td style={{ padding: "6px 6px" }}>{item.description}</td>
                <td style={{ padding: "6px 6px" }}>{item.activity}</td>
                <td style={{ padding: "6px 6px" }}>{taxLabel ?? ""}</td>
                <td style={{ padding: "6px 6px", textAlign: "right" }}>{item.quantity}</td>
                <td style={{ padding: "6px 6px", textAlign: "right" }}>{smartMoney(item.unitPrice)}</td>
                <td style={{ padding: "6px 6px", textAlign: "right" }}>{money(item.quantity * item.unitPrice)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <HR color="#111" mt={0} mb={12} />

      {/* ── Totals — Other Charges above Subtotal, not bold; matches pdf.ts ── */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ minWidth: 260, fontSize: 13 }}>
          {otherChargesAmount > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
              <span style={{ color: gold }}>{otherChargesLabel || "OTHER"}</span>
              <span>{money(otherChargesAmount)}</span>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
            <span style={{ color: gold, fontWeight: "bold" }}>SUBTOTAL</span>
            <span>{money(subtotal + otherChargesAmount)}</span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
            <span style={{ color: gold, fontWeight: "bold" }}>
              {taxLabel ?? "GST"}@{gstHstRateDisplay}
            </span>
            <span>{money(gstHstAmount)}</span>
          </div>

          {pstQstAmount > 0 && pstQstRateDisplay && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
              <span style={{ color: gold, fontWeight: "bold" }}>PST/QST@{pstQstRateDisplay}</span>
              <span>{money(pstQstAmount)}</span>
            </div>
          )}

          <div style={{ borderTop: "1px solid #111", margin: "6px 0" }} />

          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: 15 }}>
            <span style={{ color: gold }}>TOTAL AMOUNT.</span>
            <span>CAD$ {money(total)}</span>
          </div>

          <div style={{ borderTop: "1px solid #111", marginTop: 8 }} />
        </div>
      </div>

      <div style={{ marginTop: 24, fontSize: 13, fontWeight: "bold", color: navy, whiteSpace: "pre-line" }}>
        {combinedFooterText}
      </div>
    </div>
  );
}
