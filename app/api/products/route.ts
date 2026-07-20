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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
 
  const product = await prisma.product.update({
    where: { id },
    data: {
      name: body.name,
      variant: body.variant ?? null,
    },
  });
 
  return NextResponse.json(product);
}
 
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
 
  // Fresh/unused products delete cleanly. Anything with real history is
  // blocked rather than silently cascading — deleting a product that's on a
  // past invoice or has stock movements would corrupt that record.
  const [stockCount, lineItemCount] = await Promise.all([
    prisma.stockTransaction.count({ where: { productId: id } }),
    prisma.invoiceLineItem.count({ where: { productId: id } }),
  ]);
 
  if (stockCount > 0 || lineItemCount > 0) {
    return NextResponse.json(
      {
        error:
          "This product has stock or invoice history and can't be deleted — rename it instead if it's discontinued.",
      },
      { status: 409 }
    );
  }
 
  await prisma.product.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}