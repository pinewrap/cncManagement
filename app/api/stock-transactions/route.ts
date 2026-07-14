import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const productId = req.nextUrl.searchParams.get("productId");

  const transactions = await prisma.stockTransaction.findMany({
    where: productId ? { productId } : undefined,
    include: { product: true },
    orderBy: { txnDate: "desc" },
  });

  return NextResponse.json(transactions);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  // entryQuantity is always positive; sign + packaging-tier conversion is
  // applied at read-time in lib/calculations.ts, not stored here — same
  // principle as the rest of the schema: store raw facts, compute derived
  // values on read.
  const txn = await prisma.stockTransaction.create({
    data: {
      productId: body.productId,
      txnDate: body.txnDate ? new Date(body.txnDate) : new Date(),
      txnType: body.txnType, // "STOCK_IN" | "STOCK_OUT" | "ADJUSTMENT" | "SALE"
      entryUnit: body.entryUnit ?? "BASE_UNIT", // "BASE_UNIT" | "PACKAGE" | "BOX" | "SKID"
      entryQuantity: body.entryQuantity,
      reference: body.reference ?? null,
      notes: body.notes ?? null,
    },
    include: { product: true },
  });

  return NextResponse.json(txn, { status: 201 });
}
