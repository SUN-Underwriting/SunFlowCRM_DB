'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  severity: string;
  readAt: string | null;
  createdAt: string;
}

interface NotificationsState {
  items: Notification[];
  unreadCount: number;
  isLoading: boolean;
  hasMore: boolean;
  nextCursor?: string;
}

const POLL_INTERVAL_MS = 60_000;

export function useNotifications() {
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
      // Silently fail
    }
  }, []);

  const fetchNotifications = useCallback(
    async (cursor?: string) => {
      try {
        const params = new URLSearchParams({ limit: '15' });
        if (cursor) params.set('cursor', cursor);

        const res = await fetch(`/api/notifications?${params}`);
        if (!res.ok) return;

        const { data } = await res.json();
        setState((prev) => ({
          ...prev,
          items: cursor
            ? [...prev.items, ...data.items]
            : data.items,
          hasMore: data.hasMore,
          nextCursor: data.nextCursor,
          isLoading: false,
        }));
      } catch {
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    },
    []
  );

  const loadMore = useCallback(() => {
    if (state.hasMore && state.nextCursor) {
      fetchNotifications(state.nextCursor);
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

  // SSE subscription with polling fallback
  useEffect(() => {
    fetchUnreadCount();
    fetchNotifications();

    let sseConnected = false;

    try {
      const es = new EventSource('/api/notifications/sse');
      eventSourceRef.current = es;

      es.addEventListener('unread_count', (e) => {
        const data = JSON.parse(e.data);
        setState((prev) => ({ ...prev, unreadCount: data.count }));
        sseConnected = true;
      });

      es.addEventListener('notification.new', () => {
        fetchUnreadCount();
        fetchNotifications();
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

    function startPolling() {
      if (pollTimerRef.current) return;
      pollTimerRef.current = setInterval(fetchUnreadCount, POLL_INTERVAL_MS);
    }

    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [fetchUnreadCount, fetchNotifications]);

  return {
    ...state,
    loadMore,
    markAsRead,
    markAllAsRead,
    refresh: () => {
      fetchUnreadCount();
      fetchNotifications();
    },
  };
}
