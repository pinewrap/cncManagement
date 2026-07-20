import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { businessConfig } from "./business-config";

export type InvoicePdfData = {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  logoDataUrl?: string;
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
  gstHstRateDisplay: string;
  pstQstRateDisplay: string | null;
  subtotal: number;
  otherChargesLabel: string | null;
  otherChargesAmount: number;
  gstHstAmount: number;
  pstQstAmount: number;
  total: number;
  footerNote: string | null;
  extraNotes?: string[];
};

const money = (n: number) => n.toFixed(2);

/** Preloads /icon-192.png and returns a base64 data URL for embedding in the PDF. */
export function loadLogoDataUrl(): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve("");
    img.src = "/icon-512.png";
  });
}

export function generateInvoicePdf(data: InvoicePdfData): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const gold = businessConfig.colors.gold;
  const navy = businessConfig.colors.text;
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;

  // ── Title ────────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(gold);
  doc.text(`INVOICE ${data.invoiceNumber}`, pageWidth / 2, 52, { align: "center" });

  // ── Logo — top-right ─────────────────────────────────────────────────────
  if (data.logoDataUrl) {
    doc.addImage(data.logoDataUrl, "PNG", pageWidth - margin - 72, 18, 72, 72);
  }

  // ── Business header ───────────────────────────────────────────────────────
  let y = 92;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(navy);
  doc.text(businessConfig.name, margin, y);
  y += 19;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(11);
  doc.text(businessConfig.legalName, margin, y);
  y += 17;

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
    if (line === businessConfig.email) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 100, 210); // blue
    } else {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(navy);
    }
    doc.setFontSize(11);
    doc.text(line, margin, y);
    y += 16;
  }

  doc.setFont("helvetica", "normal");
  doc.setTextColor(navy);

  // ── Divider after header ──────────────────────────────────────────────────
  y += 6;
  doc.setDrawColor(150);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 22;

  // ── Bill To (left) + Date/Pay/Due box (right) ─────────────────────────────
  const billToTop = y;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(navy);
  doc.text("BILL TO:-", margin, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(data.customer.name, margin, y);
  y += 16;

  if (data.customer.street) {
    doc.text(data.customer.street, margin, y);
    y += 16;
  }

  const cityLine = [data.customer.city, data.customer.province?.province, data.customer.postalCode]
    .filter(Boolean)
    .join(", ");
  if (cityLine) {
    doc.text(cityLine, margin, y);
    y += 16;
  }

  // Date / Please Pay / Due Date box
  const boxWidth = 252;
  const boxX = pageWidth - margin - boxWidth;
  const boxY = billToTop - 14;
  const colWidth = boxWidth / 3;
  const rowH = 32;

  // Per-column fills: DATE=#F3FE8C, PLEASE PAY=#FFC20E, DUE DATE=#F3FE8C
  const colFills: [number, number, number][] = [
    [243, 254, 140], // #F3FE8C
    [255, 194,  14], // #FFC20E
    [243, 254, 140], // #F3FE8C
  ];
  for (let ci = 0; ci < 3; ci++) {
    doc.setFillColor(...colFills[ci]);
    doc.rect(boxX + ci * colWidth, boxY, colWidth, rowH * 2, "F");
  }

  // Borders
  doc.setDrawColor(180);
  doc.setLineWidth(0.5);
  doc.rect(boxX, boxY, boxWidth, rowH * 2); // outer
  doc.line(boxX + colWidth,     boxY, boxX + colWidth,     boxY + rowH * 2); // col 1
  doc.line(boxX + colWidth * 2, boxY, boxX + colWidth * 2, boxY + rowH * 2); // col 2
  doc.line(boxX, boxY + rowH, boxX + boxWidth, boxY + rowH);                  // mid row

  // Header labels
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(navy);
  doc.text("DATE",        boxX + colWidth / 2,               boxY + rowH * 0.62, { align: "center" });
  doc.text("PLEASE PAY",  boxX + colWidth + colWidth / 2,     boxY + rowH * 0.62, { align: "center" });
  doc.text("DUE DATE",    boxX + colWidth * 2 + colWidth / 2, boxY + rowH * 0.62, { align: "center" });

  // Values
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(data.invoiceDate,             boxX + colWidth / 2,                 boxY + rowH + rowH * 0.62, { align: "center" });
  doc.text(`CAD$ ${money(data.total)}`,  boxX + colWidth + colWidth / 2,      boxY + rowH + rowH * 0.62, { align: "center" });
  doc.text(data.dueDate ?? "-",          boxX + colWidth * 2 + colWidth / 2,  boxY + rowH + rowH * 0.62, { align: "center" });

  y = Math.max(y, boxY + rowH * 2) + 18;

  // ── Line ABOVE table header ───────────────────────────────────────────────
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);

  // ── Line items table ──────────────────────────────────────────────────────
  let headBottomY = 0;

  autoTable(doc, {
    startY: y + 1,
    margin: { left: margin, right: margin },
    head: [["DATE", "PRODUCT", "DESCRIPTION", "TAX", "QTY", "RATE", "AMOUNT"]],
    body: data.lineItems.map((item) => [
      data.invoiceDate,
      item.description,
      item.activity,
      data.taxLabel ?? "",
      String(item.quantity),
      money(item.unitPrice),
      money(item.quantity * item.unitPrice),
    ]),
    styles: { fontSize: 11, textColor: navy },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: navy,
      fontStyle: "bold",
      fontSize: 11,
    },
    theme: "plain",
    didDrawCell: (hookData) => {
      if (hookData.row.section === "head") {
        headBottomY = Math.max(headBottomY, hookData.cell.y + hookData.cell.height);
      }
    },
  });

  // ── Line BELOW table header ───────────────────────────────────────────────
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.line(margin, headBottomY, pageWidth - margin, headBottomY);

  // ── Line BELOW table body ─────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalTableY = (doc as any).lastAutoTable.finalY;
  doc.line(margin, finalTableY, pageWidth - margin, finalTableY);

  // ── Totals block ──────────────────────────────────────────────────────────
  let totalsY = finalTableY + 20;
  const labelX = pageWidth - margin - 210;
  const valueX = pageWidth - margin - 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  doc.setTextColor(gold);
  doc.text("SUBTOTAL", labelX, totalsY);
  doc.setTextColor(navy);
  doc.text(money(data.subtotal), valueX, totalsY, { align: "right" });
  totalsY += 18;

  if (data.otherChargesAmount) {
    doc.setTextColor(gold);
    doc.text((data.otherChargesLabel ?? "OTHER").toUpperCase(), labelX, totalsY);
    doc.setTextColor(navy);
    doc.text(money(data.otherChargesAmount), valueX, totalsY, { align: "right" });
    totalsY += 18;
  }

  doc.setTextColor(gold);
  doc.text(`${data.taxLabel ?? "GST"}@${data.gstHstRateDisplay}`, labelX, totalsY);
  doc.setTextColor(navy);
  doc.text(money(data.gstHstAmount), valueX, totalsY, { align: "right" });
  totalsY += 18;

  if (data.pstQstAmount > 0 && data.pstQstRateDisplay) {
    doc.setTextColor(gold);
    doc.text(`PST/QST@${data.pstQstRateDisplay}`, labelX, totalsY);
    doc.setTextColor(navy);
    doc.text(money(data.pstQstAmount), valueX, totalsY, { align: "right" });
    totalsY += 18;
  }

  // ── Line BEFORE total ─────────────────────────────────────────────────────
  totalsY += 4;
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.line(margin, totalsY - 8, pageWidth - margin, totalsY - 8);

  // ── TOTAL AMOUNT ──────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(gold);
  doc.text("TOTAL AMOUNT.", labelX, totalsY);
  doc.setTextColor(navy);
  doc.text(`CAD$ ${money(data.total)}`, valueX, totalsY, { align: "right" });

  // ── Line AFTER total ──────────────────────────────────────────────────────
  totalsY += 12;
  doc.setDrawColor(0);
  doc.line(margin, totalsY, pageWidth - margin, totalsY);

  // ── Extra notes (above footer) ───────────────────────────────────────────
  if (data.extraNotes && data.extraNotes.length > 0) {
    let notesY = totalsY + 20;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(navy);
    for (const note of data.extraNotes) {
      if (!note.trim()) continue;
      doc.text(`• ${note}`, margin, notesY, { maxWidth: pageWidth - margin * 2 });
      notesY += 16;
    }
    totalsY = notesY - 4;
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(navy);
  const footerText = data.footerNote ?? businessConfig.defaultFooterNote;
  doc.text(footerText, margin, totalsY + 26, { maxWidth: pageWidth - margin * 2 });

  return doc;
}
