import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams.get("search");

  const customers = await prisma.customer.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        }
      : undefined,
    include: { province: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(customers);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const customer = await prisma.customer.create({
    data: {
      name: body.name,
      phone: body.phone ?? null,
      email: body.email ?? null,
      street: body.street ?? null,
      poBox: body.poBox ?? null,
      city: body.city ?? null,
      postalCode: body.postalCode ?? null,
      provinceId: body.provinceId ?? null,
    },
    include: { province: true },
  });

  return NextResponse.json(customer, { status: 201 });
}
