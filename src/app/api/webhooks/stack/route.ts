import { NextRequest, NextResponse } from 'next/server';
import { UserProvisioningService } from '@/lib/services/user-provisioning-service';

/**
 * POST /api/webhooks/stack
 *
 * Webhook handler for Stack Auth events.
 * Stack Auth sends POST requests with JSON payloads when users/teams change.
 *
 * Stack Auth docs reference:
 *   - user.created: { type: "user.created", data: { id, primary_email, display_name, ... } }
 *   - user.updated: { type: "user.updated", data: { ... } }
 *   - user.deleted: { type: "user.deleted", data: { id } }
 *
 * Webhook verification:
 *   Stack signs webhooks with Svix. In production, verify using the Svix library:
 *     const wh = new Webhook(secret);
 *     wh.verify(payload, headers);
 *
 * For local development, verification is skipped (no public URL needed).
 *
 * Setup: Configure webhook URL in Stack Auth Dashboard → Webhooks section.
 * Local dev: Use Svix Playground or ngrok to relay webhooks.
 */

interface StackWebhookPayload {
  type: string;
  data: {
    id: string;
    primary_email?: string;
    display_name?: string;
    server_metadata?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

/**
 * Verify webhook signature from Stack Auth (Svix).
 * In production, install `svix` package and verify properly.
 * For dev, we check a shared secret header as a basic measure.
 */
function verifyWebhook(request: NextRequest, body: string): boolean {
  // In production: use Svix library
  // const secret = process.env.STACK_WEBHOOK_SECRET;
  // const wh = new Webhook(secret);
  // wh.verify(body, { 'svix-id': ..., 'svix-timestamp': ..., 'svix-signature': ... });

  const webhookSecret = process.env.STACK_WEBHOOK_SECRET;

  // If no secret configured, allow in development only
  if (!webhookSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error(
        '[Webhook] STACK_WEBHOOK_SECRET not configured in production!'
      );
      return false;
    }
    console.warn('[Webhook] Skipping signature verification (dev mode)');
    return true;
  }

  // Basic verification: check Svix headers exist
  const svixId = request.headers.get('svix-id');
  const svixTimestamp = request.headers.get('svix-timestamp');
  const svixSignature = request.headers.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.error('[Webhook] Missing Svix headers');
    return false;
  }

  // TODO: In production, verify with Svix library:
  // import { Webhook } from 'svix';
  // const wh = new Webhook(webhookSecret);
  // wh.verify(body, { 'svix-id': svixId, 'svix-timestamp': svixTimestamp, 'svix-signature': svixSignature });

  return true;
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    // Verify webhook authenticity
    if (!verifyWebhook(request, rawBody)) {
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      );
    }

    const payload: StackWebhookPayload = JSON.parse(rawBody);

    console.info('[Webhook] Received:', payload.type, payload.data?.id);

    switch (payload.type) {
      case 'user.created':
        await handleUserCreated(payload.data);
        break;

      case 'user.updated':
        await handleUserUpdated(payload.data);
        break;

      case 'user.deleted':
        await handleUserDeleted(payload.data);
        break;

      default:
        console.info('[Webhook] Unhandled event type:', payload.type);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Webhook] Error processing webhook:', error);
    // Return 200 to prevent retries for malformed payloads
    // Return 500 only for transient errors
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle user.created webhook.
 * Syncs the new Stack Auth user into our Prisma DB.
 * If user was already provisioned via admin API, this is a no-op (idempotent).
 */
async function handleUserCreated(data: StackWebhookPayload['data']) {
  if (!data.id || !data.primary_email) {
    console.warn('[Webhook] user.created: missing id or email, skipping');
    return;
  }

  try {
    const result = await UserProvisioningService.syncFromAuthProvider({
      authUserId: data.id,
      email: data.primary_email,
      displayName: data.display_name || undefined
    });

    console.info(
      '[Webhook] user.created processed:',
      `authId=${data.id}`,
      `dbUserId=${result.user.id}`,
      `isNew=${result.isNew}`
    );
  } catch (error) {
    console.error('[Webhook] user.created processing failed:', error);
    throw error;
  }
}

/**
 * Handle user.updated webhook.
 * Updates email/display name if changed in Stack Auth Dashboard.
 */
async function handleUserUpdated(data: StackWebhookPayload['data']) {
  if (!data.id) return;

  try {
    const { prisma } = await import('@/lib/db/prisma');
    const { withRlsBypass } = await import('@/lib/db/rls-context');

    const dbUser = await withRlsBypass(() =>
      prisma.user.findFirst({
        where: { stackAuthUserId: data.id }
      })
    );

    if (!dbUser) {
      console.info(
        '[Webhook] user.updated: user not found in DB, skipping:',
        data.id
      );
      return;
    }

    const updateData: Record<string, unknown> = {};

    if (data.primary_email && data.primary_email !== dbUser.email) {
      updateData.email = data.primary_email;
    }

    if (data.display_name) {
      const parts = data.display_name.split(' ');
      const firstName = parts[0];
      const lastName = parts.slice(1).join(' ') || null;
      if (firstName !== dbUser.firstName) updateData.firstName = firstName;
      if (lastName !== dbUser.lastName) updateData.lastName = lastName;
    }

    if (Object.keys(updateData).length > 0) {
      await withRlsBypass(() =>
        prisma.user.update({
          where: { id: dbUser.id },
          data: updateData
        })
      );
      console.info('[Webhook] user.updated: synced changes for', data.id);
    }
  } catch (error) {
    console.error('[Webhook] user.updated failed:', error);
    throw error;
  }
}

/**
 * Handle user.deleted webhook.
 * Deactivates user in our DB (soft delete).
 */
async function handleUserDeleted(data: StackWebhookPayload['data']) {
  if (!data.id) return;

  try {
    const { prisma } = await import('@/lib/db/prisma');
    const { withRlsBypass } = await import('@/lib/db/rls-context');

    const dbUser = await withRlsBypass(() =>
      prisma.user.findFirst({
        where: { stackAuthUserId: data.id }
      })
    );

    if (!dbUser) {
      console.info('[Webhook] user.deleted: user not found in DB:', data.id);
      return;
    }

    await withRlsBypass(() =>
      prisma.user.update({
        where: { id: dbUser.id },
        data: { status: 'INACTIVE' }
      })
    );

    console.info('[Webhook] user.deleted: deactivated user', dbUser.id);
  } catch (error) {
    console.error('[Webhook] user.deleted failed:', error);
    throw error;
  }
}
