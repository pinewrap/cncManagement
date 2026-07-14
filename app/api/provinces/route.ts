import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const provinces = await prisma.provinceTaxRate.findMany({
    orderBy: { province: "asc" },
  });
  return NextResponse.json(provinces);
}
