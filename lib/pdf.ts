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

export type PackingSlipPdfData = {
  invoiceNumber?: string;
  shipDate: string;
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
  }[];
};

const money = (n: number) => n.toFixed(2);

/** Converts a "YYYY-MM-DD"-ish string (e.g. from toLocaleDateString("en-CA"))
 * to "DD-MM-YYYY" for display, without going through Date parsing — avoids
 * timezone-shift bugs from re-parsing an already-formatted date. */
export function toDDMMYYYY(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length === 3 && parts[0].length === 4) {
    const [y, m, d] = parts;
    return `${d}-${m}-${y}`;
  }
  return dateStr;
}

/** Pulls the trailing number out of an invoice number/reference in any
 * format ("2003", "CNC-INV 2003") — used for consistent filenames. */
export function extractNumericId(value: string): string {
  const match = value.match(/(\d+)\s*$/);
  return match ? match[1] : value;
}

export function invoiceFilename(invoiceNumber: string): string {
  return `CNC-INV #${extractNumericId(invoiceNumber)}.pdf`;
}

export function packingSlipFilename(reference?: string): string {
  return `CNC-PAK #${reference ? extractNumericId(reference) : "draft"}.pdf`;
}

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
    img.src = "/icon-192.png";
  });
}

/** Shared business header (logo, name, legal name, contact block) + divider. */
function drawBusinessHeader(doc: jsPDF, title: string, logoDataUrl: string | undefined): number {
  const gold = businessConfig.colors.gold;
  const navy = businessConfig.colors.text;
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 30;

  // Title — reduced from 24 to 18pt (was too dominant on the page)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(gold);
  doc.text(title, pageWidth / 2, 46, { align: "center" });

 

  let y = 86;
   if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", pageWidth - margin - 72, 50, 72, 72);
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17); // was 15, +2
  doc.setTextColor(navy);
  doc.text(businessConfig.name, margin, y);
  y += 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13); // was 11, +2
  doc.setTextColor(navy);
  doc.text(businessConfig.legalName, margin, y);
  y += 18;

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
      doc.setTextColor(0, 100, 210);
    } else {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(navy);
    }
    doc.setFontSize(13); // was 11, +2
    doc.text(line, margin, y);
    y += 17;
  }

  doc.setFont("helvetica", "normal");
  doc.setTextColor(navy);

  y += 6;
  doc.setDrawColor(150);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 22;

  return y;
}

/** Wraps footer/notes text consistently, reused by both the height
 * calculator and the actual renderer so they can never disagree. */
function wrapLines(doc: jsPDF, text: string, maxWidth: number): string[] {
  return text.split("\n").flatMap((line) => doc.splitTextToSize(line, maxWidth) as string[]);
}

/** Computes how tall the totals+notes+footer block will be, so it can be
 * pinned to the bottom of whichever page it ends up on. */
function computeTotalsBlockHeight(
  doc: jsPDF,
  data: InvoicePdfData,
  pageWidth: number,
  margin: number,
  combinedFooterText: string
): number {
  const rowH = 20;
  let h = 0;
  h += rowH; // subtotal
  if (data.otherChargesAmount) h += rowH;
  h += rowH; // tax
  if (data.pstQstAmount > 0 && data.pstQstRateDisplay) h += rowH;
  h += 20; // line-before-total clearance
  h += 22; // TOTAL row
  h += 14; // line-after-total gap

  if (data.extraNotes && data.extraNotes.some((n) => n.trim())) {
    h += 20;
    for (const note of data.extraNotes) {
      if (!note.trim()) continue;
      h += wrapLines(doc, `\u2022 ${note}`, pageWidth - margin * 2).length * 18;
    }
  }

  h += 28 + wrapLines(doc, combinedFooterText, pageWidth - margin * 2).length * 16;
  return h;
}

