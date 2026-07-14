import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { businessConfig } from "./business-config";

export type InvoicePdfData = {
  invoiceNumber: string;
  invoiceDate: string; // formatted display date
  dueDate: string | null;
  customer: {
    name: string;
    street: string | null;
    city: string | null;
    postalCode: string | null;
    province: { province: string } | null;
  };
  lineItems: {
    activity: string;
    description: string;
    quantity: number;
    unitPrice: number;
  }[];
  taxLabel: string | null;
  gstHstRateDisplay: string; // e.g. "5%" or "13%"
  pstQstRateDisplay: string | null; // null if not applicable
  subtotal: number;
  otherChargesLabel: string | null;
  otherChargesAmount: number;
  gstHstAmount: number;
  pstQstAmount: number;
  total: number;
  footerNote: string | null;
};

const money = (n: number) => n.toFixed(2);

export function generateInvoicePdf(data: InvoicePdfData): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const gold = businessConfig.colors.gold;
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(gold);
  doc.text(`INVOICE ${data.invoiceNumber}`, pageWidth / 2, 50, { align: "center" });

  // Business header (left)
  let y = 85;
  doc.setFontSize(12);
  doc.setTextColor(businessConfig.colors.text);
  doc.text(businessConfig.name, margin, y);
  y += 16;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(10);
  doc.text(businessConfig.legalName, margin, y);
  y += 15;
  doc.setFont("helvetica", "normal");
  const headerLines = [
    businessConfig.contactName,
    businessConfig.phone,
    businessConfig.email,
    businessConfig.website,
    "GST/HST Registration No:",
    businessConfig.gstHstNumber,
    `Business Number ${businessConfig.businessNumber}`,
  ];
  for (const line of headerLines) {
    doc.text(line, margin, y);
    y += 15;
  }

  // Divider
  y += 5;
  doc.setDrawColor(150);
  doc.line(margin, y, pageWidth - margin, y);
  y += 20;

  // Bill To (left) + Date/Pay/Due box (right), same row
  const billToTop = y;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("BILL TO:-", margin, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.text(data.customer.name, margin, y);
  y += 15;
  if (data.customer.street) {
    doc.text(data.customer.street, margin, y);
    y += 15;
  }
  const cityLine = [data.customer.city, data.customer.province?.province, data.customer.postalCode]
    .filter(Boolean)
    .join(", ");
  if (cityLine) {
    doc.text(cityLine, margin, y);
    y += 15;
  }

  // Date / Please Pay / Due Date box
  const boxWidth = 170;
  const boxX = pageWidth - margin - boxWidth;
  const boxY = billToTop - 12;
  const colWidth = boxWidth / 3;
  doc.setFillColor(businessConfig.colors.paleYellow);
  doc.rect(boxX, boxY, boxWidth, 45, "F");
  doc.setDrawColor(200);
  doc.rect(boxX, boxY, boxWidth, 45);
  doc.line(boxX + colWidth, boxY, boxX + colWidth, boxY + 45);
  doc.line(boxX + colWidth * 2, boxY, boxX + colWidth * 2, boxY + 45);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("DATE", boxX + colWidth / 2, boxY + 14, { align: "center" });
  doc.text("PLEASE PAY", boxX + colWidth + colWidth / 2, boxY + 14, { align: "center" });
  doc.text("DUE DATE", boxX + colWidth * 2 + colWidth / 2, boxY + 14, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(data.invoiceDate, boxX + colWidth / 2, boxY + 32, { align: "center" });
  doc.text(`CAD$ ${money(data.total)}`, boxX + colWidth + colWidth / 2, boxY + 32, { align: "center" });
  doc.text(data.dueDate ?? "-", boxX + colWidth * 2 + colWidth / 2, boxY + 32, { align: "center" });

  y = Math.max(y, boxY + 45) + 20;

  // Line items table
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["DATE", "ACTIVITY", "DESCRIPTION", "TAX", "QTY", "RATE", "AMOUNT"]],
    body: data.lineItems.map((item) => [
      data.invoiceDate,
      item.activity,
      item.description,
      data.taxLabel ?? "",
      String(item.quantity),
      money(item.unitPrice),
      money(item.quantity * item.unitPrice),
    ]),
    styles: { fontSize: 9, textColor: businessConfig.colors.text },
    headStyles: { fillColor: [255, 255, 255], textColor: businessConfig.colors.text, fontStyle: "bold" },
    theme: "plain",
  });

  // Totals block, right-aligned under the table
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let totalsY = (doc as any).lastAutoTable.finalY + 15;
  const labelX = pageWidth - margin - 140;
  const valueX = pageWidth - margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(gold);
  doc.text("SUBTOTAL", labelX, totalsY);
  doc.setTextColor(businessConfig.colors.text);
  doc.text(money(data.subtotal), valueX, totalsY, { align: "right" });
  totalsY += 16;

  if (data.otherChargesAmount) {
    doc.setTextColor(gold);
    doc.text((data.otherChargesLabel ?? "OTHER").toUpperCase(), labelX, totalsY);
    doc.setTextColor(businessConfig.colors.text);
    doc.text(money(data.otherChargesAmount), valueX, totalsY, { align: "right" });
    totalsY += 16;
  }

  doc.setTextColor(gold);
  doc.text(`${data.taxLabel ?? "GST"}@${data.gstHstRateDisplay}`, labelX, totalsY);
  doc.setTextColor(businessConfig.colors.text);
  doc.text(money(data.gstHstAmount), valueX, totalsY, { align: "right" });
  totalsY += 16;

  if (data.pstQstAmount > 0 && data.pstQstRateDisplay) {
    doc.setTextColor(gold);
    doc.text(`PST/QST@${data.pstQstRateDisplay}`, labelX, totalsY);
    doc.setTextColor(businessConfig.colors.text);
    doc.text(money(data.pstQstAmount), valueX, totalsY, { align: "right" });
    totalsY += 16;
  }

  totalsY += 4;
  doc.setDrawColor(gold);
  doc.line(labelX - 10, totalsY - 12, valueX, totalsY - 12);
  doc.setFontSize(12);
  doc.setTextColor(gold);
  doc.text("TOTAL AMOUNT.", labelX, totalsY);
  doc.setTextColor(businessConfig.colors.text);
  doc.text(`CAD$ ${money(data.total)}`, valueX, totalsY, { align: "right" });

  // Footer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(businessConfig.colors.text);
  doc.text(data.footerNote ?? businessConfig.defaultFooterNote, margin, totalsY + 40);

  return doc;
}
