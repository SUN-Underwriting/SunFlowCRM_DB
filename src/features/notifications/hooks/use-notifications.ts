'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  severity: string;
  sourceEventId?: string | null;
  readAt: string | null;
  archivedAt?: string | null;
  createdAt: string;
}

interface FetchOptions {
  cursor?: string;
  limit?: number;
  unreadOnly?: boolean;
  types?: string[];
  replace?: boolean;
}

interface NotificationsState {
  items: Notification[];
  unreadCount: number;
  isLoading: boolean;
  hasMore: boolean;
  nextCursor?: string;
}

const POLL_INTERVAL_MS = 60_000;

export function useNotifications(opts: { unreadOnly?: boolean; types?: string[] } = {}) {
  const [state, setState] = useState<NotificationsState>({
    items: [],
    unreadCount: 0,
    isLoading: true,
    hasMore: false,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/unread-count');
      if (res.ok) {
        const { data } = await res.json();
        setState((prev) => ({ ...prev, unreadCount: data.count }));
      }
    } catch {
      // Silently fail — unread count is non-critical
    }
  }, []);

  const fetchNotifications = useCallback(
    async (fetchOpts: FetchOptions = {}) => {
      const {
        cursor,
        limit = 20,
        unreadOnly = opts.unreadOnly,
        types = opts.types,
        replace = !cursor,
      } = fetchOpts;

      try {
        const params = new URLSearchParams({ limit: String(limit) });
        if (cursor) params.set('cursor', cursor);
        if (unreadOnly) params.set('unreadOnly', '1');
        if (types && types.length > 0) params.set('types', types.join(','));

        const res = await fetch(`/api/notifications?${params}`);
        if (!res.ok) return;

        const { data } = await res.json();
        setState((prev) => ({
          ...prev,
          items: replace ? data.items : [...prev.items, ...data.items],
          hasMore: data.hasMore,
          nextCursor: data.nextCursor,
          isLoading: false,
        }));
      } catch {
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    },
    [opts.unreadOnly, opts.types]
  );

  const loadMore = useCallback(() => {
    if (state.hasMore && state.nextCursor) {
      fetchNotifications({ cursor: state.nextCursor, replace: false });
    }
  }, [state.hasMore, state.nextCursor, fetchNotifications]);

  const markAsRead = useCallback(async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
    setState((prev) => ({
      ...prev,
      items: prev.items.map((n) =>
        n.id === id ? { ...n, readAt: new Date().toISOString() } : n
      ),
      unreadCount: Math.max(0, prev.unreadCount - 1),
    }));
  }, []);

  const markAllAsRead = useCallback(async () => {
    await fetch('/api/notifications/read-all', { method: 'POST' });
    setState((prev) => ({
      ...prev,
      items: prev.items.map((n) => ({
        ...n,
        readAt: n.readAt ?? new Date().toISOString(),
      })),
      unreadCount: 0,
    }));
  }, []);

  const archive = useCallback(async (id: string) => {
    await fetch(`/api/notifications/${id}/archive`, { method: 'POST' });
    setState((prev) => ({
      ...prev,
      items: prev.items.filter((n) => n.id !== id),
    }));
  }, []);

  const refresh = useCallback(() => {
    fetchUnreadCount();
    fetchNotifications({ replace: true });
  }, [fetchUnreadCount, fetchNotifications]);

  // SSE subscription with polling fallback
  useEffect(() => {
    fetchUnreadCount();
    fetchNotifications({ replace: true });

    let sseConnected = false;

    function startPolling() {
      if (pollTimerRef.current) return;
      pollTimerRef.current = setInterval(fetchUnreadCount, POLL_INTERVAL_MS);
    }

    try {
      const es = new EventSource('/api/notifications/sse');
      eventSourceRef.current = es;

      es.addEventListener('unread_count', (e) => {
        const d = JSON.parse(e.data) as { count: number };
        setState((prev) => ({ ...prev, unreadCount: d.count }));
        sseConnected = true;
      });

      es.addEventListener('notification.new', () => {
        fetchUnreadCount();
        fetchNotifications({ replace: true });
        sseConnected = true;
      });

      es.onerror = () => {
        if (!sseConnected) {
          es.close();
          eventSourceRef.current = null;
          startPolling();
        }
      };
    } catch {
      startPolling();
    }

    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    ...state,
    loadMore,
    markAsRead,
    markAllAsRead,
    archive,
    refresh,
  };
}
