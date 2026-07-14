import { Decimal } from "@prisma/client/runtime/library";

type StockTxn = {
  txnType: "STOCK_IN" | "STOCK_OUT" | "ADJUSTMENT" | "SALE";
  entryUnit: "BASE_UNIT" | "PURCHASE_UNIT";
  entryQuantity: number;
};

/** Current stock, in base units, from a product's full transaction history. */
export function currentQuantity(
  transactions: StockTxn[],
  unitsPerPurchaseUnit: number
): number {
  return transactions.reduce((total, txn) => {
    const baseQty =
      txn.entryUnit === "PURCHASE_UNIT"
        ? txn.entryQuantity * unitsPerPurchaseUnit
        : txn.entryQuantity;
    const sign = txn.txnType === "STOCK_OUT" || txn.txnType === "SALE" ? -1 : 1;
    return total + sign * baseQty;
  }, 0);
}

type LineItem = { unitPrice: Decimal | number; quantity: number };

export function lineTotal(item: LineItem): number {
  return Number(item.unitPrice) * item.quantity;
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
  return String(lastInvoiceNumber + 1);
}
