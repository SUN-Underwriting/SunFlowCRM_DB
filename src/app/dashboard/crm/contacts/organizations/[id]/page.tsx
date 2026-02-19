'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';
import {
  IconArrowLeft,
  IconBuilding,
  IconWorld,
  IconPhone,
  IconMapPin,
  IconUsers,
  IconBriefcase,
  IconActivity,
  IconMail,
  IconEdit,
  IconTimeline,
  IconNote,
  IconCalendar,
  IconChevronDown,
  IconLink,
  IconPlus,
  IconExternalLink,
  IconClock,
  IconDots,
  IconCopy,
  IconTrash
} from '@tabler/icons-react';
import { useOrganization, useDeleteOrganization } from '@/features/crm/contacts/hooks/use-organizations';
import { OrganizationFormDialog } from '@/features/crm/contacts/components/organization-form-dialog';
import { PersonFormDialog } from '@/features/crm/contacts/components/person-form-dialog';
import { LinkExistingContactDialog } from '@/features/crm/contacts/components/link-existing-contact-dialog';
import { ActivityFormDialog } from '@/features/crm/activities/components/activity-form-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { useQuery } from '@tanstack/react-query';
import { organizationsApi } from '@/lib/api/crm-client';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';

interface OrganizationDetailPageProps {
  params: Promise<{ id: string }>;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function getAvatarColor(name: string): string {
  const colors = [
    'bg-blue-500',
    'bg-emerald-500',
    'bg-violet-500',
    'bg-amber-500',
    'bg-rose-500',
    'bg-cyan-500',
    'bg-indigo-500',
    'bg-teal-500'
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

const timelineIconMap: Record<string, { icon: typeof IconNote; color: string; bg: string }> = {
  note: { icon: IconNote, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  activity: { icon: IconCalendar, color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
  email: { icon: IconMail, color: 'text-violet-600', bg: 'bg-violet-100 dark:bg-violet-900/30' }
};

function pluralize(count: number, singular: string, plural?: string) {
  return count === 1 ? `1 ${singular}` : `${count} ${plural ?? singular + 's'}`;
}

export default function OrganizationDetailPage({
  params
}: OrganizationDetailPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addPersonDialogOpen, setAddPersonDialogOpen] = useState(false);
  const [linkPersonDialogOpen, setLinkPersonDialogOpen] = useState(false);
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const { data: organization, isLoading, error } = useOrganization(id);
  const deleteOrg = useDeleteOrganization();

  const { data: timelineData } = useQuery({
    queryKey: ['organization-timeline', id],
    queryFn: async () => {
      const response = await organizationsApi.getTimeline(id, { take: 20 });
      return response.data;
    },
    enabled: !!id
  });

  const handleDelete = () => {
    deleteOrg.mutate(id, {
      onSuccess: () => {
        router.push('/dashboard/crm/contacts/organizations');
      }
    });
  };

  const handleCopyField = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  };

  if (isLoading) {
    return (
      <div className='flex-1 space-y-6 p-4 pt-6 md:p-8'>
        <div className='flex items-center gap-4'>
          <div className='h-14 w-14 animate-pulse rounded-xl bg-muted' />
          <div className='space-y-2'>
            <div className='h-7 w-48 animate-pulse rounded bg-muted' />
            <div className='h-4 w-32 animate-pulse rounded bg-muted' />
          </div>
        </div>
        <div className='grid gap-6 md:grid-cols-3'>
          <div className='md:col-span-2 h-96 animate-pulse rounded-lg bg-muted' />
          <div className='h-96 animate-pulse rounded-lg bg-muted' />
        </div>
      </div>
    );
  }

  if (error || !organization) {
    return (
      <div className='flex flex-1 items-center justify-center p-8'>
        <div className='text-center space-y-4'>
          <div className='mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted'>
            <IconBuilding className='h-8 w-8 text-muted-foreground' />
          </div>
          <div>
            <h2 className='text-xl font-semibold'>Organization not found</h2>
            <p className='text-muted-foreground mt-1 text-sm'>
              This organization doesn&apos;t exist or has been deleted.
            </p>
          </div>
          <Button
            variant='outline'
            onClick={() => router.push('/dashboard/crm/contacts/organizations')}
          >
            <IconArrowLeft className='mr-2 h-4 w-4' />
            Back to Organizations
          </Button>
        </div>
      </div>
    );
  }

  const contactsCount = organization._count?.persons || 0;
  const dealsCount = organization._count?.deals || 0;
  const activitiesCount = organization._count?.activities || 0;
  const emailsCount = organization._count?.emails || 0;

  const hasDetails = !!(
    organization.website ||
    organization.domain ||
    organization.phone ||
    organization.address ||
    organization.city ||
    organization.countryCode ||
    organization.industry ||
    organization.size
  );

  return (
    <div className='flex h-full flex-col gap-6 p-4 pt-6 md:p-8'>
      {/* ═══ Header ═══ */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
        <div className='flex items-start gap-4'>
          <Button
            variant='ghost'
            size='icon'
            className='mt-1 shrink-0'
            onClick={() => router.push('/dashboard/crm/contacts/organizations')}
          >
            <IconArrowLeft className='h-4 w-4' />
          </Button>

          <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-xl font-bold text-white ${getAvatarColor(organization.name)}`}>
            {getInitials(organization.name)}
          </div>

          <div className='min-w-0'>
            <div className='flex items-center gap-2 flex-wrap'>
              <h1 className='text-2xl font-bold tracking-tight truncate'>
                {organization.name}
              </h1>
              {organization.industry && (
                <Badge variant='secondary'>{organization.industry}</Badge>
              )}
            </div>

            <div className='mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground'>
              {organization.domain && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        className='flex items-center gap-1 hover:text-foreground transition-colors'
                        onClick={() => handleCopyField(organization.domain!, 'Domain')}
                      >
                        <IconWorld className='h-3.5 w-3.5' />
                        {organization.domain}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Click to copy</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {(organization.city || organization.countryCode) && (
                <span className='flex items-center gap-1'>
                  <IconMapPin className='h-3.5 w-3.5' />
                  {[organization.city, organization.countryCode].filter(Boolean).join(', ')}
                </span>
              )}
              {organization.size && (
                <span className='flex items-center gap-1'>
                  <IconUsers className='h-3.5 w-3.5' />
                  {organization.size} employees
                </span>
              )}
              {organization.phone && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        className='flex items-center gap-1 hover:text-foreground transition-colors'
                        onClick={() => handleCopyField(organization.phone!, 'Phone')}
                      >
                        <IconPhone className='h-3.5 w-3.5' />
                        {organization.phone}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Click to copy</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
        </div>

        <div className='flex items-center gap-2 sm:shrink-0'>
          <Button variant='outline' size='sm' onClick={() => setActivityDialogOpen(true)}>
            <IconCalendar className='mr-2 h-4 w-4' />
            Schedule
          </Button>
          <Button size='sm' onClick={() => setEditDialogOpen(true)}>
            <IconEdit className='mr-2 h-4 w-4' />
            Edit
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='ghost' size='icon' className='h-8 w-8'>
                <IconDots className='h-4 w-4' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <DropdownMenuItem onClick={() => handleCopyField(organization.id, 'Organization ID')}>
                <IconCopy className='mr-2 h-4 w-4' /> Copy ID
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className='text-destructive focus:text-destructive'
                onClick={() => setDeleteConfirmOpen(true)}
              >
                <IconTrash className='mr-2 h-4 w-4' /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ═══ Main grid ═══ */}
      <div className='grid flex-1 gap-6 md:grid-cols-[1fr_280px] items-start'>
        {/* ─── Main content (tabs) ─── */}
        <Tabs defaultValue='contacts' className='space-y-4'>
          <TabsList>
            <TabsTrigger value='contacts' className='gap-1.5'>
              <IconUsers className='h-3.5 w-3.5' />
              Contacts
              {contactsCount > 0 && (
                <Badge variant='secondary' className='ml-1 h-5 min-w-5 px-1.5 text-xs'>
                  {contactsCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value='deals' className='gap-1.5'>
              <IconBriefcase className='h-3.5 w-3.5' />
              Deals
              {dealsCount > 0 && (
                <Badge variant='secondary' className='ml-1 h-5 min-w-5 px-1.5 text-xs'>
                  {dealsCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value='activities' className='gap-1.5'>
              <IconActivity className='h-3.5 w-3.5' />
              Activities
              {activitiesCount > 0 && (
                <Badge variant='secondary' className='ml-1 h-5 min-w-5 px-1.5 text-xs'>
                  {activitiesCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value='timeline' className='gap-1.5'>
              <IconTimeline className='h-3.5 w-3.5' />
              Timeline
            </TabsTrigger>
          </TabsList>

          {/* ─── Contacts Tab ─── */}
          <TabsContent value='contacts' className='space-y-4'>
            <div className='flex items-center justify-between'>
              <p className='text-sm text-muted-foreground'>
                {pluralize(contactsCount, 'contact')} linked
              </p>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size='sm'>
                    <IconPlus className='mr-2 h-4 w-4' />
                    Add Contact
                    <IconChevronDown className='ml-1 h-3 w-3' />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end'>
                  <DropdownMenuItem onClick={() => setAddPersonDialogOpen(true)}>
                    <IconPlus className='mr-2 h-4 w-4' />
                    Create New Contact
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLinkPersonDialogOpen(true)}>
                    <IconLink className='mr-2 h-4 w-4' />
                    Link Existing Contact
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {organization.persons && organization.persons.length > 0 ? (
              <div className='space-y-2'>
                {organization.persons.map((person) => (
                  <Card
                    key={person.id}
                    className='transition-colors hover:bg-accent/50 cursor-pointer'
                    onClick={() => router.push(`/dashboard/crm/contacts/persons/${person.id}`)}
                  >
                    <CardContent className='flex items-center gap-4 px-4 py-3'>
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-medium text-white ${getAvatarColor(person.firstName + person.lastName)}`}>
                        {(person.firstName?.[0] || '') + (person.lastName?.[0] || '')}
                      </div>
                      <div className='min-w-0 flex-1'>
                        <p className='font-medium text-sm truncate'>
                          {person.firstName} {person.lastName}
                        </p>
                        {person.jobTitle && (
                          <p className='text-xs text-muted-foreground truncate'>
                            {person.jobTitle}
                          </p>
                        )}
                      </div>
                      <div className='hidden sm:flex items-center gap-4 text-sm text-muted-foreground'>
                        {person.email && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className='flex items-center gap-1 truncate max-w-[200px]'>
                                  <IconMail className='h-3.5 w-3.5 shrink-0' />
                                  {person.email}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>{person.email}</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {person.phone && (
                          <span className='flex items-center gap-1'>
                            <IconPhone className='h-3.5 w-3.5 shrink-0' />
                            {person.phone}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyTabState
                icon={IconUsers}
                title='No contacts yet'
                description='Add contacts to this organization to track your relationships.'
                actions={
                  <div className='flex gap-2'>
                    <Button size='sm' variant='outline' onClick={() => setLinkPersonDialogOpen(true)}>
                      <IconLink className='mr-2 h-4 w-4' />
                      Link Existing
                    </Button>
                    <Button size='sm' onClick={() => setAddPersonDialogOpen(true)}>
                      <IconPlus className='mr-2 h-4 w-4' />
                      Create New
                    </Button>
                  </div>
                }
              />
            )}
          </TabsContent>

          {/* ─── Deals Tab ─── */}
          <TabsContent value='deals' className='space-y-4'>
            <div className='flex items-center justify-between'>
              <p className='text-sm text-muted-foreground'>
                {pluralize(dealsCount, 'deal')}
              </p>
            </div>

            {organization.deals && organization.deals.length > 0 ? (
              <div className='space-y-2'>
                {organization.deals.map((deal) => (
                  <Card key={deal.id} className='transition-colors hover:bg-accent/50 cursor-pointer'>
                    <CardContent className='flex items-center justify-between px-4 py-3'>
                      <div className='flex items-center gap-3 min-w-0'>
                        <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted'>
                          <IconBriefcase className='h-4 w-4 text-muted-foreground' />
                        </div>
                        <div className='min-w-0'>
                          <p className='font-medium text-sm truncate'>{deal.title}</p>
                          <div className='flex items-center gap-2 mt-0.5'>
                            {deal.stage?.name && (
                              <span className='text-xs text-muted-foreground'>
                                {deal.pipeline?.name && `${deal.pipeline.name} · `}{deal.stage.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className='flex items-center gap-3 shrink-0'>
                        <span className='font-semibold text-sm'>
                          {deal.currency} {Number(deal.value || 0).toLocaleString()}
                        </span>
                        <Badge
                          variant={
                            deal.status === 'WON'
                              ? 'default'
                              : deal.status === 'LOST'
                                ? 'destructive'
                                : 'secondary'
                          }
                          className='text-xs'
                        >
                          {deal.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyTabState
                icon={IconBriefcase}
                title='No deals yet'
                description='Deals with this organization will appear here.'
              />
            )}
          </TabsContent>

          {/* ─── Activities Tab ─── */}
          <TabsContent value='activities' className='space-y-4'>
            <EmptyTabState
              icon={IconActivity}
              title='No activities yet'
              description='Schedule calls, meetings, and tasks related to this organization.'
              actions={
                <Button size='sm' onClick={() => setActivityDialogOpen(true)}>
                  <IconCalendar className='mr-2 h-4 w-4' />
                  Schedule Activity
                </Button>
              }
            />
          </TabsContent>

          {/* ─── Timeline Tab ─── */}
          <TabsContent value='timeline' className='space-y-4'>
            {timelineData && timelineData.items.length > 0 ? (
              <div className='relative'>
                <div className='absolute left-[19px] top-2 bottom-2 w-px bg-border' />

                <div className='space-y-0'>
                  {timelineData.items.map((item) => {
                    const config = timelineIconMap[item.type] || timelineIconMap.note;
                    const TimelineIcon = config.icon;

                    return (
                      <div key={item.id} className='relative flex gap-4 pb-6 last:pb-0'>
                        <div className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${config.bg}`}>
                          <TimelineIcon className={`h-4 w-4 ${config.color}`} />
                        </div>

                        <div className='flex-1 pt-1'>
                          <div className='flex items-center gap-2 flex-wrap'>
                            <Badge variant='outline' className='text-xs font-normal capitalize'>
                              {item.type}
                            </Badge>
                            <span className='text-xs text-muted-foreground'>
                              {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                            </span>
                          </div>
                          <Card className='mt-2'>
                            <CardContent className='px-4 py-3'>
                              {item.type === 'note' && (
                                <p className='text-sm whitespace-pre-wrap'>
                                  {(item.data as Record<string, string>).body}
                                </p>
                              )}
                              {item.type === 'activity' && (
                                <div>
                                  <p className='font-medium text-sm'>
                                    {(item.data as Record<string, string>).subject}
                                  </p>
                                  {(item.data as Record<string, string>).note && (
                                    <p className='text-muted-foreground text-sm mt-1'>
                                      {(item.data as Record<string, string>).note}
                                    </p>
                                  )}
                                </div>
                              )}
                              {item.type === 'email' && (
                                <div>
                                  <p className='font-medium text-sm'>
                                    {(item.data as Record<string, string>).subject}
                                  </p>
                                  <p className='text-muted-foreground text-xs mt-1'>
                                    {(item.data as Record<string, string>).direction === 'INCOMING' ? 'From' : 'To'}{' '}
                                    {(item.data as Record<string, string>).direction === 'INCOMING'
                                      ? (item.data as Record<string, string>).from
                                      : (item.data as Record<string, string>).to}
                                  </p>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <EmptyTabState
                icon={IconTimeline}
                title='No timeline events yet'
                description='Notes, activities, and emails will appear here chronologically.'
              />
            )}
          </TabsContent>
        </Tabs>

        {/* ─── Sidebar ─── */}
        <div className='space-y-4 md:sticky md:top-20'>
          {/* Quick Stats */}
          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm font-medium'>Summary</CardTitle>
            </CardHeader>
            <CardContent className='grid grid-cols-2 gap-3'>
              <StatItem icon={IconUsers} label='Contacts' value={contactsCount} />
              <StatItem icon={IconBriefcase} label='Deals' value={dealsCount} />
              <StatItem icon={IconActivity} label='Activities' value={activitiesCount} />
              <StatItem icon={IconMail} label='Emails' value={emailsCount} />
            </CardContent>
          </Card>

          {/* Details */}
          <Card>
            <CardHeader className='pb-2 flex-row items-center justify-between space-y-0'>
              <CardTitle className='text-sm font-medium'>Details</CardTitle>
              <Button
                variant='ghost'
                size='sm'
                className='h-7 px-2 text-xs text-muted-foreground'
                onClick={() => setEditDialogOpen(true)}
              >
                <IconEdit className='mr-1 h-3 w-3' />
                Edit
              </Button>
            </CardHeader>
            <CardContent className='space-y-3'>
              {hasDetails ? (
                <>
                  {organization.website && (
                    <DetailRow
                      icon={IconWorld}
                      label='Website'
                      value={
                        <a
                          href={organization.website.startsWith('http') ? organization.website : `https://${organization.website}`}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='text-primary hover:underline inline-flex items-center gap-1'
                        >
                          {organization.website.replace(/^https?:\/\//, '')}
                          <IconExternalLink className='h-3 w-3' />
                        </a>
                      }
                    />
                  )}

                  {organization.domain && (
                    <DetailRow
                      icon={IconMail}
                      label='Email Domain'
                      value={organization.domain}
                      copyable
                      onCopy={() => handleCopyField(organization.domain!, 'Domain')}
                    />
                  )}

                  {organization.phone && (
                    <DetailRow
                      icon={IconPhone}
                      label='Phone'
                      value={organization.phone}
                      copyable
                      onCopy={() => handleCopyField(organization.phone!, 'Phone')}
                    />
                  )}

                  {organization.address && (
                    <DetailRow
                      icon={IconMapPin}
                      label='Address'
                      value={organization.address}
                    />
                  )}

                  {(organization.city || organization.countryCode) && !organization.address && (
                    <DetailRow
                      icon={IconMapPin}
                      label='Location'
                      value={[organization.city, organization.countryCode].filter(Boolean).join(', ')}
                    />
                  )}

                  {organization.industry && (
                    <DetailRow
                      icon={IconBuilding}
                      label='Industry'
                      value={organization.industry}
                    />
                  )}

                  {organization.size && (
                    <DetailRow
                      icon={IconUsers}
                      label='Company Size'
                      value={`${organization.size} employees`}
                    />
                  )}
                </>
              ) : (
                <div className='py-4 text-center'>
                  <p className='text-xs text-muted-foreground'>
                    No details added yet.
                  </p>
                  <Button
                    variant='link'
                    size='sm'
                    className='mt-1 h-auto p-0 text-xs'
                    onClick={() => setEditDialogOpen(true)}
                  >
                    Add details
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Record Info */}
          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm font-medium'>Record Info</CardTitle>
            </CardHeader>
            <CardContent className='space-y-2'>
              <div className='flex items-center justify-between text-sm'>
                <span className='text-muted-foreground'>Created</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className='flex items-center gap-1 text-muted-foreground text-xs'>
                        <IconClock className='h-3 w-3' />
                        {formatDistanceToNow(new Date(organization.createdAt), { addSuffix: true })}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {format(new Date(organization.createdAt), 'PPpp')}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Separator />
              <div className='flex items-center justify-between text-sm'>
                <span className='text-muted-foreground'>Updated</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className='flex items-center gap-1 text-muted-foreground text-xs'>
                        <IconClock className='h-3 w-3' />
                        {formatDistanceToNow(new Date(organization.updatedAt), { addSuffix: true })}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {format(new Date(organization.updatedAt), 'PPpp')}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ═══ Dialogs ═══ */}
      <OrganizationFormDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        organization={organization}
      />

      <PersonFormDialog
        open={addPersonDialogOpen}
        onOpenChange={setAddPersonDialogOpen}
        defaultOrgId={id}
      />

      <LinkExistingContactDialog
        open={linkPersonDialogOpen}
        onOpenChange={setLinkPersonDialogOpen}
        organizationId={id}
      />

      <ActivityFormDialog
        open={activityDialogOpen}
        onOpenChange={setActivityDialogOpen}
        defaultOrgId={id}
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {organization.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The organization and all its data will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
              disabled={deleteOrg.isPending}
            >
              {deleteOrg.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ═══ Helper Components ═══ */

function StatItem({
  icon: Icon,
  label,
  value
}: {
  icon: typeof IconUsers;
  label: string;
  value: number;
}) {
  return (
    <div className='flex items-center gap-2.5 rounded-lg border p-2.5'>
      <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted'>
        <Icon className='h-3.5 w-3.5 text-muted-foreground' />
      </div>
      <div className='min-w-0'>
        <p className='text-lg font-bold leading-none'>{value}</p>
        <p className='text-[11px] text-muted-foreground mt-0.5 truncate'>{label}</p>
      </div>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
  copyable,
  onCopy
}: {
  icon: typeof IconWorld;
  label: string;
  value: React.ReactNode;
  copyable?: boolean;
  onCopy?: () => void;
}) {
  return (
    <div className='group flex items-start gap-3'>
      <div className='flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted'>
        <Icon className='h-3.5 w-3.5 text-muted-foreground' />
      </div>
      <div className='min-w-0 flex-1'>
        <p className='text-[11px] text-muted-foreground leading-none'>{label}</p>
        <div className='text-sm mt-0.5 break-words flex items-center gap-1'>
          {value}
          {copyable && onCopy && (
            <button
              onClick={onCopy}
              className='opacity-0 group-hover:opacity-100 transition-opacity'
              aria-label={`Copy ${label}`}
            >
              <IconCopy className='h-3 w-3 text-muted-foreground hover:text-foreground' />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyTabState({
  icon: Icon,
  title,
  description,
  actions
}: {
  icon: typeof IconUsers;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
        <div className='flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3'>
          <Icon className='h-6 w-6 text-muted-foreground' />
        </div>
        <p className='font-medium text-sm'>{title}</p>
        <p className='text-muted-foreground text-xs mt-1 max-w-[260px]'>
          {description}
        </p>
        {actions && <div className='mt-4'>{actions}</div>}
      </CardContent>
    </Card>
  );
}
