'use client';

import React from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  IconPaperclip,
  IconMessageCircle2
} from '@tabler/icons-react';
import { formatCurrency } from '@/lib/format-currency';
import type { DealWithRelations } from '@/lib/api/crm-types';

interface DealCardProps {
  deal: DealWithRelations;
  isDragging?: boolean;
  onClick?: (deal: DealWithRelations) => void;
}

const PRIORITY_STYLES: Record<string, { bg: string; text: string }> = {
  HIGH: { bg: 'bg-zinc-900 dark:bg-zinc-100', text: 'text-white dark:text-zinc-900' },
  NORMAL: { bg: 'bg-zinc-200 dark:bg-zinc-700', text: 'text-zinc-700 dark:text-zinc-200' },
  LOW: { bg: 'bg-zinc-100 dark:bg-zinc-800', text: 'text-zinc-500 dark:text-zinc-400' }
};

function getInitials(firstName?: string | null, lastName?: string | null) {
  return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || '?';
}

function probabilityColor(pct: number) {
  if (pct >= 80) return 'text-green-500';
  if (pct >= 40) return 'text-amber-500';
  return 'text-zinc-400';
}

export const DealCard = React.memo(function DealCard({
  deal,
  isDragging,
  onClick
}: DealCardProps) {
  const contactName = deal.person
    ? `${deal.person.firstName || ''} ${deal.person.lastName || ''}`.trim()
    : deal.organization?.name || null;

  const probability =
    deal.probability ?? (deal.stage as { probability?: number })?.probability;
  const pct = probability != null ? Number(probability) : null;

  const notesCount = deal._count?.notes ?? 0;
  const activitiesCount = deal._count?.activities ?? 0;
  const priority = deal.priority as string | null | undefined;
  const priorityStyle = priority ? PRIORITY_STYLES[priority] : null;

  return (
    <div
      onClick={onClick ? () => onClick(deal) : undefined}
      className={cn(
        'flex flex-col gap-3',
        isDragging && 'opacity-60',
        onClick && 'cursor-pointer'
      )}
    >
      {/* Title */}
      <h4 className='line-clamp-2 text-sm font-semibold leading-snug'>
        {deal.title}
      </h4>

      {/* Subtitle: value + contact */}
      <p className='text-muted-foreground line-clamp-2 text-xs leading-relaxed'>
        {formatCurrency(deal.value, deal.currency || 'USD')}
        {contactName && ` · ${contactName}`}
      </p>

      {/* Middle row: avatar(s) + probability */}
      <div className='flex items-center justify-between'>
        <div className='flex -space-x-1.5'>
          {deal.owner && (
            <Avatar className='ring-background h-7 w-7 ring-2'>
              <AvatarFallback className='bg-primary/10 text-primary text-[10px] font-medium'>
                {getInitials(deal.owner.firstName, deal.owner.lastName)}
              </AvatarFallback>
            </Avatar>
          )}
          {deal.creator &&
            deal.creator.id !== deal.owner?.id && (
              <Avatar className='ring-background h-7 w-7 ring-2'>
                <AvatarFallback className='bg-orange-100 text-[10px] font-medium text-orange-600 dark:bg-orange-900 dark:text-orange-300'>
                  {getInitials(deal.creator.firstName, deal.creator.lastName)}
                </AvatarFallback>
              </Avatar>
            )}
        </div>

        {pct != null && (
          <div className='flex items-center gap-1'>
            <svg viewBox='0 0 20 20' className={cn('h-4 w-4', probabilityColor(pct))}>
              <circle
                cx='10'
                cy='10'
                r='8'
                fill='none'
                stroke='currentColor'
                strokeWidth='2.5'
                opacity='0.2'
              />
              <circle
                cx='10'
                cy='10'
                r='8'
                fill='none'
                stroke='currentColor'
                strokeWidth='2.5'
                strokeDasharray={`${(pct / 100) * 50.27} 50.27`}
                strokeLinecap='round'
                transform='rotate(-90 10 10)'
              />
            </svg>
            <span className='text-muted-foreground text-xs tabular-nums'>
              {pct}%
            </span>
          </div>
        )}
      </div>

      {/* Bottom row: priority + meta */}
      <div className='flex items-center justify-between'>
        {priorityStyle ? (
          <Badge
            className={cn(
              'pointer-events-none rounded-sm px-2 py-0.5 text-[11px] font-medium capitalize',
              priorityStyle.bg,
              priorityStyle.text
            )}
          >
            {priority!.charAt(0) + priority!.slice(1).toLowerCase()}
          </Badge>
        ) : (
          <span />
        )}

        <div className='text-muted-foreground flex items-center gap-2.5 text-xs tabular-nums'>
          {activitiesCount > 0 && (
            <span className='flex items-center gap-0.5'>
              <IconPaperclip className='h-3.5 w-3.5' />
              {activitiesCount}
            </span>
          )}
          {notesCount > 0 && (
            <span className='flex items-center gap-0.5'>
              <IconMessageCircle2 className='h-3.5 w-3.5' />
              {notesCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});
