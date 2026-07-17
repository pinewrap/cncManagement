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
