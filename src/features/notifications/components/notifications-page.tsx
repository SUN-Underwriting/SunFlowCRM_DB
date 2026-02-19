'use client';

import { useState } from 'react';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import {
  Bell,
  CheckCheck,
  Archive,
  Filter,
  Calendar,
  UserCheck,
  AlertCircle,
  MessageSquare,
  AtSign,
  TrendingUp,
  Users,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useNotifications, type Notification } from '../hooks/use-notifications';

// ─── Icon map ─────────────────────────────────────────────────────────────────
const TYPE_ICONS: Record<string, React.ElementType> = {
  'crm.activity.assigned': UserCheck,
  'crm.activity.due_soon': Clock,
  'crm.activity.overdue': AlertCircle,
  'crm.activity.rescheduled': Calendar,
  'crm.deal.stage_changed': TrendingUp,
  'crm.deal.won': TrendingUp,
  'crm.deal.lost': TrendingUp,
  'crm.deal.rotten': TrendingUp,
  'crm.lead.assigned': Users,
  'crm.lead.converted': Users,
  'crm.comment.created': MessageSquare,
  'crm.mention.created': AtSign,
};

const TYPE_COLORS: Record<string, string> = {
  'crm.activity.overdue': 'text-destructive bg-destructive/10',
  'crm.deal.won': 'text-green-600 bg-green-50 dark:bg-green-950/30',
  'crm.deal.lost': 'text-destructive bg-destructive/10',
  'crm.mention.created': 'text-purple-600 bg-purple-50 dark:bg-purple-950/30',
};

const TYPE_GROUPS = [
  { label: 'All', value: '' },
  { label: 'Activities', value: 'activity' },
  { label: 'Deals', value: 'deal' },
  { label: 'Leads', value: 'lead' },
  { label: 'Comments', value: 'comment' },
] as const;

// ─── Date group helper ────────────────────────────────────────────────────────
function getDateGroup(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMMM d, yyyy');
}

