import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Parse DATABASE_URL explicitly
const url = new URL(process.env.DATABASE_URL!);

const pool = new Pool({
  host: url.hostname,
  port: parseInt(url.port),
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1).split('?')[0]
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Testing connection...');
  const count = await prisma.tenant.count();
  console.log(`✅ Connected! Found ${count} tenants`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
