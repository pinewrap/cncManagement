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
    prisma.stockTransaction.deleteMany({
      where: { txnType: "SALE", reference: invoice.invoiceNumber },
    }),
    prisma.invoice.delete({ where: { id } }),
  ]);

  return NextResponse.json({ deleted: true });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  // No lineItems in the payload -> this is just the paid/unpaid toggle from
  // the invoices list. Keep that simple and fast, unchanged from before.
  if (body.lineItems === undefined) {
    const updated = await prisma.invoice.update({
      where: { id },
      data: { paymentStatus: body.paymentStatus as PaymentStatus },
      select: { id: true, paymentStatus: true },
    });
    return NextResponse.json(updated);
  }

  // Full edit. Same principle as DELETE: rather than trying to diff old
  // line items against new ones, wipe and recreate both the line items and
  // their associated stock deductions -- guarantees stock always matches
  // whatever the current line items actually are, no matter how they
  // changed (added, removed, quantity edited, whatever).
  const existing = await prisma.invoice.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.stockTransaction.deleteMany({
      where: { txnType: "SALE", reference: existing.invoiceNumber },
    });

    await tx.invoiceLineItem.deleteMany({ where: { invoiceId: id } });

    const invoice = await tx.invoice.update({
      where: { id },
      data: {
        customerId: body.customerId ?? existing.customerId,
        invoiceDate: body.invoiceDate ? new Date(body.invoiceDate) : existing.invoiceDate,
        dueDate: body.dueDate ? new Date(body.dueDate) : existing.dueDate,
        paymentStatus: (body.paymentStatus as PaymentStatus) ?? existing.paymentStatus,
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

    for (const item of invoice.lineItems) {
      if (!item.productId) continue;
      await tx.stockTransaction.create({
        data: {
          productId: item.productId,
          txnType: "SALE",
          entryUnit: "PACKAGE",
          entryQuantity: item.quantity,
          reference: invoice.invoiceNumber,
        },
      });
    }

    return invoice;
  });

  const rates = updated.customer.province;
  const totals = invoiceTotals(
    updated.lineItems,
    rates?.gstHstRate ?? 0,
    rates?.pstQstRate ?? 0,
    updated.otherChargesAmount
  );

  return NextResponse.json({
    ...updated,
    ...totals,
    taxLabel: rates ? taxLabel(rates.taxType) : null,
  });
}
