import { NextRequest } from 'next/server';
import { getCurrentUserOrNull } from '@/lib/auth/get-current-user';
import { sseBroadcaster } from '@/server/notifications/sse-broadcaster';
import { getUnreadCount } from '@/server/notifications/service';

const HEARTBEAT_INTERVAL_MS = 30_000;

export async function GET(request: NextRequest) {
  const user = await getCurrentUserOrNull(request);
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { tenantId, id: userId } = user;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          // Stream closed
        }
      };

      // Send initial unread count
      try {
        const count = await getUnreadCount(tenantId, userId);
        send('unread_count', { count });
      } catch {
        // Non-critical
      }

      const unsubscribe = sseBroadcaster.subscribe(tenantId, userId, (evt) => {
        send(evt.type, evt.data);
      });

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'));
        } catch {
          clearInterval(heartbeat);
        }
      }, HEARTBEAT_INTERVAL_MS);

      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
