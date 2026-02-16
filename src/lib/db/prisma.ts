import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { createRlsExtension } from '@/lib/db/prisma-rls-extension';

// PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Prisma adapter for PostgreSQL (required in Prisma 7)
const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient>;
};

function createPrismaClient() {
  const client = new PrismaClient({ adapter });
  // Apply RLS extension for automatic tenant isolation
  return client.$extends(createRlsExtension());
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
