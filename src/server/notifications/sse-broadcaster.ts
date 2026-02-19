type SseCallback = (event: SseEvent) => void;

export interface SseEvent {
  type: string;
  data: Record<string, unknown>;
}

interface Connection {
  userId: string;
  tenantId: string;
  callback: SseCallback;
}

const MAX_CONNECTIONS_PER_USER = 3;

/**
 * In-memory SSE broadcaster scoped by tenantId + userId.
 * v2: replace the in-memory map with Redis pub/sub for multi-instance.
 */
class SseBroadcaster {
  private connections = new Map<string, Connection[]>();

  private key(tenantId: string, userId: string) {
    return `${tenantId}:${userId}`;
  }

  subscribe(
    tenantId: string,
    userId: string,
    callback: SseCallback
  ): () => void {
    const k = this.key(tenantId, userId);
    const conns = this.connections.get(k) ?? [];

    if (conns.length >= MAX_CONNECTIONS_PER_USER) {
      conns.shift();
    }

    const conn: Connection = { userId, tenantId, callback };
    conns.push(conn);
    this.connections.set(k, conns);

    return () => {
      const current = this.connections.get(k);
      if (!current) return;
      const filtered = current.filter((c) => c !== conn);
      if (filtered.length === 0) {
        this.connections.delete(k);
      } else {
        this.connections.set(k, filtered);
      }
    };
  }

  emit(tenantId: string, userId: string, event: SseEvent) {
    const k = this.key(tenantId, userId);
    const conns = this.connections.get(k);
    if (!conns) return;
    for (const conn of conns) {
      try {
        conn.callback(event);
      } catch {
        // Connection dropped — will be cleaned up on unsubscribe
      }
    }
  }

  /**
   * Broadcast to multiple users (e.g., after creating notifications for N recipients).
   */
  emitToUsers(tenantId: string, userIds: string[], event: SseEvent) {
    for (const uid of userIds) {
      this.emit(tenantId, uid, event);
    }
  }
}

export const sseBroadcaster = new SseBroadcaster();
