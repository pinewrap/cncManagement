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
    currentQuantity: currentQuantity(stockTransactions, {
      packageSize: product.packageSize,
      unitsPerBox: product.unitsPerBox,
      boxesPerSkid: product.boxesPerSkid,
    }),
  }));

  return NextResponse.json(withQuantity);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const product = await prisma.product.create({
    data: {
      sku: body.sku ?? null,
      name: body.name,
      variant: body.variant ?? null,
      description: body.description ?? null,
      packageType: body.packageType ?? null,
      packageSize: body.packageSize ?? null,
      unit: body.unit,
      unitsPerBox: body.unitsPerBox ?? null,
      boxesPerSkid: body.boxesPerSkid ?? null,
      reorderLevel: body.reorderLevel ?? null,
      // defaultPrice is intentionally not set here — price is decided per
      // invoice, never at the product/catalog level.
    },
  });

  return NextResponse.json(product, { status: 201 });
}
