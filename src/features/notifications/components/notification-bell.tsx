'use client';

import { Bell, CheckCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications } from '../hooks/use-notifications';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

/** Build a deep-link path from notification data. Returns null when no entity. */
function buildEntityPath(data: Record<string, unknown>): string | null {
  const kind = data.entityKind as string | undefined;
  const id = data.entityId as string | undefined;
  if (!kind || !id) return null;
  const paths: Record<string, string> = {
    deal: `/dashboard/crm/deals/${id}`,
    lead: `/dashboard/crm/leads/${id}`,
    activity: `/dashboard/crm/activities`,
  };
  return paths[kind] ?? null;
}

export function NotificationBell() {
  const router = useRouter();
  const {
    items,
    unreadCount,
    isLoading,
    hasMore,
    loadMore,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant='ghost' size='icon' className='relative h-8 w-8'>
          <Bell className='h-4 w-4' />
          {unreadCount > 0 && (
            <span className='absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground'>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className='flex w-80 flex-col p-0
          max-h-[min(480px,calc(var(--radix-popover-content-available-height)-16px))]'
        align='end'
        sideOffset={8}
        avoidCollisions
        collisionPadding={12}
      >
        {/* Fixed header */}
        <div className='flex shrink-0 items-center justify-between border-b px-4 py-3'>
          <h4 className='text-sm font-semibold'>Notifications</h4>
          {unreadCount > 0 && (
            <Button
              variant='ghost'
              size='sm'
              className='h-auto px-2 py-1 text-xs'
              onClick={markAllAsRead}
            >
              <CheckCheck className='mr-1 h-3 w-3' />
              Mark all read
            </Button>
          )}
        </div>

        {/* Scrollable list — takes remaining height */}
        <div className='min-h-0 flex-1 overflow-y-auto'>
          {isLoading ? (
            <div className='py-8 text-center text-sm text-muted-foreground'>
              Loading...
            </div>
          ) : items.length === 0 ? (
            <div className='py-8 text-center text-sm text-muted-foreground'>
              No notifications yet
            </div>
          ) : (
            <div className='divide-y'>
              {items.map((notification) => (
                <button
                  key={notification.id}
                  className={cn(
                    'flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-muted/50',
                    !notification.readAt && 'bg-muted/30'
                  )}
                  onClick={() => {
                    if (!notification.readAt) markAsRead(notification.id);
                    const path = buildEntityPath(notification.data);
                    if (path) router.push(path);
                  }}
                >
                  <div className='flex items-start justify-between gap-2'>
                    <span className='text-sm font-medium leading-tight'>
                      {notification.title}
                    </span>
                    {!notification.readAt && (
                      <span className='mt-1 h-2 w-2 shrink-0 rounded-full bg-primary' />
                    )}
                  </div>
                  <p className='text-xs text-muted-foreground line-clamp-2'>
                    {notification.body}
                  </p>
                  <time className='text-[11px] text-muted-foreground/70'>
                    {formatDistanceToNow(new Date(notification.createdAt), {
                      addSuffix: true,
                    })}
                  </time>
                </button>
              ))}
              {hasMore && (
                <button
                  className='w-full py-2.5 text-center text-xs text-muted-foreground hover:text-foreground'
                  onClick={loadMore}
                >
                  Load more
                </button>
              )}
            </div>
          )}
        </div>

        {/* Fixed footer — link to full notifications page */}
        <div className='shrink-0 border-t'>
          <button
            className='w-full py-2.5 text-center text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors'
            onClick={() => router.push('/dashboard/notifications')}
          >
            View all notifications
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
