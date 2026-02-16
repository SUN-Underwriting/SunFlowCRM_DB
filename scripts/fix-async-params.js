#!/usr/bin/env node

/**
 * Script to fix Next.js 15 async params in all dynamic API routes
 *
 * Next.js 15 changed params to be async (Promise-based) in dynamic routes.
 * This script updates all route handlers to properly await params.
 */

const fs = require('fs');
const path = require('path');

const routeFiles = [
  'src/app/api/crm/persons/[id]/route.ts',
  'src/app/api/crm/pipelines/[id]/route.ts',
  'src/app/api/crm/pipelines/[id]/stages/route.ts',
  'src/app/api/crm/stages/[id]/route.ts',
  'src/app/api/crm/deals/[id]/route.ts',
  'src/app/api/crm/deals/[id]/move/route.ts',
  'src/app/api/crm/leads/[id]/route.ts',
  'src/app/api/crm/leads/[id]/convert/route.ts',
  'src/app/api/crm/activities/[id]/route.ts',
  'src/app/api/crm/emails/[id]/route.ts',
  'src/app/api/crm/field-definitions/[id]/route.ts'
];

function fixAsyncParams(content) {
  // Pattern 1: Fix function signatures
  content = content.replace(
    /{ params }: { params: { id: string } }/g,
    'context: { params: Promise<{ id: string }> }'
  );

  // Pattern 2: Add await params after service creation
  // Match: const service = new SomeService(...);
  // Followed by: const something = await service.method(params.id);
  // Insert: const { id } = await context.params;

  content = content.replace(
    /(const service = new \w+Service\(user\.tenantId, user\.id\);)\n\s+(const \w+ = await service\.\w+\(params\.id)/g,
    '$1\n    const { id } = await context.params;\n\n    $2'
  );

  // Pattern 3: Add await params before body parsing when params.id is used after
  content = content.replace(
    /(const service = new \w+Service\(user\.tenantId, user\.id\);)\n\s+(const body = await request\.json\(\);[\s\S]*?params\.id)/g,
    (match, p1, p2) => {
      return match.replace(
        p1,
        p1 + '\n    const { id } = await context.params;'
      );
    }
  );

  // Pattern 4: Add await params before direct service calls with params.id
  content = content.replace(
    /(const service = new \w+Service\(user\.tenantId, user\.id\);)\n\s+(const result = await service\.\w+\(params\.id)/g,
    '$1\n    const { id } = await context.params;\n\n    $2'
  );

  // Pattern 5: Replace all remaining params.id with just id
  content = content.replace(/params\.id/g, 'id');

  return content;
}

console.log('Fixing Next.js 15 async params in dynamic routes...\n');

let fixed = 0;
let skipped = 0;

for (const file of routeFiles) {
  const filePath = path.join(process.cwd(), file);

  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Skipped: ${file} (not found)`);
    skipped++;
    continue;
  }

  const content = fs.readFileSync(filePath, 'utf8');

  // Check if already fixed
  if (content.includes('context: { params: Promise<{ id: string }> }')) {
    console.log(`✓  Already fixed: ${file}`);
    skipped++;
    continue;
  }

  const fixedContent = fixAsyncParams(content);
  fs.writeFileSync(filePath, fixedContent, 'utf8');
  console.log(`✓  Fixed: ${file}`);
  fixed++;
}

console.log(`\n✅ Done! Fixed ${fixed} files, skipped ${skipped} files.`);
