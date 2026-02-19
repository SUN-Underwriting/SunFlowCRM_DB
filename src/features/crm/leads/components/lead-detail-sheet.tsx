'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  IconExternalLink,
  IconTrash,
  IconArrowRight,
  IconArchive,
  IconCopy,
  IconPhone,
  IconMail,
  IconCalendar,
  IconCurrencyDollar,
  IconPlus,
  IconNote,
  IconActivity,
  IconPin,
  IconRestore
} from '@tabler/icons-react';
import {
  useLead,
  useUpdateLead,
  useDeleteLead,
  useArchiveLead,
  useRestoreLead,
  useMarkLeadSeen,
  useLeadNotes,
  useCreateLeadNote,
  useLeadTimeline
} from '../hooks/use-leads';
import { ConvertLeadDialog } from './convert-lead-dialog';
import { InlineEditableField } from './inline-editable-field';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';
import type { LeadWithRelations, NoteWithRelations, TimelineItem } from '@/lib/api/crm-types';

interface LeadDetailSheetProps {
  leadId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_OPTIONS = [
  { value: 'OPEN', label: 'Open' },
  { value: 'LOST', label: 'Lost' },
  { value: 'ARCHIVED', label: 'Archived' }
];

const SOURCE_OPTIONS = [
  { value: 'WEBSITE', label: 'Website' },
  { value: 'REFERRAL', label: 'Referral' },
  { value: 'COLD_CALL', label: 'Cold Call' },
  { value: 'SOCIAL_MEDIA', label: 'Social Media' },
  { value: 'EVENT', label: 'Event' },
  { value: 'PARTNER', label: 'Partner' },
  { value: 'OTHER', label: 'Other' }
];

const CURRENCY_OPTIONS = [
  { value: 'CHF', label: 'CHF' },
  { value: 'EUR', label: 'EUR' },
  { value: 'USD', label: 'USD' },
  { value: 'GBP', label: 'GBP' }
];

function getStatusBadgeVariant(status: string) {
  switch (status) {
    case 'OPEN':
      return 'default' as const;
    case 'LOST':
      return 'destructive' as const;
    case 'CONVERTED':
      return 'outline' as const;
    case 'ARCHIVED':
      return 'secondary' as const;
    default:
      return 'default' as const;
  }
}

export function LeadDetailSheet({
  leadId,
  open,
  onOpenChange
}: LeadDetailSheetProps) {
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [newNoteBody, setNewNoteBody] = useState('');
  const [activeTab, setActiveTab] = useState<string>('focus');

  const { data: lead, isLoading } = useLead(leadId || '');
  const { data: notesData } = useLeadNotes(leadId || '');
  const { data: timelineData } = useLeadTimeline(leadId || '');

  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();
  const archiveLead = useArchiveLead();
  const restoreLead = useRestoreLead();
  const markSeen = useMarkLeadSeen();
  const createNote = useCreateLeadNote();

  // Mark lead as seen when opened
  useEffect(() => {
    if (lead && lead.wasSeen === false && leadId) {
      markSeen.mutate(leadId);
    }
  }, [lead?.id]);

  const handleFieldUpdate = useCallback(
    (field: string, value: unknown) => {
      if (!leadId) return;
      updateLead.mutate({ id: leadId, data: { [field]: value } });
    },
    [leadId, updateLead]
  );

  const handleDelete = async () => {
    if (!leadId) return;
    await deleteLead.mutateAsync(leadId);
    onOpenChange(false);
  };

  const handleArchive = async () => {
    if (!leadId) return;
    await archiveLead.mutateAsync(leadId);
  };

  const handleRestore = async () => {
    if (!leadId) return;
    await restoreLead.mutateAsync(leadId);
  };

  const handleAddNote = async () => {
    if (!leadId || !newNoteBody.trim()) return;
    await createNote.mutateAsync({
      leadId,
      data: { body: newNoteBody.trim() }
    });
    setNewNoteBody('');
  };

  if (!leadId || !open) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className='overflow-hidden p-0 sm:max-w-3xl'>
          {isLoading ? (
            <div className='flex h-full items-center justify-center'>
              <div className='text-muted-foreground text-sm'>Loading...</div>
            </div>
          ) : !lead ? (
            <div className='flex h-full items-center justify-center'>
              <div className='text-muted-foreground text-sm'>
                Lead not found
              </div>
            </div>
          ) : (
            <div className='flex h-full flex-col'>
              {/* Header */}
              <SheetHeader className='border-b px-6 py-4'>
                <div className='flex items-start justify-between gap-4'>
                  <div className='min-w-0 flex-1'>
                    <SheetTitle className='text-xl'>
                      <InlineEditableField
                        value={lead.title}
                        onSave={(v) => handleFieldUpdate('title', v)}
                        placeholder='Lead title'
                        className='text-xl font-semibold'
                      />
                    </SheetTitle>
                    <div className='text-muted-foreground mt-1 text-sm'>
                      Created{' '}
                      {formatDistanceToNow(new Date(lead.createdAt), {
                        addSuffix: true
                      })}
                      {lead.creator &&
                        ` by ${lead.creator.firstName || ''} ${lead.creator.lastName || ''}`.trim()}
                    </div>
                  </div>
                  <div className='flex items-center gap-2'>
                    <Badge variant={getStatusBadgeVariant(lead.status)}>
                      {lead.status}
                    </Badge>
                    {lead.labelLinks?.map((ll) => (
                      <Badge
                        key={ll.label.id}
                        variant='outline'
                        style={
                          ll.label.color
                            ? {
                                borderColor: ll.label.color,
                                color: ll.label.color
                              }
                            : undefined
                        }
                      >
                        {ll.label.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              </SheetHeader>

              {/* Body: 2 columns */}
              <div className='flex min-h-0 flex-1'>
                {/* Left column: Lead details / Person / Org / Smart Bcc */}
                <ScrollArea className='w-[340px] shrink-0 border-r'>
                  <div className='space-y-1 p-4'>
                    {/* Lead Details Section */}
                    <SectionTitle>Lead Details</SectionTitle>
                    <FieldRow label='Status'>
                      {lead.status !== 'CONVERTED' ? (
                        <InlineEditableField
                          value={lead.status}
                          onSave={(v) => handleFieldUpdate('status', v)}
                          type='select'
                          options={STATUS_OPTIONS}
                        />
                      ) : (
                        <span className='text-sm'>Converted</span>
                      )}
                    </FieldRow>
                    <FieldRow label='Source'>
                      <InlineEditableField
                        value={lead.source}
                        onSave={(v) => handleFieldUpdate('source', v)}
                        type='select'
                        options={SOURCE_OPTIONS}
                        placeholder='Select source'
                      />
                    </FieldRow>
                    <FieldRow label='Value'>
                      <div className='flex items-center gap-1'>
                        <InlineEditableField
                          value={lead.valueAmount}
                          onSave={(v) => handleFieldUpdate('valueAmount', v)}
                          type='currency'
                          placeholder='0.00'
                          className='w-24'
                        />
                        <InlineEditableField
                          value={lead.valueCurrency}
                          onSave={(v) => handleFieldUpdate('valueCurrency', v)}
                          type='select'
                          options={CURRENCY_OPTIONS}
                          placeholder='CHF'
                        />
                      </div>
                    </FieldRow>
                    <FieldRow label='Expected Close'>
                      <InlineEditableField
                        value={
                          lead.expectedCloseDate
                            ? new Date(lead.expectedCloseDate)
                                .toISOString()
                                .split('T')[0]
                            : null
                        }
                        displayValue={
                          lead.expectedCloseDate
                            ? format(new Date(lead.expectedCloseDate), 'PP')
                            : undefined
                        }
                        onSave={(v) => handleFieldUpdate('expectedCloseDate', v)}
                        type='date'
                        placeholder='Set date'
                      />
                    </FieldRow>
                    <FieldRow label='Owner'>
                      <span className='text-sm'>
                        {lead.owner
                          ? `${lead.owner.firstName || ''} ${lead.owner.lastName || ''}`.trim() || lead.owner.email
                          : 'Unassigned'}
                      </span>
                    </FieldRow>
                    <FieldRow label='Channel'>
                      <InlineEditableField
                        value={lead.inboxChannel}
                        onSave={(v) => handleFieldUpdate('inboxChannel', v)}
                        placeholder='e.g. web_form'
                      />
                    </FieldRow>

                    {/* Description */}
                    <div className='pt-2'>
                      <label className='text-muted-foreground mb-1 block text-xs font-medium'>
                        Description
                      </label>
                      <InlineEditableField
                        value={lead.description}
                        onSave={(v) => handleFieldUpdate('description', v)}
                        placeholder='Add description...'
                        className='w-full'
                      />
                    </div>

                    <Separator className='my-3' />

                    {/* Person Section */}
                    <SectionTitle>Person</SectionTitle>
                    {lead.person ? (
                      <div className='space-y-1'>
                        <div className='flex items-start gap-2'>
                          <IconUser className='text-muted-foreground mt-0.5 h-4 w-4' />
                          <div className='min-w-0'>
                            <div className='text-sm font-medium'>
                              {lead.person.firstName} {lead.person.lastName}
                            </div>
                            {lead.person.jobTitle && (
                              <div className='text-muted-foreground text-xs'>
                                {lead.person.jobTitle}
                              </div>
                            )}
                          </div>
                        </div>
                        {lead.person.email && (
                          <a
                            href={`mailto:${lead.person.email}`}
                            className='text-primary flex items-center gap-1.5 text-sm hover:underline'
                          >
                            <IconMail className='h-3.5 w-3.5' />
                            {lead.person.email}
                          </a>
                        )}
                        {lead.person.phone && (
                          <a
                            href={`tel:${lead.person.phone}`}
                            className='text-primary flex items-center gap-1.5 text-sm hover:underline'
                          >
                            <IconPhone className='h-3.5 w-3.5' />
                            {lead.person.phone}
                          </a>
                        )}
                      </div>
                    ) : (
                      <div className='text-muted-foreground text-sm'>
                        No person linked
                      </div>
                    )}

                    <Separator className='my-3' />

                    {/* Organization Section */}
                    <SectionTitle>Organization</SectionTitle>
                    {lead.organization ? (
                      <div className='space-y-1'>
                        <div className='flex items-start gap-2'>
                          <IconBuilding className='text-muted-foreground mt-0.5 h-4 w-4' />
                          <div className='min-w-0'>
                            <div className='text-sm font-medium'>
                              {lead.organization.name}
                            </div>
                            {lead.organization.address && (
                              <div className='text-muted-foreground text-xs'>
                                {lead.organization.address}
                              </div>
                            )}
                          </div>
                        </div>
                        {lead.organization.website && (
                          <a
                            href={lead.organization.website}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='text-primary flex items-center gap-1.5 text-sm hover:underline'
                          >
                            <IconExternalLink className='h-3.5 w-3.5' />
                            {lead.organization.website}
                          </a>
                        )}
                        {lead.organization.phone && (
                          <a
                            href={`tel:${lead.organization.phone}`}
                            className='text-primary flex items-center gap-1.5 text-sm hover:underline'
                          >
                            <IconPhone className='h-3.5 w-3.5' />
                            {lead.organization.phone}
                          </a>
                        )}
                      </div>
                    ) : (
                      <div className='text-muted-foreground text-sm'>
                        No organization linked
                      </div>
                    )}

                    <Separator className='my-3' />

                    {/* Smart Bcc Section (UI-only placeholder) */}
                    <SectionTitle>Smart Bcc</SectionTitle>
                    <div className='text-muted-foreground space-y-2 text-xs'>
                      <SmartBccRow
                        label='Lead-specific'
                        value='Not configured'
                      />
                      <SmartBccRow label='Global' value='Not configured' />
                    </div>

                    <Separator className='my-3' />

                    {/* Converted Deal Link */}
                    {lead.convertedToDeal && (
                      <div className='pb-2'>
                        <SectionTitle>Converted Deal</SectionTitle>
                        <a
                          href={`/dashboard/crm/deals?id=${lead.convertedToDeal.id}`}
                          className='text-primary inline-flex items-center gap-1 text-sm hover:underline'
                        >
                          {lead.convertedToDeal.title}
                          <IconExternalLink className='h-3 w-3' />
                        </a>
                      </div>
                    )}

                    {/* Actions */}
                    <div className='space-y-2 pt-2'>
                      {lead.status !== 'CONVERTED' &&
                        lead.status !== 'ARCHIVED' && (
                          <>
                            <Button
                              onClick={() => setConvertDialogOpen(true)}
                              className='w-full justify-start'
                              size='sm'
                            >
                              <IconArrowRight className='mr-2 h-4 w-4' />
                              Convert to Deal
                            </Button>
                            <Button
                              variant='outline'
                              size='sm'
                              className='w-full justify-start'
                              onClick={handleArchive}
                              disabled={archiveLead.isPending}
                            >
                              <IconArchive className='mr-2 h-4 w-4' />
                              {archiveLead.isPending
                                ? 'Archiving...'
                                : 'Archive Lead'}
                            </Button>
                          </>
                        )}
                      {lead.status === 'ARCHIVED' && (
                        <Button
                          variant='outline'
                          size='sm'
                          className='w-full justify-start'
                          onClick={handleRestore}
                          disabled={restoreLead.isPending}
                        >
                          <IconRestore className='mr-2 h-4 w-4' />
                          {restoreLead.isPending
                            ? 'Restoring...'
                            : 'Restore Lead'}
                        </Button>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant='destructive'
                            size='sm'
                            className='w-full justify-start'
                            disabled={deleteLead.isPending}
                          >
                            <IconTrash className='mr-2 h-4 w-4' />
                            {deleteLead.isPending
                              ? 'Deleting...'
                              : 'Delete Lead'}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Lead</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete &quot;
                              {lead.title}&quot;? This action cannot be undone.
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
                </ScrollArea>

                {/* Right column: Focus / History tabs */}
                <div className='flex min-w-0 flex-1 flex-col'>
                  <Tabs
                    value={activeTab}
                    onValueChange={setActiveTab}
                    className='flex flex-1 flex-col'
                  >
                    <TabsList className='mx-4 mt-4 w-fit'>
                      <TabsTrigger value='focus'>Focus</TabsTrigger>
                      <TabsTrigger value='history'>History</TabsTrigger>
                    </TabsList>

                    <TabsContent
                      value='focus'
                      className='mt-0 flex-1 overflow-hidden'
                    >
                      <ScrollArea className='h-full'>
                        <div className='space-y-4 p-4'>
                          {/* Add note */}
                          <div className='space-y-2'>
                            <Textarea
                              placeholder='Write a note...'
                              value={newNoteBody}
                              onChange={(e) => setNewNoteBody(e.target.value)}
                              rows={3}
                              className='resize-none'
                            />
                            <Button
                              size='sm'
                              onClick={handleAddNote}
                              disabled={
                                !newNoteBody.trim() || createNote.isPending
                              }
                            >
                              <IconPlus className='mr-1 h-3.5 w-3.5' />
                              {createNote.isPending
                                ? 'Adding...'
                                : 'Add Note'}
                            </Button>
                          </div>

                          <Separator />

                          {/* Pinned notes */}
                          {notesData?.notes
                            .filter((n) => n.pinned)
                            .map((note) => (
                              <NoteCard key={note.id} note={note} />
                            ))}

                          {/* Upcoming activities placeholder */}
                          <div className='text-muted-foreground py-4 text-center text-sm'>
                            <IconCalendar className='mx-auto mb-2 h-8 w-8 opacity-50' />
                            <p>No upcoming activities</p>
                            <Button
                              variant='link'
                              size='sm'
                              className='mt-1'
                            >
                              <IconPlus className='mr-1 h-3.5 w-3.5' />
                              Schedule activity
                            </Button>
                          </div>
                        </div>
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent
                      value='history'
                      className='mt-0 flex-1 overflow-hidden'
                    >
                      <ScrollArea className='h-full'>
                        <div className='space-y-3 p-4'>
                          {timelineData?.items &&
                          timelineData.items.length > 0 ? (
                            timelineData.items.map((item) => (
                              <TimelineItemCard
                                key={`${item.type}-${item.id}`}
                                item={item}
                              />
                            ))
                          ) : (
                            <div className='text-muted-foreground py-8 text-center text-sm'>
                              No history yet
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

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

// --- Helper sub-components ---

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className='mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
      {children}
    </h3>
  );
}

function FieldRow({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className='flex items-center justify-between gap-2 py-0.5'>
      <span className='text-muted-foreground shrink-0 text-xs'>{label}</span>
      <div className='min-w-0 text-right'>{children}</div>
    </div>
  );
}

function SmartBccRow({ label, value }: { label: string; value: string }) {
  const isConfigured = value !== 'Not configured';

  return (
    <div className='flex items-center justify-between gap-2'>
      <span>{label}</span>
      <div className='flex items-center gap-1'>
        <span className={isConfigured ? '' : 'italic opacity-60'}>
          {value}
        </span>
        {isConfigured && (
          <button
            onClick={() => {
              navigator.clipboard.writeText(value);
              toast.success('Copied to clipboard');
            }}
            className='hover:text-foreground'
          >
            <IconCopy className='h-3 w-3' />
          </button>
        )}
      </div>
    </div>
  );
}

function NoteCard({ note }: { note: NoteWithRelations }) {
  return (
    <div className='rounded-md border p-3'>
      <div className='flex items-start justify-between gap-2'>
        <div className='flex items-center gap-1.5'>
          <IconNote className='text-muted-foreground h-3.5 w-3.5' />
          <span className='text-xs font-medium'>
            {note.author
              ? `${note.author.firstName || ''} ${note.author.lastName || ''}`.trim() || note.author.email
              : 'Unknown'}
          </span>
          {note.pinned && (
            <IconPin className='h-3 w-3 text-amber-500' />
          )}
        </div>
        <span className='text-muted-foreground text-xs'>
          {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
        </span>
      </div>
      <p className='mt-1.5 whitespace-pre-wrap text-sm'>{note.body}</p>
    </div>
  );
}

function TimelineItemCard({ item }: { item: TimelineItem }) {
  const data = item.data as Record<string, any>;

  const icon =
    item.type === 'note' ? (
      <IconNote className='h-4 w-4' />
    ) : item.type === 'email' ? (
      <IconMail className='h-4 w-4' />
    ) : (
      <IconActivity className='h-4 w-4' />
    );

  const title =
    item.type === 'note'
      ? 'Note'
      : item.type === 'email'
        ? data.subject || 'Email'
        : data.subject || 'Activity';

  const body =
    item.type === 'note'
      ? data.body
      : item.type === 'email'
        ? data.bodyPreview
        : data.note;

  return (
    <div className='flex gap-3 rounded-md border p-3'>
      <div className='text-muted-foreground mt-0.5'>{icon}</div>
      <div className='min-w-0 flex-1'>
        <div className='flex items-center justify-between gap-2'>
          <span className='text-sm font-medium'>{title}</span>
          <span className='text-muted-foreground shrink-0 text-xs'>
            {formatDistanceToNow(new Date(item.timestamp), {
              addSuffix: true
            })}
          </span>
        </div>
        {body && (
          <p className='text-muted-foreground mt-1 line-clamp-2 text-sm'>
            {body}
          </p>
        )}
        <Badge variant='outline' className='mt-1.5 text-xs capitalize'>
          {item.type}
        </Badge>
      </div>
    </div>
  );
}
