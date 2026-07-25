/*
  Warnings:

  - You are about to drop the column `poBox` on the `Customer` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Customer" DROP COLUMN "poBox";

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "poNumber" TEXT;
