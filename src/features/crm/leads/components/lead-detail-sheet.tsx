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
import {
  IconUser,
  IconBuilding,
  IconExternalLink,
  IconEdit,
  IconTrash,
  IconArrowRight
} from '@tabler/icons-react';
import { useLead, useDeleteLead } from '../hooks/use-leads';
import { ConvertLeadDialog } from './convert-lead-dialog';
import { formatDistanceToNow } from 'date-fns';

interface LeadDetailSheetProps {
  leadId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Lead Detail Sheet - Display lead details with actions
 * Best Practice (Context7): Use Sheet for side panels
 */
export function LeadDetailSheet({
  leadId,
  open,
  onOpenChange
}: LeadDetailSheetProps) {
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const { data: lead, isLoading } = useLead(leadId || '');
  const deleteLead = useDeleteLead();

  if (!leadId || !open) return null;

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this lead?')) return;
    await deleteLead.mutateAsync(leadId);
    onOpenChange(false);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'NEW':
        return 'default' as const;
      case 'IN_PROGRESS':
        return 'secondary' as const;
      case 'CONVERTED':
        return 'outline' as const;
      case 'ARCHIVED':
        return 'destructive' as const;
      default:
        return 'default' as const;
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className='overflow-y-auto sm:max-w-xl'>
          <SheetHeader>
            <SheetTitle className='text-2xl'>
              {isLoading ? 'Loading...' : lead ? lead.title : 'Lead Details'}
            </SheetTitle>
            {lead && (
              <SheetDescription>
                Created{' '}
                {formatDistanceToNow(new Date(lead.createdAt), {
                  addSuffix: true
                })}
              </SheetDescription>
            )}
          </SheetHeader>

          {isLoading ? (
            <div className='flex items-center justify-center py-12'>
              <div className='text-muted-foreground text-sm'>Loading...</div>
            </div>
          ) : lead ? (
            <>
              <div className='mt-6 space-y-4'>
                {/* Status Badges */}
                <div className='flex items-center gap-2'>
                  <Badge variant={getStatusBadgeVariant(lead.status)}>
                    {lead.status}
                  </Badge>
                  {lead.source && (
                    <Badge variant='outline'>{lead.source}</Badge>
                  )}
                </div>
              </div>

              <div className='mt-6 space-y-6'>
                {/* Contact Information */}
                <div>
                  <h3 className='mb-3 text-sm font-semibold'>
                    Contact Information
                  </h3>
                  <div className='space-y-3'>
                    {lead.person && (
                      <div className='flex items-start gap-3'>
                        <IconUser className='text-muted-foreground mt-0.5 h-5 w-5' />
                        <div>
                          <div className='font-medium'>
                            {lead.person.firstName} {lead.person.lastName}
                          </div>
                          {lead.person.email && (
                            <div className='text-muted-foreground text-sm'>
                              {lead.person.email}
                            </div>
                          )}
                          {lead.person.phone && (
                            <div className='text-muted-foreground text-sm'>
                              {lead.person.phone}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {lead.organization && (
                      <div className='flex items-start gap-3'>
                        <IconBuilding className='text-muted-foreground mt-0.5 h-5 w-5' />
                        <div>
                          <div className='font-medium'>
                            {lead.organization.name}
                          </div>
                          {lead.organization.website && (
                            <a
                              href={lead.organization.website}
                              target='_blank'
                              rel='noopener noreferrer'
                              className='text-primary inline-flex items-center gap-1 text-sm hover:underline'
                            >
                              {lead.organization.website}
                              <IconExternalLink className='h-3 w-3' />
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                    {!lead.person && !lead.organization && (
                      <div className='text-muted-foreground text-sm'>
                        No contact information
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Owner */}
                {lead.owner && (
                  <div>
                    <h3 className='mb-2 text-sm font-semibold'>Owner</h3>
                    <div className='text-sm'>
                      {lead.owner.firstName || lead.owner.lastName
                        ? `${lead.owner.firstName || ''} ${lead.owner.lastName || ''}`.trim()
                        : lead.owner.email}
                    </div>
                  </div>
                )}

                <Separator />

                {/* Actions */}
                <div className='space-y-3'>
                  <h3 className='text-sm font-semibold'>Actions</h3>
                  <div className='flex flex-col gap-2'>
                    {lead.status !== 'CONVERTED' && (
                      <Button
                        onClick={() => setConvertDialogOpen(true)}
                        className='w-full justify-start'
                        size='sm'
                      >
                        <IconArrowRight className='mr-2 h-4 w-4' />
                        Convert to Deal
                      </Button>
                    )}
                    <Button
                      variant='outline'
                      size='sm'
                      className='w-full justify-start'
                    >
                      <IconEdit className='mr-2 h-4 w-4' />
                      Edit Lead
                    </Button>
                    <Button
                      variant='destructive'
                      size='sm'
                      className='w-full justify-start'
                      onClick={handleDelete}
                      disabled={deleteLead.isPending}
                    >
                      <IconTrash className='mr-2 h-4 w-4' />
                      {deleteLead.isPending ? 'Deleting...' : 'Delete Lead'}
                    </Button>
                  </div>
                </div>

                {/* Converted Deal Link */}
                {lead.convertedDealId && (
                  <>
                    <Separator />
                    <div>
                      <h3 className='mb-2 text-sm font-semibold'>
                        Converted to Deal
                      </h3>
                      <div className='text-sm'>
                        <a
                          href={`/dashboard/crm/deals?id=${lead.convertedDealId}`}
                          className='text-primary inline-flex items-center gap-1 hover:underline'
                        >
                          View Deal
                          <IconExternalLink className='h-3 w-3' />
                        </a>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className='flex items-center justify-center py-12'>
              <div className='text-muted-foreground text-sm'>
                Lead not found
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Convert Dialog */}
      {lead && (
        <ConvertLeadDialog
          leadId={lead.id}
          open={convertDialogOpen}
          onOpenChange={setConvertDialogOpen}
          onSuccess={() => {
            setConvertDialogOpen(false);
            onOpenChange(false);
          }}
        />
      )}
    </>
  );
}
