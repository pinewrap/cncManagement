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

function toDDMMYYYY(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length === 3 && parts[0].length === 4) {
    const [y, m, d] = parts;
    return `${d}-${m}-${y}`;
  }
  return dateStr;
}

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

function drawBusinessHeader(doc: jsPDF, title: string, logoDataUrl: string | undefined): number {
  const gold = businessConfig.colors.gold;
  const navy = businessConfig.colors.text;
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(gold);
  doc.text(title, pageWidth / 2, 52, { align: "center" });

  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", pageWidth - margin - 72, 18, 72, 72);
  }

  let y = 92;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(navy);
  doc.text(businessConfig.name, margin, y);
  y += 19;

  // Legal/numbered entity name — bold, black (not italic, per latest request)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(navy);
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
      doc.setTextColor(0, 100, 210);
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

  y += 6;
  doc.setDrawColor(150);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 22;

  return y;
}

export function generateInvoicePdf(data: InvoicePdfData): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const gold = businessConfig.colors.gold;
  const navy = businessConfig.colors.text;
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;

  let y = drawBusinessHeader(doc, `INVOICE ${data.invoiceNumber}`, data.logoDataUrl);

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

  const boxWidth = 252;
  const boxX = pageWidth - margin - boxWidth;
  const boxY = billToTop - 14;
  const colWidth = boxWidth / 3;
  const rowH = 32;

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
  doc.setFontSize(10);
  doc.setTextColor(navy);
  doc.text("DATE", boxX + colWidth / 2, boxY + rowH * 0.62, { align: "center" });
  doc.text("PLEASE PAY", boxX + colWidth + colWidth / 2, boxY + rowH * 0.62, { align: "center" });
  doc.text("DUE DATE", boxX + colWidth * 2 + colWidth / 2, boxY + rowH * 0.62, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(toDDMMYYYY(data.invoiceDate), boxX + colWidth / 2, boxY + rowH + rowH * 0.62, { align: "center" });
  doc.text(`CAD$ ${money(data.total)}`, boxX + colWidth + colWidth / 2, boxY + rowH + rowH * 0.62, { align: "center" });
  doc.text(
    data.dueDate ? toDDMMYYYY(data.dueDate) : "-",
    boxX + colWidth * 2 + colWidth / 2,
    boxY + rowH + rowH * 0.62,
    { align: "center" }
  );

  y = Math.max(y, boxY + rowH * 2) + 18;

  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);

  let headBottomY = 0;

  autoTable(doc, {
    startY: y + 1,
    margin: { left: margin, right: margin },
    head: [["PRODUCT", "DESCRIPTION", "TAX", "QTY", "RATE", "AMOUNT"]],
    body: data.lineItems.map((item) => [
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

  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.line(margin, headBottomY, pageWidth - margin, headBottomY);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalTableY = (doc as any).lastAutoTable.finalY;
  doc.line(margin, finalTableY, pageWidth - margin, finalTableY);

  let totalsY = finalTableY + 20;
  const labelX = pageWidth - margin - 210;
  const valueX = pageWidth - margin - 10;

  doc.setFontSize(11);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(gold);
  doc.text("SUBTOTAL", labelX, totalsY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(navy);
  doc.text(money(data.subtotal), valueX, totalsY, { align: "right" });
  totalsY += 18;

  if (data.otherChargesAmount) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(gold);
    doc.text((data.otherChargesLabel ?? "OTHER").toUpperCase(), labelX, totalsY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(navy);
    doc.text(money(data.otherChargesAmount), valueX, totalsY, { align: "right" });
    totalsY += 18;
  }

  doc.setFont("helvetica", "bold");
  doc.setTextColor(gold);
  doc.text(`${data.taxLabel ?? "GST"}@${data.gstHstRateDisplay}`, labelX, totalsY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(navy);
  doc.text(money(data.gstHstAmount), valueX, totalsY, { align: "right" });
  totalsY += 18;

  if (data.pstQstAmount > 0 && data.pstQstRateDisplay) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(gold);
    doc.text(`PST/QST@${data.pstQstRateDisplay}`, labelX, totalsY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(navy);
    doc.text(money(data.pstQstAmount), valueX, totalsY, { align: "right" });
    totalsY += 18;
  }

  totalsY += 4;
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.line(margin, totalsY - 8, pageWidth - margin, totalsY - 8);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(gold);
  doc.text("TOTAL AMOUNT.", labelX, totalsY);
  doc.setTextColor(navy);
  doc.text(`CAD$ ${money(data.total)}`, valueX, totalsY, { align: "right" });

  totalsY += 12;
  doc.setDrawColor(0);
  doc.line(margin, totalsY, pageWidth - margin, totalsY);

  if (data.extraNotes && data.extraNotes.length > 0) {
    let notesY = totalsY + 20;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(navy);
    for (const note of data.extraNotes) {
      if (!note.trim()) continue;
      doc.text(`\u2022 ${note}`, margin, notesY, { maxWidth: pageWidth - margin * 2 });
      notesY += 16;
    }
    totalsY = notesY - 4;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(navy);
  const footerText = data.footerNote ?? businessConfig.defaultFooterNote;
  doc.text(footerText, margin, totalsY + 26, { maxWidth: pageWidth - margin * 2 });

  return doc;
}

export function generatePackingSlipPdf(data: PackingSlipPdfData): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const navy = businessConfig.colors.text;
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;

  let y = drawBusinessHeader(doc, "PACKING SLIP", data.logoDataUrl);

  if (data.invoiceNumber) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text(`Ref: Invoice ${data.invoiceNumber}`, margin, y - 10);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(navy);
  doc.text("SHIP TO:-", margin, y);
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

  doc.setFont("helvetica", "bold");
  doc.text(`Ship Date: ${toDDMMYYYY(data.shipDate)}`, margin, y);
  y += 24;

  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);

  autoTable(doc, {
    startY: y + 1,
    margin: { left: margin, right: margin },
    head: [["PRODUCT", "DESCRIPTION", "QTY"]],
    body: data.lineItems.map((item) => [item.description, item.activity, String(item.quantity)]),
    styles: { fontSize: 11, textColor: navy },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: navy,
      fontStyle: "bold",
      fontSize: 11,
    },
    theme: "plain",
  });

  return doc;
}