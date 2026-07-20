import { Decimal } from "@prisma/client/runtime/library";

type StockTxn = {
  txnType: "STOCK_IN" | "STOCK_OUT" | "ADJUSTMENT" | "SALE";
  entryUnit: "BASE_UNIT" | "PACKAGE" | "BOX" | "SKID";
  entryQuantity: Decimal | number;
};

type PackagingFactors = {
  packageSize: Decimal | number | null;
  unitsPerBox: number | null;
  boxesPerSkid: number | null;
};

/**
 * How many base units (KG/L) one unit of the given entry tier represents.
 * PACKAGE = packageSize. BOX = packageSize * unitsPerBox.
 * SKID = packageSize * unitsPerBox * boxesPerSkid.
 * Falls back to 1 for any missing factor rather than throwing — a product
 * without box/skid tiers simply can't be entered at that level in the UI.
 */
export function conversionFactor(entryUnit: StockTxn["entryUnit"], factors: PackagingFactors): number {
  const packageSize = Number(factors.packageSize ?? 1);
  const unitsPerBox = factors.unitsPerBox ?? 1;
  const boxesPerSkid = factors.boxesPerSkid ?? 1;

  switch (entryUnit) {
    case "BASE_UNIT":
      return 1;
    case "PACKAGE":
      return packageSize;
    case "BOX":
      return packageSize * unitsPerBox;
    case "SKID":
      return packageSize * unitsPerBox * boxesPerSkid;
  }
}

/** Current stock, in base units (KG/L), from a product's full transaction history. */
export function currentQuantity(transactions: StockTxn[], factors: PackagingFactors): number {
  return transactions.reduce((total, txn) => {
    const baseQty = Number(txn.entryQuantity) * conversionFactor(txn.entryUnit, factors);
    const sign = txn.txnType === "STOCK_OUT" || txn.txnType === "SALE" ? -1 : 1;
    return total + sign * baseQty;
  }, 0);
}

type ProductForGrouping = {
  id: string;
  name: string;
  variant?: string | null;
  packageType?: string | null;
  packageSize?: Decimal | number | string | null;
  unit: string;
};

export type ProductLine = {
  key: string;
  label: string;
  products: ProductForGrouping[];
};

/** Groups individual SKUs (Product rows) into the product lines a non-technical user picks from first. */
export function groupProductLines(products: ProductForGrouping[]): ProductLine[] {
  const map = new Map<string, ProductLine>();
  for (const p of products) {
    const key = `${p.name}__${p.variant ?? ""}`;
    const label = [p.name, p.variant].filter(Boolean).join(" ");
    if (!map.has(key)) map.set(key, { key, label, products: [] });
    map.get(key)!.products.push(p);
  }
  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
}

/** e.g. "Drum - 181.4kg" — the second dropdown, scoped to whichever product line was picked. */
export function packageLabel(p: { packageType?: string | null; packageSize?: Decimal | number | string | null; unit: string }): string {
  if (!p.packageType) return p.unit;
  const size = p.packageSize != null ? `${Number(p.packageSize)}${p.unit}` : p.unit;
  return `${p.packageType} - ${size}`;
}

type ProductForDisplay = {
  name: string;
  variant?: string | null;
  packageType?: string | null;
  packageSize?: Decimal | number | string | null;
  unit: string;
  description?: string | null;
};

/** e.g. "Drum (181.4KG)" — matches the Activity column on CNC's real invoices. */
export function deriveActivity(product: ProductForDisplay): string {
  if (!product.packageType) return "";
  const size = product.packageSize != null ? `${Number(product.packageSize)}${product.unit}` : product.unit;
  return `${product.packageType} (${size})`;
}

/** e.g. "Hector Grease 4" — falls back to name+variant unless the product has an explicit override. */
export function deriveDescription(product: ProductForDisplay): string {
  if (product.description) return product.description;
  return [product.name, product.variant].filter(Boolean).join(" ");
}

type LineItem = { unitPrice: Decimal | number; quantity: Decimal | number };

export function lineTotal(item: LineItem): number {
  return Number(item.unitPrice) * Number(item.quantity);
}

export function subtotal(lineItems: LineItem[]): number {
  return lineItems.reduce((sum, item) => sum + lineTotal(item), 0);
}

export function invoiceTotals(
  lineItems: LineItem[],
  gstHstRate: Decimal | number,
  pstQstRate: Decimal | number,
  otherChargesAmount: Decimal | number = 0
) {
  const sub = subtotal(lineItems);
  const taxBase = sub + Number(otherChargesAmount);
  const gstHstAmount = taxBase * Number(gstHstRate);
  const pstQstAmount = taxBase * Number(pstQstRate);
  return {
    subtotal: sub,
    otherChargesAmount: Number(otherChargesAmount),
    gstHstAmount,
    pstQstAmount,
    total: taxBase + gstHstAmount + pstQstAmount,
  };
}

/** The short label CNC's invoices show in the Tax column per line, e.g. "GST" or "HST". */
export function taxLabel(taxType: string): string {
  if (taxType === "HST") return "HST";
  if (taxType === "GST + QST") return "GST/QST";
  if (taxType === "GST + PST") return "GST/PST";
  return "GST";
}

/**
 * Plain sequential invoice number, matching CNC's existing format (e.g. "3016",
 * not "INV-2026-3016"). Pass in the highest existing number so it continues
 * the client's real sequence instead of restarting at 1.
 */
export function nextInvoiceNumber(lastInvoiceNumber: number): string {
  return `CNC-INV ${lastInvoiceNumber + 1}`;
}
 
/** Pulls the trailing number out of any invoice number format — handles old
 * plain-number invoices ("3016"), the new "CNC-INV 3017" format, and any
 * manually-typed custom number, as long as it ends in digits. */
export function extractInvoiceNumber(invoiceNumber: string): number {
  const match = invoiceNumber.match(/(\d+)\s*$/);
  return match ? parseInt(match[1], 10) : 0;
}