function groupByDate(items: Notification[]): Array<{ label: string; items: Notification[] }> {
  const groups = new Map<string, Notification[]>();
  for (const item of items) {
    const label = getDateGroup(item.createdAt);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(item);
  }
  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

// ─── Single notification row ──────────────────────────────────────────────────
function NotificationRow({
  notification,
  onRead,
  onArchive,
}: {
  notification: Notification;
  onRead: (id: string) => void;
  onArchive: (id: string) => void;
}) {
  const Icon = TYPE_ICONS[notification.type] ?? Bell;
  const colorClass = TYPE_COLORS[notification.type] ?? 'text-primary bg-primary/10';
  const isUnread = !notification.readAt;

  const data = notification.data as Record<string, string>;
  const entityKind = data.entityKind as string | undefined;
  const entityId = data.entityId as string | undefined;

  function navigateToEntity() {
    if (!entityKind || !entityId) return;
    const paths: Record<string, string> = {
      activity: `/dashboard/crm/activities`,
      deal: `/dashboard/crm/deals/${entityId}`,
      lead: `/dashboard/crm/leads/${entityId}`,
    };
    const path = paths[entityKind];
    if (path) window.location.href = path;
  }

  return (
    <div
      className={cn(
        'group relative flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-muted/50',
        isUnread && 'bg-muted/30'
      )}
    >
      <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full', colorClass)}>
        <Icon className='h-4 w-4' />
      </div>

      <button
        className='min-w-0 flex-1 text-left'
        onClick={() => {
          if (isUnread) onRead(notification.id);
          navigateToEntity();
        }}
      >
        <div className='flex items-start justify-between gap-2'>
          <span className={cn('text-sm leading-snug', isUnread ? 'font-semibold' : 'font-medium')}>
            {notification.title}
          </span>
          {isUnread && (
            <span className='mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary' />
          )}
        </div>
        <p className='mt-0.5 text-xs text-muted-foreground line-clamp-2'>{notification.body}</p>
        <time className='mt-1 block text-[11px] text-muted-foreground/60'>
          {format(parseISO(notification.createdAt), 'HH:mm')}
        </time>
      </button>

      <div className='flex shrink-0 flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100'>
        {isUnread && (
          <Button
            variant='ghost'
            size='icon'
            className='h-6 w-6'
            title='Mark as read'
            onClick={(e) => {
              e.stopPropagation();
              onRead(notification.id);
            }}
          >
            <CheckCheck className='h-3.5 w-3.5' />
          </Button>
        )}
        <Button
          variant='ghost'
          size='icon'
          className='h-6 w-6'
          title='Archive'
          onClick={(e) => {
            e.stopPropagation();
            onArchive(notification.id);
          }}
        >
          <Archive className='h-3.5 w-3.5' />
        </Button>
      </div>
    </div>
  );
}

// ─── Main page component ──────────────────────────────────────────────────────
export function NotificationsPage() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState('');

  const types = typeFilter
    ? Object.values({
        activity: ['crm.activity.assigned', 'crm.activity.due_soon', 'crm.activity.overdue', 'crm.activity.rescheduled'],
        deal: ['crm.deal.stage_changed', 'crm.deal.won', 'crm.deal.lost', 'crm.deal.rotten'],
        lead: ['crm.lead.assigned', 'crm.lead.converted'],
        comment: ['crm.comment.created', 'crm.mention.created'],
      }[typeFilter] ?? [])
    : undefined;

  const { items, unreadCount, isLoading, hasMore, loadMore, markAsRead, markAllAsRead, archive } =
    useNotifications({ unreadOnly, types });

  const grouped = groupByDate(items);

  return (
    <div className='mx-auto max-w-2xl space-y-6 px-4 py-8'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-3'>
          <h1 className='text-2xl font-semibold tracking-tight'>Notifications</h1>
          {unreadCount > 0 && (
            <Badge variant='destructive' className='rounded-full px-2 py-0.5 text-xs'>
              {unreadCount}
            </Badge>
          )}
        </div>
        {unreadCount > 0 && (
          <Button variant='outline' size='sm' onClick={markAllAsRead}>
            <CheckCheck className='mr-2 h-4 w-4' />
            Mark all read
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className='flex flex-wrap items-center gap-2'>
        <div className='flex items-center gap-1 rounded-md border p-0.5'>
          <Button
            variant={!unreadOnly ? 'secondary' : 'ghost'}
            size='sm'
            className='h-7 px-3 text-xs'
            onClick={() => setUnreadOnly(false)}
          >
            All
          </Button>
          <Button
            variant={unreadOnly ? 'secondary' : 'ghost'}
            size='sm'
            className='h-7 px-3 text-xs'
            onClick={() => setUnreadOnly(true)}
          >
            Unread
          </Button>
        </div>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className='h-8 w-36 text-xs'>
            <Filter className='mr-1.5 h-3.5 w-3.5 shrink-0' />
            <SelectValue placeholder='All types' />
          </SelectTrigger>
          <SelectContent>
            {TYPE_GROUPS.map((g) => (
              <SelectItem key={g.value} value={g.value} className='text-xs'>
                {g.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Feed */}
      <div className='space-y-6'>
        {isLoading ? (
          <div className='py-16 text-center text-sm text-muted-foreground'>
            Loading notifications...
          </div>
        ) : items.length === 0 ? (
          <div className='flex flex-col items-center gap-3 py-16 text-muted-foreground'>
            <Bell className='h-10 w-10 opacity-30' />
            <p className='text-sm'>{unreadOnly ? 'No unread notifications' : 'All caught up!'}</p>
          </div>
        ) : (
          grouped.map(({ label, items: groupItems }) => (
            <div key={label}>
              <div className='mb-2 flex items-center gap-2'>
                <span className='text-xs font-medium uppercase tracking-wider text-muted-foreground'>
                  {label}
                </span>
                <Separator className='flex-1' />
              </div>
              <div className='space-y-0.5'>
                {groupItems.map((n) => (
                  <NotificationRow
                    key={n.id}
                    notification={n}
                    onRead={markAsRead}
                    onArchive={archive}
                  />
                ))}
              </div>
            </div>
          ))
        )}

        {hasMore && (
          <div className='flex justify-center pt-2'>
            <Button variant='outline' size='sm' onClick={loadMore}>
              Load more
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
