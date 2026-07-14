import { PrismaClient } from "@prisma/client";

// Cached on `globalThis` so warm serverless invocations (Vercel) reuse the
// same client/connection instead of opening a new one per request, which
// would otherwise exhaust Postgres's connection limit under concurrent load.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();
globalForPrisma.prisma = prisma;
