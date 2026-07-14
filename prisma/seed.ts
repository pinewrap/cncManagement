import { PrismaClient } from "@prisma/client";
import { products } from "./products-seed-data";

const prisma = new PrismaClient();

// Rates current as of 2026. If a province changes its rate, update it here
// and re-run: npx prisma db seed
const provinces = [
  { province: "AB", taxType: "GST only", gstHstRate: 0.05, pstQstRate: 0 },
  { province: "BC", taxType: "GST + PST", gstHstRate: 0.05, pstQstRate: 0.07 },
  { province: "MB", taxType: "GST + PST", gstHstRate: 0.05, pstQstRate: 0.07 },
  { province: "NB", taxType: "HST", gstHstRate: 0.15, pstQstRate: 0 },
  { province: "NL", taxType: "HST", gstHstRate: 0.15, pstQstRate: 0 },
  { province: "NS", taxType: "HST", gstHstRate: 0.14, pstQstRate: 0 },
  { province: "NT", taxType: "GST only", gstHstRate: 0.05, pstQstRate: 0 },
  { province: "NU", taxType: "GST only", gstHstRate: 0.05, pstQstRate: 0 },
  { province: "ON", taxType: "HST", gstHstRate: 0.13, pstQstRate: 0 },
  { province: "PE", taxType: "HST", gstHstRate: 0.15, pstQstRate: 0 },
  { province: "QC", taxType: "GST + QST", gstHstRate: 0.05, pstQstRate: 0.09975 },
  { province: "SK", taxType: "GST + PST", gstHstRate: 0.05, pstQstRate: 0.06 },
  { province: "YT", taxType: "GST only", gstHstRate: 0.05, pstQstRate: 0 },
];

async function main() {
  for (const p of provinces) {
    await prisma.provinceTaxRate.upsert({
      where: { province: p.province },
      update: p,
      create: p,
    });
  }
  console.log(`Seeded ${provinces.length} provinces.`);

  for (const p of products) {
    await prisma.product.upsert({
      where: { sku: p.sku },
      update: p,
      create: p,
    });
  }
  console.log(`Seeded ${products.length} products.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
