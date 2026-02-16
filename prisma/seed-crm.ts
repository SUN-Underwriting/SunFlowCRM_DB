import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting CRM seed...');

  // 1. Create or get test tenant
  console.log('📦 Creating test tenant...');
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
  console.log(`✅ Tenant created: ${tenant.name}`);

  // 2. Create or get test user
  console.log('👤 Creating test user...');
  const user = await prisma.user.upsert({
    where: {
      user_email_tenant_unique: {
        email: 'admin@test-company.com',
        tenantId: tenant.id
      }
    },
    update: {},
    create: {
      email: 'admin@test-company.com',
      firstName: 'Admin',
      lastName: 'User',
      tenantId: tenant.id,
      supertokensUserId: 'test-user-' + Date.now(),
      role: 'ADMIN'
    }
  });
  console.log(`✅ User created: ${user.email}`);

  // 3. Create pipelines
  console.log('🔄 Creating pipelines...');
  const salesPipeline = await prisma.pipeline.upsert({
    where: {
      tenantId_name: {
        tenantId: tenant.id,
        name: 'Sales Pipeline'
      }
    },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Sales Pipeline',
      isDefault: true,
      sortOrder: 1
    }
  });
  console.log(`✅ Sales Pipeline created`);

  // 4. Create stages for Sales Pipeline
  console.log('📊 Creating stages...');
  const stages = [
    { name: 'Lead', probability: 10, sortOrder: 1 },
    { name: 'Qualified', probability: 25, sortOrder: 2 },
    { name: 'Proposal', probability: 50, sortOrder: 3 },
    { name: 'Negotiation', probability: 75, sortOrder: 4 },
    { name: 'Closed Won', probability: 100, sortOrder: 5 },
    { name: 'Closed Lost', probability: 0, sortOrder: 6 }
  ];

  for (const stageData of stages) {
    await prisma.stage.upsert({
      where: {
        tenantId_pipelineId_name: {
          tenantId: tenant.id,
          pipelineId: salesPipeline.id,
          name: stageData.name
        }
      },
      update: {},
      create: {
        tenantId: tenant.id,
        pipelineId: salesPipeline.id,
        ...stageData
      }
    });
  }
  console.log(`✅ ${stages.length} stages created`);

  // 5. Create organizations
  console.log('🏢 Creating organizations...');
  const organizations = [
    {
      name: 'Acme Corporation',
      industry: 'TECHNOLOGY',
      size: '201-500',
      website: 'https://acme.com',
      phone: '+1 (555) 123-4567',
      address: '123 Tech Street, San Francisco, CA 94105'
    },
    {
      name: 'Global Industries',
      industry: 'MANUFACTURING',
      size: '1000+',
      website: 'https://globalind.com',
      phone: '+1 (555) 987-6543',
      address: '456 Industrial Ave, Detroit, MI 48201'
    },
    {
      name: 'StartupXYZ',
      industry: 'TECHNOLOGY',
      size: '11-50',
      website: 'https://startupxyz.io',
      phone: '+1 (555) 456-7890',
      address: '789 Innovation Blvd, Austin, TX 78701'
    }
  ];

  const createdOrgs = [];
  for (const orgData of organizations) {
    const org = await prisma.organization.create({
      data: {
        tenantId: tenant.id,
        ...orgData,
        customData: {}
      }
    });
    createdOrgs.push(org);
  }
  console.log(`✅ ${createdOrgs.length} organizations created`);

  // 6. Create persons
  console.log('👥 Creating persons...');
  const persons = [
    {
      firstName: 'John',
      lastName: 'Smith',
      email: 'john.smith@acme.com',
      phone: '+1 (555) 111-2222',
      jobTitle: 'CEO',
      orgId: createdOrgs[0].id
    },
    {
      firstName: 'Sarah',
      lastName: 'Johnson',
      email: 'sarah.j@acme.com',
      phone: '+1 (555) 111-3333',
      jobTitle: 'CTO',
      orgId: createdOrgs[0].id
    },
    {
      firstName: 'Michael',
      lastName: 'Brown',
      email: 'mbrown@globalind.com',
      phone: '+1 (555) 222-4444',
      jobTitle: 'VP of Sales',
      orgId: createdOrgs[1].id
    },
    {
      firstName: 'Emily',
      lastName: 'Davis',
      email: 'emily@startupxyz.io',
      phone: '+1 (555) 333-5555',
      jobTitle: 'Founder',
      orgId: createdOrgs[2].id
    }
  ];

  const createdPersons = [];
  for (const personData of persons) {
    const person = await prisma.person.create({
      data: {
        tenantId: tenant.id,
        ...personData,
        customData: {}
      }
    });
    createdPersons.push(person);
  }
  console.log(`✅ ${createdPersons.length} persons created`);

  // 7. Create leads
  console.log('🎯 Creating leads...');
  const leads = [
    {
      title: 'Enterprise Software Deal',
      source: 'WEBSITE',
      status: 'NEW',
      personId: createdPersons[0].id,
      orgId: createdOrgs[0].id
    },
    {
      title: 'Manufacturing Automation',
      source: 'REFERRAL',
      status: 'IN_PROGRESS',
      personId: createdPersons[2].id,
      orgId: createdOrgs[1].id
    },
    {
      title: 'Startup Partnership',
      source: 'COLD_CALL',
      status: 'NEW',
      personId: createdPersons[3].id,
      orgId: createdOrgs[2].id
    },
    {
      title: 'Cloud Migration Project',
      source: 'SOCIAL_MEDIA',
      status: 'IN_PROGRESS',
      personId: createdPersons[1].id,
      orgId: createdOrgs[0].id
    }
  ];

  for (const leadData of leads) {
    await prisma.lead.create({
      data: {
        tenantId: tenant.id,
        ownerId: user.id,
        ...leadData
      }
    });
  }
  console.log(`✅ ${leads.length} leads created`);

  // 8. Create deals
  console.log('💰 Creating deals...');
  const allStages = await prisma.stage.findMany({
    where: { pipelineId: salesPipeline.id },
    orderBy: { sortOrder: 'asc' }
  });

  const deals = [
    {
      title: 'Acme Corp - Annual License',
      value: 50000,
      currency: 'USD',
      stageId: allStages[1].id, // Qualified
      personId: createdPersons[0].id,
      orgId: createdOrgs[0].id,
      expectedCloseDate: new Date('2026-03-15')
    },
    {
      title: 'Global Industries - Consulting',
      value: 125000,
      currency: 'USD',
      stageId: allStages[2].id, // Proposal
      personId: createdPersons[2].id,
      orgId: createdOrgs[1].id,
      expectedCloseDate: new Date('2026-04-01')
    },
    {
      title: 'StartupXYZ - Platform Integration',
      value: 25000,
      currency: 'USD',
      stageId: allStages[0].id, // Lead
      personId: createdPersons[3].id,
      orgId: createdOrgs[2].id,
      expectedCloseDate: new Date('2026-05-10')
    },
    {
      title: 'Acme Corp - Cloud Services',
      value: 75000,
      currency: 'USD',
      stageId: allStages[3].id, // Negotiation
      personId: createdPersons[1].id,
      orgId: createdOrgs[0].id,
      expectedCloseDate: new Date('2026-02-28')
    },
    {
      title: 'Global Industries - Training Program',
      value: 35000,
      currency: 'USD',
      stageId: allStages[1].id, // Qualified
      personId: createdPersons[2].id,
      orgId: createdOrgs[1].id,
      expectedCloseDate: new Date('2026-03-20')
    }
  ];

  for (const dealData of deals) {
    await prisma.deal.create({
      data: {
        tenantId: tenant.id,
        pipelineId: salesPipeline.id,
        ownerId: user.id,
        status: 'OPEN',
        ...dealData,
        customData: {}
      }
    });
  }
  console.log(`✅ ${deals.length} deals created`);

  // 9. Create activities
  console.log('📅 Creating activities...');
  const activities = [
    {
      type: 'CALL',
      subject: 'Follow-up call with John',
      dueAt: new Date('2026-02-14T10:00:00'),
      done: false,
      personId: createdPersons[0].id,
      orgId: createdOrgs[0].id,
      note: 'Discuss contract terms'
    },
    {
      type: 'MEETING',
      subject: 'Demo presentation',
      dueAt: new Date('2026-02-15T14:00:00'),
      done: false,
      personId: createdPersons[2].id,
      orgId: createdOrgs[1].id,
      note: 'Product demo for decision makers'
    },
    {
      type: 'EMAIL',
      subject: 'Send proposal',
      dueAt: new Date('2026-02-13T16:00:00'),
      done: true,
      completedAt: new Date('2026-02-13T15:30:00'),
      personId: createdPersons[3].id,
      orgId: createdOrgs[2].id,
      note: 'Sent pricing proposal'
    }
  ];

  for (const activityData of activities) {
    await prisma.activity.create({
      data: {
        tenantId: tenant.id,
        ownerId: user.id,
        ...activityData
      }
    });
  }
  console.log(`✅ ${activities.length} activities created`);

  console.log('\n🎉 CRM seed completed successfully!');
  console.log('\n📊 Summary:');
  console.log(`   - Tenant: ${tenant.name}`);
  console.log(`   - User: ${user.email}`);
  console.log(`   - Pipelines: 1`);
  console.log(`   - Stages: ${allStages.length}`);
  console.log(`   - Organizations: ${createdOrgs.length}`);
  console.log(`   - Persons: ${createdPersons.length}`);
  console.log(`   - Leads: ${leads.length}`);
  console.log(`   - Deals: ${deals.length}`);
  console.log(`   - Activities: ${activities.length}`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
