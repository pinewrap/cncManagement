import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

  const [stockCount, lineItemCount] = await Promise.all([
    prisma.stockTransaction.count({ where: { productId: id } }),
    prisma.invoiceLineItem.count({ where: { productId: id } }),
  ]);

//   if (stockCount > 0 || lineItemCount > 0) {
//     return NextResponse.json(
//       {
//         error:
//           "This product has stock or invoice history and can't be deleted — rename it instead if it's discontinued.",
//       },
//       { status: 409 }
//     );
//   }

  await prisma.product.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}