#!/usr/bin/env tsx
import 'dotenv/config';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { PrismaClient, UserRole } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { UserService } from '@/lib/services/user-service';

interface CorpAccountInput {
  email: string;
  role?: UserRole;
  firstName?: string;
  lastName?: string;
}

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = 'true';
      continue;
    }
    args[key] = next;
    i++;
  }
  return args;
}

function normalizeRole(role?: string): UserRole {
  if (!role) return UserRole.MEMBER;
  const value = role.toUpperCase();
  if (!(value in UserRole)) {
    throw new Error(`Invalid role: ${role}`);
  }
  return value as UserRole;
}

function loadAccounts(filePath: string): CorpAccountInput[] {
  const abs = resolve(process.cwd(), filePath);
  const raw = readFileSync(abs, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('Accounts file must be an array');
  }
  return parsed.map((item, i) => {
    if (!item?.email || typeof item.email !== 'string') {
      throw new Error(`accounts[${i}].email is required`);
    }
    return {
      email: item.email,
      role: normalizeRole(item.role),
      firstName: item.firstName,
      lastName: item.lastName
    };
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const file = args.file;
  const tenantSlug = args.tenant || 'default';
  const actorEmail = args.actor;

  if (!file) {
    throw new Error(
      'Usage: npx tsx scripts/create-corp-accounts.ts --file scripts/corp-accounts.json [--tenant default] [--actor admin@...]'
    );
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is missing');
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, slug: true, name: true }
    });

    if (!tenant) {
      throw new Error(`Tenant not found by slug: ${tenantSlug}`);
    }

    const actor = actorEmail
      ? await prisma.user.findFirst({
          where: {
            tenantId: tenant.id,
            email: actorEmail,
            role: UserRole.ADMIN
          },
          select: { id: true, email: true, role: true }
        })
      : await prisma.user.findFirst({
          where: { tenantId: tenant.id, role: UserRole.ADMIN },
          orderBy: { createdAt: 'asc' },
          select: { id: true, email: true, role: true }
        });

    if (!actor) {
      throw new Error(
        actorEmail
          ? `Admin actor not found in tenant: ${actorEmail}`
          : `No ADMIN user found in tenant: ${tenant.slug}`
      );
    }

    const accounts = loadAccounts(file);
    const userService = new UserService(tenant.id, actor.id);

    console.log(`Tenant: ${tenant.name} (${tenant.slug})`);
    console.log(`Actor admin: ${actor.email}`);
    console.log(`Creating ${accounts.length} corp account(s)...`);

    for (const account of accounts) {
      try {
        const created = await userService.inviteUser({
          email: account.email,
          role: account.role ?? UserRole.MEMBER,
          firstName: account.firstName,
          lastName: account.lastName
        });

        console.log(
          `OK  ${account.email} role=${account.role ?? UserRole.MEMBER} id=${created?.id ?? 'n/a'}`
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.log(`SKIP ${account.email} -> ${message}`);
      }
    }

    console.log('Done.');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
