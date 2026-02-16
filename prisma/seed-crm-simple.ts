import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting CRM seed...');

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'test-company' },
    update: {},
    create: {
      name: 'Test Company',
      slug: 'test-company',
      plan: 'PROFESSIONAL',
      status: 'ACTIVE'
    }
  });
  console.log(`✅ Tenant: ${tenant.name}`);

  const user = await prisma.user.upsert({
    where: {
      user_email_tenant_unique: { email: 'admin@test.com', tenantId: tenant.id }
    },
    update: {},
    create: {
      email: 'admin@test.com',
      firstName: 'Admin',
      lastName: 'User',
      tenantId: tenant.id,
      supertokensUserId: 'test-' + Date.now(),
      role: 'ADMIN'
    }
  });
  console.log(`✅ User: ${user.email}`);

  const pipeline = await prisma.pipeline.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Sales' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Sales',
      isDefault: true,
      sortOrder: 1
    }
  });
  console.log(`✅ Pipeline: ${pipeline.name}`);

  const stages = [
    'Lead',
    'Qualified',
    'Proposal',
    'Negotiation',
    'Won',
    'Lost'
  ];
  for (let i = 0; i < stages.length; i++) {
    await prisma.stage.upsert({
      where: {
        tenantId_pipelineId_name: {
          tenantId: tenant.id,
          pipelineId: pipeline.id,
          name: stages[i]
        }
      },
      update: {},
      create: {
        tenantId: tenant.id,
        pipelineId: pipeline.id,
        name: stages[i],
        probability: i === 4 ? 100 : i === 5 ? 0 : (i + 1) * 20,
        sortOrder: i + 1
      }
    });
  }
  console.log(`✅ ${stages.length} stages created`);

  console.log('\n🎉 Basic seed completed!');
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
