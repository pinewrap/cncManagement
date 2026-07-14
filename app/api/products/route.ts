import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentQuantity } from "@/lib/calculations";

export async function GET() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: { stockTransactions: true },
    orderBy: { name: "asc" },
  });

  const withQuantity = products.map(({ stockTransactions, ...product }) => ({
    ...product,
    currentQuantity: currentQuantity(stockTransactions, product.unitsPerPurchaseUnit),
  }));

  return NextResponse.json(withQuantity);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const product = await prisma.product.create({
    data: {
      sku: body.sku ?? null,
      name: body.name,
      description: body.description ?? null,
      defaultActivity: body.defaultActivity ?? null,
      defaultPrice: body.defaultPrice,
      baseUnit: body.baseUnit,
      purchaseUnit: body.purchaseUnit ?? null,
      unitsPerPurchaseUnit: body.unitsPerPurchaseUnit ?? 1,
      reorderLevel: body.reorderLevel ?? null,
    },
  });

  return NextResponse.json(product, { status: 201 });
}
