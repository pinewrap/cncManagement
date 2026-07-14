import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { invoiceTotals, taxLabel } from "@/lib/calculations";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
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
