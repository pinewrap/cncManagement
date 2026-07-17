import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentQuantity } from "@/lib/calculations";

export async function GET() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: { stockTransactions: true },
    orderBy: [{ name: "asc" }, { variant: "asc" }],
  });

  const levels = products.map((p) => {
    const baseUnits = currentQuantity(p.stockTransactions, {
      packageSize: p.packageSize,
      unitsPerBox: p.unitsPerBox,
      boxesPerSkid: p.boxesPerSkid,
    });
    const packageSize = Number(p.packageSize ?? 1);
    const wholePackages = packageSize > 0 ? Math.floor(baseUnits / packageSize) : 0;
    const remainderBaseUnits = packageSize > 0 ? baseUnits - wholePackages * packageSize : baseUnits;

    return {
      id: p.id,
      name: p.name,
      variant: p.variant,
      packageType: p.packageType,
      packageSize: p.packageSize ? Number(p.packageSize) : null,
      unit: p.unit,
      unitsPerBox: p.unitsPerBox,
      baseUnits: Math.round(baseUnits * 1000) / 1000,
      wholePackages,
      remainderBaseUnits: Math.round(remainderBaseUnits * 1000) / 1000,
    };
  });

  return NextResponse.json(levels);
}
