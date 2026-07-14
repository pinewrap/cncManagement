import { PrismaClient } from "@prisma/client";

// Prevents exhausting the DB connection pool from hot-reloading in dev
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
