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
    poBox: string | null;
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
    poBox: string | null;
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

export function toDDMMYYYY(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length === 3 && parts[0].length === 4) {
    const [y, m, d] = parts;
    return `${d}-${m}-${y}`;
  }
  return dateStr;
}

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

export function loadLogoDataUrl(): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const maxDim = 200;
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve("");
    img.src = "/icon-192.png";
  });
}

function drawBusinessHeader(doc: jsPDF, title: string, logoDataUrl: string | undefined): number {
  const gold = businessConfig.colors.gold;
  const navy = businessConfig.colors.text;
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 30;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(gold);
  doc.text(title, pageWidth / 2, 46, { align: "center" });

  let y = 86;
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", pageWidth - margin - 72, 50, 72, 72);
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(navy);
  doc.text(businessConfig.name, margin, y);
  y += 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(navy);
  doc.text(businessConfig.legalName, margin, y);
  y += 22;

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
    doc.setFontSize(13);
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

function wrapLines(doc: jsPDF, text: string, maxWidth: number): string[] {
  return text.split("\n").flatMap((line) => doc.splitTextToSize(line, maxWidth) as string[]);
}

function computeTotalsBlockHeight(
  doc: jsPDF,
  data: InvoicePdfData,
  pageWidth: number,
  margin: number,
  combinedFooterText: string
): number {
  const rowH = 20;
  let h = 0;
  h += rowH;
  if (data.otherChargesAmount) h += rowH;
  h += rowH;
  if (data.pstQstAmount > 0 && data.pstQstRateDisplay) h += rowH;
  h += 20;
  h += 22;
  h += 14;

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
  const doc = new jsPDF({ unit: "pt", format: "letter", compress: true });
  const gold = businessConfig.colors.gold;
  const navy = businessConfig.colors.text;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 30;
  const bottomMargin = 40;

  let y = drawBusinessHeader(doc, `INVOICE ${data.invoiceNumber}`, data.logoDataUrl);

  const billToTop = y;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(navy);
  doc.text("BILL TO:-", margin, y);
  y += 19;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.text(data.customer.name, margin, y);
  y += 17;

  if (data.customer.street) {
    doc.text(data.customer.street, margin, y);
    y += 17;
  }

  if (data.customer.poBox) {
    doc.text(`PO Box ${data.customer.poBox}`, margin, y);
    y += 17;
  }

  const cityLine = [data.customer.city, data.customer.province?.province, data.customer.postalCode]
    .filter(Boolean)
    .join(", ");
  if (cityLine) {
    doc.text(cityLine, margin, y);
    y += 4;
  }

  const boxPadding = 10;
  const labelFontSize = 12;
  const valueFontSize = 13;
  const rowH = 34;

  const boxLabels = ["DATE", "PLEASE PAY", "DUE DATE"];
  const boxValues = [
    toDDMMYYYY(data.invoiceDate),
    `CAD$ ${money(data.total)}`,
    data.dueDate ? toDDMMYYYY(data.dueDate) : "-",
  ];

  const colWidths = boxLabels.map((label, i) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(labelFontSize);
    const labelW = doc.getTextWidth(label);
    doc.setFontSize(valueFontSize);
    const valueW = doc.getTextWidth(boxValues[i]);
    return Math.max(labelW, valueW) + boxPadding * 2;
  });

  const boxWidth = colWidths.reduce((a, b) => a + b, 0);
  const boxX = pageWidth - margin - boxWidth;
  const boxY = billToTop - 14;

  const colX: number[] = [];
  let cum = boxX;
  for (const w of colWidths) {
    colX.push(cum);
    cum += w;
  }

  const colFills: [number, number, number][] = [
    [243, 254, 140],
    [255, 194, 14],
    [243, 254, 140],
  ];
  for (let ci = 0; ci < 3; ci++) {
    doc.setFillColor(...colFills[ci]);
    doc.rect(colX[ci], boxY, colWidths[ci], rowH * 2, "F");
  }

  doc.setDrawColor(180);
  doc.setLineWidth(0.5);
  doc.rect(boxX, boxY, boxWidth, rowH * 2);
  doc.line(colX[1], boxY, colX[1], boxY + rowH * 2);
  doc.line(colX[2], boxY, colX[2], boxY + rowH * 2);
  doc.line(boxX, boxY + rowH, boxX + boxWidth, boxY + rowH);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(labelFontSize);
  doc.setTextColor(navy);
  for (let ci = 0; ci < 3; ci++) {
    doc.text(boxLabels[ci], colX[ci] + colWidths[ci] / 2, boxY + rowH * 0.6, { align: "center" });
  }

  doc.setFontSize(valueFontSize);
  for (let ci = 0; ci < 3; ci++) {
    doc.text(boxValues[ci], colX[ci] + colWidths[ci] / 2, boxY + rowH + rowH * 0.6, { align: "center" });
  }

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
    styles: { fontSize: 13, textColor: navy },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: navy,
      fontStyle: "bold",
      fontSize: 13,
    },
    didParseCell: (hookData) => {
      if ([3, 4, 5].includes(hookData.column.index)) {
        hookData.cell.styles.halign = "right";
      }
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

  const combinedFooterText = data.footerNote
    ? `${businessConfig.defaultFooterNote}\n${data.footerNote}`
    : businessConfig.defaultFooterNote;

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

  doc.setFontSize(13);

  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.line(margin, totalsY - 16, pageWidth - margin, totalsY - 16);

  if (data.otherChargesAmount) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(gold);
    doc.text((data.otherChargesLabel ?? "OTHER").toUpperCase(), labelX, totalsY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(navy);
    doc.text(money(data.otherChargesAmount), valueX, totalsY, { align: "right" });
    totalsY += 20;
  }

  doc.setFont("helvetica", "bold");
  doc.setTextColor(gold);
  doc.text("SUBTOTAL", labelX, totalsY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(navy);
  doc.text(money(data.subtotal), valueX, totalsY, { align: "right" });
  totalsY += 20;

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

  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.line(margin, totalsY, pageWidth - margin, totalsY);
  totalsY += 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
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
    doc.setFontSize(13);
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
  doc.setFontSize(13);
  doc.setTextColor(navy);
  const footerLines = wrapLines(doc, combinedFooterText, pageWidth - margin * 2);
  let footerY = totalsY + 28;
  for (const line of footerLines) {
    doc.text(line, margin, footerY);
    footerY += 16;
  }

  return doc;
}

export function generatePackingSlipPdf(data: PackingSlipPdfData): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter", compress: true });
  const navy = businessConfig.colors.text;
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;

  const title = data.invoiceNumber ? `PACKING SLIP ${data.invoiceNumber}` : "PACKING SLIP";
  let y = drawBusinessHeader(doc, title, data.logoDataUrl);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(navy);
  doc.text("SHIP TO:-", margin, y);
  y += 19;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.text(data.customer.name, margin, y);
  y += 17;

  if (data.customer.street) {
    doc.text(data.customer.street, margin, y);
    y += 17;
  }

  if (data.customer.poBox) {
    doc.text(`PO Box ${data.customer.poBox}`, margin, y);
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
  doc.setFontSize(13);
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
    styles: { fontSize: 13, textColor: navy },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: navy,
      fontStyle: "bold",
      fontSize: 13,
    },
    didParseCell: (hookData) => {
      if (hookData.column.index === 2) {
        hookData.cell.styles.halign = "right";
      }
    },
    theme: "plain",
  });

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