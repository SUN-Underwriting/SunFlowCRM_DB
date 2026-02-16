/**
 * User Migration Script: SuperTokens → Stack Auth
 *
 * This script migrates existing SuperTokens users to Stack Auth.
 * It preserves all user data and creates a migration log for rollback.
 *
 * Usage:
 *   npx tsx scripts/migrate-users-to-stack.ts
 *
 * Prerequisites:
 *   1. Stack Auth credentials configured in .env
 *   2. Database backup created
 *   3. Stack Auth project created at https://app.stack-auth.com/
 *
 * What it does:
 *   1. Reads all users from the database
 *   2. For each user with supertokensUserId:
 *      - Creates user in Stack Auth
 *      - Adds tenantId and roles to Stack Auth metadata
 *      - Updates database with stackAuthUserId
 *   3. Creates migration log file for rollback
 *
 * Safety:
 *   - Does NOT delete supertokensUserId (preserved for rollback)
 *   - Creates migration log at ./migration-log-{timestamp}.json
 *   - Skips users that already have stackAuthUserId
 */

import { StackServerApp } from '@stackframe/stack';
import { prisma } from '../src/lib/db/prisma';
import SuperTokens from 'supertokens-node';
import { ensureSuperTokensInit } from '../src/lib/supertokens/config';
import * as fs from 'fs/promises';
import * as path from 'path';

// Initialize SuperTokens
ensureSuperTokensInit();

// Initialize Stack Auth
const stackApp = new StackServerApp({
  tokenStore: 'nextjs-cookie',
  urls: {
    signIn: '/auth/sign-in',
    afterSignIn: '/dashboard/overview',
    afterSignOut: '/auth/sign-in'
  }
});

interface MigrationLogEntry {
  userId: string;
  email: string;
  supertokensId: string;
  stackId: string;
  tenantId: string;
  role: string;
  migratedAt: string;
}

interface MigrationStats {
  total: number;
  migrated: number;
  skipped: number;
  failed: number;
}

async function migrateUsers() {
  console.log('🚀 Starting user migration: SuperTokens → Stack Auth\n');

  const migrationLog: MigrationLogEntry[] = [];
  const stats: MigrationStats = {
    total: 0,
    migrated: 0,
    skipped: 0,
    failed: 0
  };

  try {
    // 1. Get all users from database
    console.log('📊 Fetching users from database...');
    const users = await prisma.user.findMany({
      where: {
        status: 'ACTIVE' // Only migrate active users
      },
      include: { tenant: true }
    });

    stats.total = users.length;
    console.log(`Found ${users.length} users to migrate\n`);

    // 2. Migrate each user
    for (const user of users) {
      try {
        // Skip if already migrated
        if (user.stackAuthUserId) {
          console.log(`⏭️  Skipping ${user.email} (already migrated)`);
          stats.skipped++;
          continue;
        }

        // Skip if no SuperTokens user ID
        if (!user.supertokensUserId) {
          console.log(`⚠️  Skipping ${user.email} (no SuperTokens ID)`);
          stats.skipped++;
          continue;
        }

        console.log(`\n🔄 Migrating ${user.email}...`);

        // 3. Get user data from SuperTokens
        const stUser = await SuperTokens.getUser(user.supertokensUserId);

        if (!stUser) {
          console.log(`❌ SuperTokens user not found for ${user.email}`);
          stats.failed++;
          continue;
        }

        const emailMethod = stUser.loginMethods.find(
          (lm) => lm.recipeId === 'emailpassword'
        );
        const email = emailMethod?.email;

        if (!email) {
          console.log(`❌ No email found for ${user.email}`);
          stats.failed++;
          continue;
        }

        // 4. Create user in Stack Auth
        console.log(`   Creating Stack Auth user...`);
        const stackUser = await stackApp.createUser({
          primaryEmail: email,
          // Note: Stack Auth will send email verification
          // Password will need to be reset by user
          displayName: user.firstName
            ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`
            : undefined
        });

        // 5. Add tenant and role metadata
        console.log(`   Setting metadata...`);
        await stackUser.update({
          serverMetadata: {
            tenantId: user.tenantId,
            roles: [user.role]
          }
        });

        // 6. Update database
        console.log(`   Updating database...`);
        await prisma.user.update({
          where: { id: user.id },
          data: {
            stackAuthUserId: stackUser.id
            // Keep supertokensUserId for rollback
          }
        });

        // 7. Log migration
        migrationLog.push({
          userId: user.id,
          email,
          supertokensId: user.supertokensUserId,
          stackId: stackUser.id,
          tenantId: user.tenantId,
          role: user.role,
          migratedAt: new Date().toISOString()
        });

        stats.migrated++;
        console.log(`   ✅ Successfully migrated ${email}`);
      } catch (error) {
        console.error(`   ❌ Failed to migrate ${user.email}:`, error);
        stats.failed++;
      }
    }

    // 8. Save migration log
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const logFilePath = path.join(
      process.cwd(),
      `migration-log-${timestamp}.json`
    );

    await fs.writeFile(
      logFilePath,
      JSON.stringify(
        {
          migratedAt: new Date().toISOString(),
          stats,
          migrations: migrationLog
        },
        null,
        2
      )
    );

    console.log('\n📄 Migration log saved to:', logFilePath);

    // 9. Print summary
    console.log('\n' + '='.repeat(50));
    console.log('✨ Migration Complete!');
    console.log('='.repeat(50));
    console.log(`Total users:     ${stats.total}`);
    console.log(`Migrated:        ${stats.migrated} ✅`);
    console.log(`Skipped:         ${stats.skipped} ⏭️`);
    console.log(`Failed:          ${stats.failed} ❌`);
    console.log('='.repeat(50));

    if (stats.failed > 0) {
      console.log('\n⚠️  Some users failed to migrate. Check the log above.');
    }

    console.log('\n📝 Next steps:');
    console.log('1. Review migration log file');
    console.log('2. Test login with Stack Auth (set AUTH_PROVIDER=stack)');
    console.log('3. Notify users they may need to reset passwords');
    console.log('4. Keep SuperTokens running for rollback capability');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateUsers().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
