import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { invoiceTotals, taxLabel } from "@/lib/calculations";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const months = parseInt(req.nextUrl.searchParams.get("months") ?? "3", 10);
  const since = new Date();
  since.setMonth(since.getMonth() - months);

  const invoices = await prisma.invoice.findMany({
    where: { customerId: id, invoiceDate: { gte: since } },
    include: {
      customer: { include: { province: true } },
      lineItems: { include: { product: true } },
    },
    orderBy: { invoiceDate: "desc" },
  });

  // Per-product aggregation across all invoices in the window
  const productMap = new Map<string, {
    description: string;
    activity: string;
    totalQty: number;
    totalAmount: number;
  }>();

  for (const invoice of invoices) {
    for (const item of invoice.lineItems) {
      const key = item.description;
      const amount = Number(item.unitPrice) * Number(item.quantity);
      if (productMap.has(key)) {
        const entry = productMap.get(key)!;
        entry.totalQty += Number(item.quantity);
        entry.totalAmount += amount;
      } else {
        productMap.set(key, {
          description: item.description,
          activity: item.activity,
          totalQty: Number(item.quantity),
          totalAmount: amount,
        });
      }
    }
  }

  const rates = invoices[0]?.customer.province;
  const allLineItems = invoices.flatMap((inv) => inv.lineItems);
  const totals = invoiceTotals(
    allLineItems,
    rates?.gstHstRate ?? 0,
    rates?.pstQstRate ?? 0,
    invoices.reduce((s, inv) => s + Number(inv.otherChargesAmount), 0)
  );

  return NextResponse.json({
    invoiceCount: invoices.length,
    totalSpend: totals.total,
    subtotal: totals.subtotal,
    products: Array.from(productMap.values()).sort((a, b) => b.totalAmount - a.totalAmount),
    invoices: invoices.map((inv) => {
      const r = inv.customer.province;
      const t = invoiceTotals(inv.lineItems, r?.gstHstRate ?? 0, r?.pstQstRate ?? 0, inv.otherChargesAmount);
      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        paymentStatus: inv.paymentStatus,
        total: t.total,
        taxLabel: r ? taxLabel(r.taxType) : null,
        lineItems: inv.lineItems.map((li) => ({
          activity: li.activity,
          description: li.description,
          quantity: Number(li.quantity),
          unitPrice: Number(li.unitPrice),
          amount: Number(li.unitPrice) * Number(li.quantity),
        })),
      };
    }),
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
 
  const invoiceCount = await prisma.invoice.count({ where: { customerId: id } });
 
  if (invoiceCount > 0) {
    return NextResponse.json(
      { error: "This customer has invoices on file and can't be deleted." },
      { status: 409 }
    );
  }
 
  await prisma.customer.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
