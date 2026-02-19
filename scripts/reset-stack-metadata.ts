/**
 * Reset Stack Auth serverMetadata for all users.
 * After DB reset, serverMetadata contains stale tenantId.
 * Clearing it forces re-provisioning on next login.
 *
 * Usage: npx tsx scripts/reset-stack-metadata.ts
 */
import 'dotenv/config';

const STACK_API_URL = process.env.NEXT_PUBLIC_STACK_API_URL || 'http://localhost:8102';
const PROJECT_ID = process.env.NEXT_PUBLIC_STACK_PROJECT_ID!;
const SECRET_KEY = process.env.STACK_SECRET_SERVER_KEY!;

async function main() {
  console.log('Fetching users from Stack Auth...');

  const res = await fetch(`${STACK_API_URL}/api/v1/users`, {
    headers: {
      'x-stack-access-type': 'server',
      'x-stack-project-id': PROJECT_ID,
      'x-stack-secret-server-key': SECRET_KEY,
      'x-stack-publishable-client-key': process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY!
    }
  });

  if (!res.ok) {
    throw new Error(`Failed to list users: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const users = data.items || data.users || data;

  console.log(`Found ${Array.isArray(users) ? users.length : '?'} users`);

  if (!Array.isArray(users)) {
    console.log('Response:', JSON.stringify(data, null, 2));
    return;
  }

  for (const user of users) {
    console.log(`Resetting serverMetadata for ${user.primary_email || user.id}...`);

    const updateRes = await fetch(`${STACK_API_URL}/api/v1/users/${user.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-stack-access-type': 'server',
        'x-stack-project-id': PROJECT_ID,
        'x-stack-secret-server-key': SECRET_KEY,
        'x-stack-publishable-client-key': process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY!
      },
      body: JSON.stringify({ server_metadata: {} })
    });

    if (!updateRes.ok) {
      console.error(`  Failed: ${updateRes.status} ${await updateRes.text()}`);
    } else {
      console.log(`  Done`);
    }
  }

  console.log('\nAll done! Refresh the browser to trigger re-provisioning.');
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
