/*
  Warnings:

  - You are about to drop the column `extraNotes` on the `Invoice` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "StockTransaction" DROP CONSTRAINT "StockTransaction_productId_fkey";

-- AlterTable
ALTER TABLE "Invoice" DROP COLUMN "extraNotes";

-- AddForeignKey
ALTER TABLE "StockTransaction" ADD CONSTRAINT "StockTransaction_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