export function generateInvoicePdf(data: InvoicePdfData): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const gold = businessConfig.colors.gold;
  const navy = businessConfig.colors.text;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const bottomMargin = 40;

  let y = drawBusinessHeader(doc, `INVOICE ${data.invoiceNumber}`, data.logoDataUrl);

  const billToTop = y;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15); // was 13, +2
  doc.setTextColor(navy);
  doc.text("BILL TO:-", margin, y);
  y += 19;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(13); // was 11, +2
  doc.text(data.customer.name, margin, y);
  y += 17;

  if (data.customer.street) {
    doc.text(data.customer.street, margin, y);
    y += 17;
  }

  const cityLine = [data.customer.city, data.customer.province?.province, data.customer.postalCode]
    .filter(Boolean)
    .join(", ");
  if (cityLine) {
    doc.text(cityLine, margin, y);
    y += 17;
  }

  const boxWidth = 252;
  const boxX = pageWidth - margin - boxWidth;
  const boxY = billToTop - 14;
  const colWidth = boxWidth / 3;
  const rowH = 34;

  const colFills: [number, number, number][] = [
    [243, 254, 140],
    [255, 194, 14],
    [243, 254, 140],
  ];
  for (let ci = 0; ci < 3; ci++) {
    doc.setFillColor(...colFills[ci]);
    doc.rect(boxX + ci * colWidth, boxY, colWidth, rowH * 2, "F");
  }

  doc.setDrawColor(180);
  doc.setLineWidth(0.5);
  doc.rect(boxX, boxY, boxWidth, rowH * 2);
  doc.line(boxX + colWidth, boxY, boxX + colWidth, boxY + rowH * 2);
  doc.line(boxX + colWidth * 2, boxY, boxX + colWidth * 2, boxY + rowH * 2);
  doc.line(boxX, boxY + rowH, boxX + boxWidth, boxY + rowH);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12); // was 10, +2
  doc.setTextColor(navy);
  doc.text("DATE", boxX + colWidth / 2, boxY + rowH * 0.6, { align: "center" });
  doc.text("PLEASE PAY", boxX + colWidth + colWidth / 2, boxY + rowH * 0.6, { align: "center" });
  doc.text("DUE DATE", boxX + colWidth * 2 + colWidth / 2, boxY + rowH * 0.6, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13); // was 11, +2
  doc.text(toDDMMYYYY(data.invoiceDate), boxX + colWidth / 2, boxY + rowH + rowH * 0.6, { align: "center" });
  doc.text(`CAD $${money(data.total)}`, boxX + colWidth + colWidth / 2, boxY + rowH + rowH * 0.6, { align: "center" });
  doc.text(
    data.dueDate ? toDDMMYYYY(data.dueDate) : "-",
    boxX + colWidth * 2 + colWidth / 2,
    boxY + rowH + rowH * 0.6,
    { align: "center" }
  );

  y = Math.max(y, boxY + rowH * 2) + 18;

  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);

  let headBottomY = 0;

  autoTable(doc, {
    startY: y + 1,
    margin: { left: margin, right: margin, bottom: bottomMargin },
    head: [["PRODUCT", "DESCRIPTION", "TAX", "QTY", "RATE", "AMOUNT"]],
    body: data.lineItems.map((item) => [
      item.description,
      item.activity,
      data.taxLabel ?? "",
      String(item.quantity),
      money(item.unitPrice),
      money(item.quantity * item.unitPrice),
    ]),
    styles: { fontSize: 13, textColor: navy }, // was 11, +2
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: navy,
      fontStyle: "bold",
      fontSize: 13, // was 11, +2
    },
    theme: "plain",
    didDrawCell: (hookData) => {
      if (hookData.row.section === "head") {
        headBottomY = Math.max(headBottomY, hookData.cell.y + hookData.cell.height);
      }
    },
  });

  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.line(margin, headBottomY, pageWidth - margin, headBottomY);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalTableY = (doc as any).lastAutoTable.finalY;

  // ── Footer text: default clause always stays, manually-typed note is
  // appended after it rather than replacing it ──────────────────────────────
  const combinedFooterText = data.footerNote
    ? `${businessConfig.defaultFooterNote}\n${data.footerNote}`
    : businessConfig.defaultFooterNote;

  // ── Pin totals+notes+footer to the bottom of the page — same page as the
  // table if there's room, otherwise a fresh page, per the requested layout ──
  const blockHeight = computeTotalsBlockHeight(doc, data, pageWidth, margin, combinedFooterText);
  const availableSpace = pageHeight - bottomMargin - finalTableY;
  let totalsY: number;
  if (blockHeight <= availableSpace) {
    totalsY = pageHeight - bottomMargin - blockHeight;
  } else {
    doc.addPage();
    totalsY = pageHeight - bottomMargin - blockHeight;
  }

  const labelX = pageWidth - margin - 250;
  const valueX = pageWidth - margin - 10;

  doc.setFontSize(13); // was 11, +2

  // Divider line moved here — directly above the totals block instead of
  // right after the table, since totals are bottom-pinned and can sit far
  // down the page from where the table actually ends.
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.line(margin, totalsY - 16, pageWidth - margin, totalsY - 16);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(gold);
  doc.text("SUBTOTAL", labelX, totalsY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(navy);
  doc.text(money(data.subtotal), valueX, totalsY, { align: "right" });
  totalsY += 20;

  if (data.otherChargesAmount) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(gold);
    doc.text((data.otherChargesLabel ?? "OTHER").toUpperCase(), labelX, totalsY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(navy);
    doc.text(money(data.otherChargesAmount), valueX, totalsY, { align: "right" });
    totalsY += 20;
  }

  doc.setFont("helvetica", "bold");
  doc.setTextColor(gold);
  doc.text(`${data.taxLabel ?? "GST"}@${data.gstHstRateDisplay}`, labelX, totalsY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(navy);
  doc.text(money(data.gstHstAmount), valueX, totalsY, { align: "right" });
  totalsY += 20;

  if (data.pstQstAmount > 0 && data.pstQstRateDisplay) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(gold);
    doc.text(`PST/QST@${data.pstQstRateDisplay}`, labelX, totalsY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(navy);
    doc.text(money(data.pstQstAmount), valueX, totalsY, { align: "right" });
    totalsY += 20;
  }

  // ── Line before total — then advance a generous, fixed gap before drawing
  // the text baseline, instead of the old fixed-offset-behind-the-line
  // approach that let the line clip through the text's ascenders ───────────
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.line(margin, totalsY, pageWidth - margin, totalsY);
  totalsY += 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15); // was 13, +2
  doc.setTextColor(gold);
  doc.text("TOTAL AMOUNT.", labelX, totalsY);
  doc.setTextColor(navy);
  doc.text(`CAD$ ${money(data.total)}`, valueX, totalsY, { align: "right" });

  totalsY += 14;
  doc.setDrawColor(0);
  doc.line(margin, totalsY, pageWidth - margin, totalsY);

  if (data.extraNotes && data.extraNotes.some((n) => n.trim())) {
    let notesY = totalsY + 20;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(13); // was 11, +2
    doc.setTextColor(navy);
    for (const note of data.extraNotes) {
      if (!note.trim()) continue;
      const lines = wrapLines(doc, `\u2022 ${note}`, pageWidth - margin * 2);
      for (const line of lines) {
        doc.text(line, margin, notesY);
        notesY += 18;
      }
    }
    totalsY = notesY - 4;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13); // was 11, +2
  doc.setTextColor(navy);
  const footerLines = wrapLines(doc, combinedFooterText, pageWidth - margin * 2);
  let footerY = totalsY + 28;
  for (const line of footerLines) {
    doc.text(line, margin, footerY);
    footerY += 16;
  }

  return doc;
}

