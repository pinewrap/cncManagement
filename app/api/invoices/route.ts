import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { invoiceTotals, nextInvoiceNumber, extractInvoiceNumber, taxLabel } from "@/lib/calculations";

export async function GET(req: NextRequest) {
  const customerId = req.nextUrl.searchParams.get("customerId");
  const countOnly = req.nextUrl.searchParams.get("count") === "true";

  if (countOnly) {
    const count = await prisma.invoice.count();
    return NextResponse.json({ count });
  }

  const invoices = await prisma.invoice.findMany({
    where: customerId ? { customerId } : undefined,
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

  const invoice = await prisma.$transaction(async (tx) => {
    const allInvoices = await tx.invoice.findMany({ select: { invoiceNumber: true } });
    const lastNumber = allInvoices.reduce(
      (max, inv) => Math.max(max, extractInvoiceNumber(inv.invoiceNumber)),
      0
    );

    const created = await tx.invoice.create({
      data: {
        invoiceNumber: body.invoiceNumber?.trim() || nextInvoiceNumber(lastNumber),
        customerId: body.customerId,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        otherChargesLabel: body.otherChargesLabel ?? null,
        otherChargesAmount: body.otherChargesAmount ?? 0,
        footerNote: body.footerNote ?? null,
        extraNotes: body.extraNotes?.length ? body.extraNotes.join("\n") : null,
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

    for (const item of created.lineItems) {
      if (!item.productId) continue;
      await tx.stockTransaction.create({
        data: {
          productId: item.productId,
          txnType: "SALE",
          entryUnit: "PACKAGE",
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
