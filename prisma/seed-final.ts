import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting CRM seed...');

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo-company' },
    update: {},
    create: {
      name: 'Demo Company',
      slug: 'demo-company',
      plan: 'PROFESSIONAL',
      status: 'ACTIVE'
    }
  });
  console.log(`✅ Tenant: ${tenant.name}`);

  const user = await prisma.user.create({
    data: {
      email: 'demo@example.com',
      firstName: 'Demo',
      lastName: 'User',
      tenantId: tenant.id,
      supertokensUserId: 'demo-user-' + Date.now(),
      role: 'ADMIN'
    }
  });
  console.log(`✅ User: ${user.email}`);

  const pipeline = await prisma.pipeline.create({
    data: {
      tenantId: tenant.id,
      name: 'Sales Pipeline',
      isDefault: true,
      sortOrder: 1
    }
  });
  console.log(`✅ Pipeline: ${pipeline.name}`);

  const stageData = [
    { name: 'Lead', probability: 10 },
    { name: 'Qualified', probability: 25 },
    { name: 'Proposal', probability: 50 },
    { name: 'Negotiation', probability: 75 },
    { name: 'Won', probability: 100 },
    { name: 'Lost', probability: 0 }
  ];

  for (let i = 0; i < stageData.length; i++) {
    await prisma.stage.create({
      data: {
        tenantId: tenant.id,
        pipelineId: pipeline.id,
        name: stageData[i].name,
        probability: stageData[i].probability,
        sortOrder: i + 1
      }
    });
  }
  console.log(`✅ ${stageData.length} stages created`);

  const org = await prisma.organization.create({
    data: {
      tenantId: tenant.id,
      name: 'Acme Corporation',
      industry: 'TECHNOLOGY',
      size: '51-200',
      website: 'https://acme.com',
      customData: {}
    }
  });
  console.log(`✅ Organization: ${org.name}`);

  const person = await prisma.person.create({
    data: {
      tenantId: tenant.id,
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@acme.com',
      phone: '+1 (555) 123-4567',
      jobTitle: 'CEO',
      orgId: org.id,
      customData: {}
    }
  });
  console.log(`✅ Person: ${person.firstName} ${person.lastName}`);

  const lead = await prisma.lead.create({
    data: {
      tenantId: tenant.id,
      ownerId: user.id,
      title: 'Enterprise Software Deal',
      source: 'WEBSITE',
      status: 'OPEN',
      personId: person.id,
      orgId: org.id
    }
  });
  console.log(`✅ Lead: ${lead.title}`);

  const stages = await prisma.stage.findMany({
    where: { pipelineId: pipeline.id },
    orderBy: { sortOrder: 'asc' }
  });

  const deal = await prisma.deal.create({
    data: {
      tenantId: tenant.id,
      pipelineId: pipeline.id,
      stageId: stages[1].id,
      ownerId: user.id,
      personId: person.id,
      orgId: org.id,
      title: 'Acme Corp - Annual License',
      value: 50000,
      currency: 'USD',
      status: 'OPEN',
      expectedCloseDate: new Date('2026-03-15'),
      customData: {}
    }
  });
  console.log(`✅ Deal: ${deal.title} - $${deal.value}`);

  console.log('\n🎉 CRM seed completed successfully!');
  console.log(`\n📊 Summary:`);
  console.log(`   - Tenant: ${tenant.name}`);
  console.log(`   - User: ${user.email}`);
  console.log(`   - Pipeline: ${pipeline.name}`);
  console.log(`   - Stages: ${stages.length}`);
  console.log(`   - Organization: ${org.name}`);
  console.log(`   - Person: ${person.firstName} ${person.lastName}`);
  console.log(`   - Lead: ${lead.title}`);
  console.log(`   - Deal: ${deal.title}`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