/** Driver-facing packing slip — same header/branding as the invoice, but
 * deliberately has no prices, tax, or totals anywhere on the page. */
export function generatePackingSlipPdf(data: PackingSlipPdfData): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const navy = businessConfig.colors.text;
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;

  // Heading includes the reference number directly (e.g. "PACKING SLIP
  // 2003") instead of a separate small "Ref:" line below the header.
  const title = data.invoiceNumber ? `PACKING SLIP ${data.invoiceNumber}` : "PACKING SLIP";
  let y = drawBusinessHeader(doc, title, data.logoDataUrl);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15); // was 13, +2
  doc.setTextColor(navy);
  doc.text("SHIP TO:-", margin, y);
  y += 19;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(13); // was 11, +2
  doc.text(data.customer.name, margin, y);
  y += 17;

  if (data.customer.street) {
    doc.text(data.customer.street, margin, y);
    y += 17;
  }

  const cityLine = [data.customer.city, data.customer.province?.province, data.customer.postalCode]
    .filter(Boolean)
    .join(", ");
  if (cityLine) {
    doc.text(cityLine, margin, y);
    y += 17;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13); // was inheriting 11, now explicit +2
  doc.text(`Ship Date: ${toDDMMYYYY(data.shipDate)}`, margin, y);
  y += 26;

  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);

  autoTable(doc, {
    startY: y + 1,
    margin: { left: margin, right: margin },
    head: [["PRODUCT", "DESCRIPTION", "QTY"]],
    body: data.lineItems.map((item) => [item.description, item.activity, String(item.quantity)]),
    styles: { fontSize: 13, textColor: navy }, // was 11, +2
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: navy,
      fontStyle: "bold",
      fontSize: 13, // was 11, +2
    },
    theme: "plain",
  });

  // ── Name / Signature block — bottom-pinned like the invoice's totals,
  // so it sits near the bottom of the page regardless of line item count,
  // and moves to a fresh page rather than crowding a long table ──────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalTableY = (doc as any).lastAutoTable.finalY;
  const pageHeight = doc.internal.pageSize.getHeight();
  const bottomMargin = 40;
  const labelGap = 16;

  let lineY: number;
  if (finalTableY + 60 <= pageHeight - bottomMargin) {
    lineY = pageHeight - bottomMargin - labelGap;
  } else {
    doc.addPage();
    lineY = pageHeight - bottomMargin - labelGap;
  }

  const colGap = 40;
  const colWidth = (pageWidth - margin * 2 - colGap) / 2;
  const nameLineStart = margin;
  const nameLineEnd = margin + colWidth;
  const signLineStart = pageWidth - margin - colWidth;
  const signLineEnd = pageWidth - margin;

  doc.setDrawColor(0);
  doc.setLineWidth(0.75);
  doc.line(nameLineStart, lineY, nameLineEnd, lineY);
  doc.line(signLineStart, lineY, signLineEnd, lineY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(navy);
  doc.text("Name", nameLineStart, lineY + labelGap);
  doc.text("Signature", signLineStart, lineY + labelGap);

  return doc;
}