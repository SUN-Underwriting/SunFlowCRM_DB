import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 CRM Seed Start');

  const t = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      name: 'Demo Company',
      slug: 'demo',
      plan: 'PROFESSIONAL',
      status: 'ACTIVE'
    }
  });
  console.log('✅ Tenant:', t.name);

  const u = await prisma.user.create({
    data: {
      email: 'demo@example.com',
      firstName: 'Demo',
      lastName: 'User',
      tenantId: t.id,
      supertokensUserId: 'demo-' + Date.now(),
      role: 'ADMIN'
    }
  });
  console.log('✅ User:', u.email);

  const p = await prisma.pipeline.create({
    data: {
      tenantId: t.id,
      name: 'Sales Pipeline',
      isDefault: true,
      sortOrder: 1
    }
  });
  console.log('✅ Pipeline:', p.name);

  const stageNames = [
    'Lead',
    'Qualified',
    'Proposal',
    'Negotiation',
    'Won',
    'Lost'
  ];
  for (let i = 0; i < stageNames.length; i++) {
    await prisma.stage.create({
      data: {
        tenantId: t.id,
        pipelineId: p.id,
        name: stageNames[i],
        probability: i === 4 ? 100 : i === 5 ? 0 : (i + 1) * 20,
        sortOrder: i + 1
      }
    });
  }
  console.log('✅ Stages:', stageNames.length);

  const org = await prisma.organization.create({
    data: {
      tenantId: t.id,
      name: 'Acme Corp',
      industry: 'TECHNOLOGY',
      size: '51-200',
      customData: {}
    }
  });
  console.log('✅ Org:', org.name);

  const person = await prisma.person.create({
    data: {
      tenantId: t.id,
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@acme.com',
      orgId: org.id,
      customData: {}
    }
  });
  console.log('✅ Person:', person.firstName, person.lastName);

  const lead = await prisma.lead.create({
    data: {
      tenantId: t.id,
      ownerId: u.id,
      title: 'Enterprise Deal',
      source: 'WEBSITE',
      status: 'NEW',
      personId: person.id,
      orgId: org.id
    }
  });
  console.log('✅ Lead:', lead.title);

  const stages = await prisma.stage.findMany({
    where: { pipelineId: p.id },
    orderBy: { sortOrder: 'asc' }
  });

  const deal = await prisma.deal.create({
    data: {
      tenantId: t.id,
      pipelineId: p.id,
      stageId: stages[1].id,
      ownerId: u.id,
      personId: person.id,
      orgId: org.id,
      title: 'Acme - Annual License',
      value: 50000,
      currency: 'USD',
      status: 'OPEN',
      customData: {}
    }
  });
  console.log('✅ Deal:', deal.title);

  console.log('\n🎉 Seed Complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
