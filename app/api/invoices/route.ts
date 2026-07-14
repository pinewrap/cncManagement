import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { invoiceTotals, nextInvoiceNumber, taxLabel } from "@/lib/calculations";

export async function GET() {
  const invoices = await prisma.invoice.findMany({
    include: {
      customer: { include: { province: true } },
      lineItems: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const withTotals = invoices.map((invoice) => {
    const rates = invoice.customer.province;
    const totals = invoiceTotals(
      invoice.lineItems,
      rates?.gstHstRate ?? 0,
      rates?.pstQstRate ?? 0,
      invoice.otherChargesAmount
    );
    return {
      ...invoice,
      ...totals,
      taxLabel: rates ? taxLabel(rates.taxType) : null,
    };
  });

  return NextResponse.json(withTotals);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  // Expected body: { customerId, dueDate?, otherChargesLabel?, otherChargesAmount?,
  //   footerNote?, lineItems: [{ productId?, activity, description, unitPrice, quantity }] }

  const invoice = await prisma.$transaction(async (tx) => {
    // Numbering: continues from the highest existing numeric invoice number.
    // If none exist yet, starts at 1 — update the seed once you've decided
    // where CNC's real sequence should pick up (see open question from earlier).
    const last = await tx.invoice.findFirst({
      orderBy: { createdAt: "desc" },
      select: { invoiceNumber: true },
    });
    const lastNumber = last ? parseInt(last.invoiceNumber, 10) || 0 : 0;

    const created = await tx.invoice.create({
      data: {
        invoiceNumber: nextInvoiceNumber(lastNumber),
        customerId: body.customerId,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        otherChargesLabel: body.otherChargesLabel ?? null,
        otherChargesAmount: body.otherChargesAmount ?? 0,
        footerNote: body.footerNote ?? null,
        lineItems: {
          create: body.lineItems.map((item: any) => ({
            productId: item.productId ?? null,
            activity: item.activity,
            description: item.description,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
          })),
        },
      },
      include: { lineItems: true, customer: { include: { province: true } } },
    });

    // Auto-deduct stock — same logic as the AppSheet action: one SALE
    // transaction per line item that references a real product.
    for (const item of created.lineItems) {
      if (!item.productId) continue;
      await tx.stockTransaction.create({
        data: {
          productId: item.productId,
          txnType: "SALE",
          entryUnit: "BASE_UNIT", // invoice quantities are always in base units
          entryQuantity: item.quantity,
          reference: created.invoiceNumber,
        },
      });
    }

    return created;
  });

  const rates = invoice.customer.province;
  const totals = invoiceTotals(
    invoice.lineItems,
    rates?.gstHstRate ?? 0,
    rates?.pstQstRate ?? 0,
    invoice.otherChargesAmount
  );

  return NextResponse.json(
    { ...invoice, ...totals, taxLabel: rates ? taxLabel(rates.taxType) : null },
    { status: 201 }
  );
}
