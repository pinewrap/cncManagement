"use client";

import { businessConfig } from "@/lib/business-config";

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
const money = (n: number) => n.toFixed(2);

const HR = ({ color = "#aaa", mt = 10, mb = 10 }: { color?: string; mt?: number; mb?: number }) => (
  <div style={{ borderTop: `1px solid ${color}`, marginTop: mt, marginBottom: mb }} />
);

export default function InvoicePreview({
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

  return (
    <div
      style={{ fontFamily: "Helvetica, Arial, sans-serif", color: navy, fontSize: 12 }}
      className="rounded-lg border bg-white p-8 shadow-sm"
    >
      {/* ── Title ── */}
      <div style={{ textAlign: "center", color: gold, fontSize: 24, fontWeight: "bold", marginBottom: 20 }}>
        INVOICE <span style={{ opacity: 0.45 }}>#PREVIEW</span>
      </div>

      {/* ── Business info (left) + Logo placeholder (right) ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ lineHeight: 1.6 }}>
          <div style={{ fontSize: 15, fontWeight: "bold" }}>{businessConfig.name}</div>
          <div style={{ fontStyle: "italic", fontSize: 11 }}>{businessConfig.legalName}</div>
          <div style={{ fontSize: 11 }}>{businessConfig.contactName}</div>
          <div style={{ fontSize: 11 }}>{businessConfig.phone}</div>
          {/* Email — blue + bold */}
          <div style={{ fontSize: 11, fontWeight: "bold", color: "rgb(0,100,210)" }}>
            {businessConfig.email}
          </div>
          <div style={{ fontSize: 11 }}>{businessConfig.website}</div>
          <div style={{ fontSize: 11 }}>GST/HST Registration No:</div>
          <div style={{ fontSize: 11 }}>{businessConfig.gstHstNumber}</div>
          <div style={{ fontSize: 11 }}>Business Number {businessConfig.businessNumber}</div>
        </div>
        {/* Logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="logo" style={{ width: 72, height: 72, objectFit: "contain" }} />
      </div>

      {/* ── Divider after header ── */}
      <HR color="#aaa" mt={14} mb={14} />

      {/* ── Bill To (left) + Date/Pay/Due box (right) ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        {/* Bill To */}
        <div style={{ fontSize: 11 }}>
          <div style={{ fontWeight: "bold", fontSize: 13, marginBottom: 5 }}>BILL TO:-</div>
          {customer ? (
            <>
              <div>{customer.name}</div>
              {customer.street && <div>{customer.street}</div>}
              {cityLine && <div>{cityLine}</div>}
            </>
          ) : (
            <div style={{ color: "#aaa", fontStyle: "italic" }}>No customer selected</div>
          )}
        </div>

        {/* Date / Pay / Due box — per-column colours, bigger */}
        <div
          style={{
            border: "1px solid #bbb",
            minWidth: 264,
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            fontSize: 10,
            flexShrink: 0,
          }}
        >
          {/* Label row */}
          {(["DATE", "PLEASE PAY", "DUE DATE"] as const).map((label, i) => (
            <div
              key={label}
              style={{
                backgroundColor: i === 1 ? "#FFC20E" : "#F3FE8C",
                padding: "9px 4px",
                textAlign: "center",
                fontWeight: "bold",
                fontSize: 10,
                color: navy,
                borderRight: i < 2 ? "1px solid #bbb" : undefined,
                borderBottom: "1px solid #bbb",
              }}
            >
              {label}
            </div>
          ))}
          {/* Value row */}
          {[invoiceDate, `CAD$ ${money(total)}`, dueDate || "-"].map((val, i) => (
            <div
              key={i}
              style={{
                backgroundColor: i === 1 ? "#FFC20E" : "#F3FE8C",
                padding: "9px 4px",
                textAlign: "center",
                fontWeight: "bold",
                fontSize: 11,
                color: navy,
                borderRight: i < 2 ? "1px solid #bbb" : undefined,
              }}
            >
              {val}
            </div>
          ))}
        </div>
      </div>

      {/* ── Line above table header ── */}
      <HR color="#111" mt={4} mb={0} />

      {/* ── Line items table ── */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
        <thead>
          <tr>
            {["DATE", "PRODUCT", "DESCRIPTION", "TAX", "QTY", "RATE", "AMOUNT"].map((h) => (
              <th
                key={h}
                style={{
                  textAlign: "left",
                  padding: "6px 6px",
                  fontWeight: "bold",
                  fontSize: 11,
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
              <td colSpan={7} style={{ padding: "10px 6px", color: "#aaa", fontStyle: "italic", fontSize: 11 }}>
                No line items yet
              </td>
            </tr>
          ) : (
            lineItems.map((item, i) => (
              <tr key={i}>
                <td style={{ padding: "6px 6px" }}>{invoiceDate}</td>
                <td style={{ padding: "6px 6px" }}>{item.description}</td>
                <td style={{ padding: "6px 6px" }}>{item.activity}</td>
                <td style={{ padding: "6px 6px" }}>{taxLabel ?? ""}</td>
                <td style={{ padding: "6px 6px" }}>{item.quantity}</td>
                <td style={{ padding: "6px 6px" }}>{money(item.unitPrice)}</td>
                <td style={{ padding: "6px 6px" }}>{money(item.quantity * item.unitPrice)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* ── Line below table body ── */}
      <HR color="#111" mt={0} mb={12} />

      {/* ── Totals — right-aligned ── */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ minWidth: 260, fontSize: 11 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
            <span style={{ color: gold }}>SUBTOTAL</span>
            <span>{money(subtotal)}</span>
          </div>

          {otherChargesAmount > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
              <span style={{ color: gold }}>{(otherChargesLabel || "OTHER").toUpperCase()}</span>
              <span>{money(otherChargesAmount)}</span>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
            <span style={{ color: gold }}>
              {taxLabel ?? "GST"}@{gstHstRateDisplay}
            </span>
            <span>{money(gstHstAmount)}</span>
          </div>

          {pstQstAmount > 0 && pstQstRateDisplay && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
              <span style={{ color: gold }}>PST/QST@{pstQstRateDisplay}</span>
              <span>{money(pstQstAmount)}</span>
            </div>
          )}

          {/* Line before total */}
          <div style={{ borderTop: "1px solid #111", margin: "6px 0" }} />

          {/* Total */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontWeight: "bold",
              fontSize: 13,
            }}
          >
            <span style={{ color: gold }}>TOTAL AMOUNT.</span>
            <span>CAD$ {money(total)}</span>
          </div>

          {/* Line after total */}
          <div style={{ borderTop: "1px solid #111", marginTop: 8 }} />
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{ marginTop: 24, fontSize: 11, fontWeight: "bold", color: navy, whiteSpace: "pre-line" }}>
        {footerNote || businessConfig.defaultFooterNote}
      </div>
    </div>
  );
}
