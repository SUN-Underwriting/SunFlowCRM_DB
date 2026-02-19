import { NextRequest, NextResponse } from 'next/server';
import { sseBroadcaster } from '@/server/notifications/sse-broadcaster';
import { CommonSchemas } from '@/lib/api/validation';
import { handleApiError } from '@/lib/api/response';

/**
 * Internal endpoint called by the worker process after creating notifications.
 * Protected by a shared secret (not exposed to end users).
 * v2: replace with Redis pub/sub.
 */
export async function POST(request: NextRequest) {
  const configuredSecret = process.env.INTERNAL_WORKER_SECRET;
  if (!configuredSecret) {
    return NextResponse.json(
      { error: 'Internal worker secret is not configured' },
      { status: 500 }
    );
  }

  const secret = request.headers.get('x-internal-secret');
  if (secret !== configuredSecret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const raw = await request.json();
    const { tenantId, userIds, event } = CommonSchemas.internalPushBody.parse(raw);

    sseBroadcaster.emitToUsers(tenantId, userIds, event);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
