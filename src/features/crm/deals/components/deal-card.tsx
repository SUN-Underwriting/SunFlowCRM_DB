'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { IconBuilding, IconUser, IconGripVertical } from '@tabler/icons-react';
import { formatCurrency } from '@/lib/format-currency';
import type { DealWithRelations } from '@/lib/api/crm-types';

interface DealCardProps {
  deal: DealWithRelations;
  isDragging?: boolean;
  onClick?: (deal: DealWithRelations) => void;
}

export function DealCard({ deal, isDragging, onClick }: DealCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging
  } = useSortable({ id: deal.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  const getInitials = (firstName?: string, lastName?: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || '?';
  };

  const contactName = deal.person
    ? `${deal.person.firstName} ${deal.person.lastName}`
    : deal.organization?.name || 'No contact';

  const ownerInitials = deal.owner
    ? getInitials(
        deal.owner.firstName || undefined,
        deal.owner.lastName || undefined
      )
    : '?';

  const handleClick = (e: React.MouseEvent) => {
    // Only trigger click if it's not a drag gesture
    if (onClick && !isSortableDragging) {
      onClick(deal);
    }
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      onClick={handleClick}
      className={cn(
        'transition-shadow hover:shadow-md',
        (isDragging || isSortableDragging) && 'opacity-50',
        onClick && 'hover:ring-primary/50 cursor-pointer hover:ring-1'
      )}
    >
      <CardHeader className='pb-3'>
        <div className='flex items-start gap-2'>
          {/* Drag Handle */}
          <button
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            className='hover:bg-muted mt-0.5 flex-shrink-0 cursor-grab rounded p-0.5 active:cursor-grabbing'
            onClick={(e) => e.stopPropagation()}
            aria-label='Drag to move deal'
          >
            <IconGripVertical className='text-muted-foreground h-4 w-4' />
          </button>

          {/* Deal Title */}
          <h4 className='flex-1 text-sm leading-tight font-medium'>
            {deal.title}
          </h4>

          {/* Owner Avatar */}
          <Avatar className='h-6 w-6 flex-shrink-0'>
            <AvatarFallback className='text-xs'>{ownerInitials}</AvatarFallback>
          </Avatar>
        </div>
      </CardHeader>
      <CardContent className='space-y-2 pt-0'>
        <div className='text-lg font-semibold'>
          {formatCurrency(deal.value, deal.currency || 'USD')}
        </div>
        <div className='text-muted-foreground flex items-center gap-2 text-sm'>
          {deal.person ? (
            <IconUser className='h-4 w-4' />
          ) : (
            <IconBuilding className='h-4 w-4' />
          )}
          <span className='truncate'>{contactName}</span>
        </div>
      </CardContent>
    </Card>
  );
}
