import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { invoiceTotals, taxLabel } from "@/lib/calculations";
import { PaymentStatus } from "@prisma/client";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      customer: { include: { province: true } },
      lineItems: { include: { product: true } },
    },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const rates = invoice.customer.province;
  const totals = invoiceTotals(
    invoice.lineItems,
    rates?.gstHstRate ?? 0,
    rates?.pstQstRate ?? 0,
    invoice.otherChargesAmount
  );

  return NextResponse.json({
    ...invoice,
    ...totals,
    taxLabel: rates ? taxLabel(rates.taxType) : null,
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
 
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }
 
  await prisma.$transaction([
    // Reverse the stock deducted when this invoice was created — otherwise
    // deleting an invoice leaves stock permanently short for a sale that no
    // longer exists.
    prisma.stockTransaction.deleteMany({
      where: { txnType: "SALE", reference: invoice.invoiceNumber },
    }),
    // Line items cascade-delete automatically via the schema (onDelete:
    // Cascade), so this alone is enough to clean up everything.
    prisma.invoice.delete({ where: { id } }),
  ]);
 
  return NextResponse.json({ deleted: true });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { paymentStatus } = await req.json() as { paymentStatus: PaymentStatus };
  const updated = await prisma.invoice.update({
    where: { id },
    data: { paymentStatus },
    select: { id: true, paymentStatus: true },
  });
  return NextResponse.json(updated);
}
