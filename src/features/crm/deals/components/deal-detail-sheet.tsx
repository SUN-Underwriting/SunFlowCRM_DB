'use client';

import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import {
  IconUser,
  IconBuilding,
  IconCalendar,
  IconCurrencyDollar,
  IconEdit,
  IconTrash
} from '@tabler/icons-react';
import { useDeal, useDeleteDeal } from '../hooks/use-deals';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/format-currency';
import type { DealWithRelations } from '@/lib/api/crm-types';

interface DealDetailSheetProps {
  dealId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusColors: Record<string, string> = {
  OPEN: 'bg-blue-500/10 text-blue-700 border-blue-200',
  WON: 'bg-green-500/10 text-green-700 border-green-200',
  LOST: 'bg-red-500/10 text-red-700 border-red-200'
};

export function DealDetailSheet({
  dealId,
  open,
  onOpenChange
}: DealDetailSheetProps) {
  const { data: deal, isLoading } = useDeal(dealId || '');
  const deleteDeal = useDeleteDeal();

  const handleDelete = async () => {
    if (!dealId) return;
    await deleteDeal.mutateAsync(dealId);
    onOpenChange(false);
  };

  const contactName = deal?.person
    ? `${deal.person.firstName} ${deal.person.lastName}`
    : deal?.organization?.name || null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='w-full overflow-y-auto sm:max-w-lg'>
        <SheetHeader>
          <SheetTitle className='text-xl'>
            {isLoading ? 'Loading...' : deal ? deal.title : 'Deal Details'}
          </SheetTitle>
          {deal && (
            <SheetDescription className='mt-1'>
              {deal.pipeline?.name} &middot; {deal.stage?.name}
            </SheetDescription>
          )}
        </SheetHeader>

        {isLoading ? (
          <div className='space-y-4 pt-6'>
            <Skeleton className='h-8 w-3/4' />
            <Skeleton className='h-4 w-1/2' />
            <Separator />
            <Skeleton className='h-20 w-full' />
            <Skeleton className='h-20 w-full' />
          </div>
        ) : !deal ? (
          <div className='text-muted-foreground flex h-48 items-center justify-center'>
            Deal not found
          </div>
        ) : (
          <>
            <div className='mt-6 flex items-center justify-end'>
              <Badge
                variant='outline'
                className={statusColors[deal.status] || ''}
              >
                {deal.status}
              </Badge>
            </div>

            <div className='mt-6 space-y-6'>
              {/* Value */}
              <div className='flex items-center gap-3'>
                <IconCurrencyDollar className='text-muted-foreground h-5 w-5' />
                <div>
                  <p className='text-muted-foreground text-sm'>Deal Value</p>
                  <p className='text-lg font-semibold'>
                    {formatCurrency(deal.value ?? 0, deal.currency || 'USD')}
                  </p>
                </div>
              </div>

              {/* Contact */}
              {contactName && (
                <div className='flex items-center gap-3'>
                  {deal.person ? (
                    <IconUser className='text-muted-foreground h-5 w-5' />
                  ) : (
                    <IconBuilding className='text-muted-foreground h-5 w-5' />
                  )}
                  <div>
                    <p className='text-muted-foreground text-sm'>Contact</p>
                    <p className='font-medium'>{contactName}</p>
                  </div>
                </div>
              )}

              {/* Owner */}
              {deal.owner && (
                <div className='flex items-center gap-3'>
                  <IconUser className='text-muted-foreground h-5 w-5' />
                  <div>
                    <p className='text-muted-foreground text-sm'>Owner</p>
                    <p className='font-medium'>
                      {deal.owner.firstName} {deal.owner.lastName}
                    </p>
                    <p className='text-muted-foreground text-xs'>
                      {deal.owner.email}
                    </p>
                  </div>
                </div>
              )}

              {/* Expected Close Date */}
              {deal.expectedCloseDate && (
                <div className='flex items-center gap-3'>
                  <IconCalendar className='text-muted-foreground h-5 w-5' />
                  <div>
                    <p className='text-muted-foreground text-sm'>
                      Expected Close
                    </p>
                    <p className='font-medium'>
                      {format(new Date(deal.expectedCloseDate), 'PPP')}
                    </p>
                  </div>
                </div>
              )}

              {/* Won/Lost dates */}
              {deal.wonAt && (
                <div className='flex items-center gap-3'>
                  <IconCalendar className='h-5 w-5 text-green-600' />
                  <div>
                    <p className='text-muted-foreground text-sm'>Won At</p>
                    <p className='font-medium text-green-700'>
                      {format(new Date(deal.wonAt), 'PPP')}
                    </p>
                  </div>
                </div>
              )}
              {deal.lostAt && (
                <div className='flex items-center gap-3'>
                  <IconCalendar className='h-5 w-5 text-red-600' />
                  <div>
                    <p className='text-muted-foreground text-sm'>Lost At</p>
                    <p className='font-medium text-red-700'>
                      {format(new Date(deal.lostAt), 'PPP')}
                    </p>
                    {deal.lostReason && (
                      <p className='text-muted-foreground mt-0.5 text-xs'>
                        Reason: {deal.lostReason}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Counts */}
              {(deal._count?.activities || deal._count?.emails) && (
                <>
                  <Separator />
                  <div className='flex gap-6'>
                    {deal._count?.activities != null && (
                      <div>
                        <p className='text-2xl font-bold'>
                          {deal._count.activities}
                        </p>
                        <p className='text-muted-foreground text-xs'>
                          Activities
                        </p>
                      </div>
                    )}
                    {deal._count?.emails != null && (
                      <div>
                        <p className='text-2xl font-bold'>
                          {deal._count.emails}
                        </p>
                        <p className='text-muted-foreground text-xs'>Emails</p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Timestamps */}
              <Separator />
              <div className='text-muted-foreground space-y-1 text-xs'>
                <p>Created {format(new Date(deal.createdAt), 'PPP')}</p>
                <p>Updated {format(new Date(deal.updatedAt), 'PPP')}</p>
              </div>

              {/* Actions */}
              <Separator />
              <div className='flex gap-2'>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant='destructive'
                      size='sm'
                      disabled={deleteDeal.isPending}
                    >
                      <IconTrash className='mr-2 h-4 w-4' />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Deal</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete &quot;{deal.title}
                        &quot;? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
