'use client';

import { useEffect, useRef, useState } from 'react';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  IconCalendar,
  IconPhone,
  IconMail,
  IconNotes,
  IconAlarm,
  IconToolsKitchen2,
  IconUsers,
  IconLink,
  IconBuilding,
  IconBriefcase,
  IconUser,
  IconX,
  IconLoader2,
  IconBell,
} from '@tabler/icons-react';
import { useCreateActivity, useUpdateActivity } from '../hooks/use-activities';
import { dealsApi, personsApi, organizationsApi, leadsApi } from '@/lib/api/crm-client';
import { BusyFlag } from '@prisma/client';
import type { ActivityWithRelations } from '@/lib/api/crm-types';

// ─── Constants ────────────────────────────────────────────────────────────────

const NONE = '__none__';

const ACTIVITY_TYPES = ['CALL', 'MEETING', 'TASK', 'EMAIL', 'DEADLINE', 'LUNCH'] as const;
type ActivityTypeValue = typeof ACTIVITY_TYPES[number];

interface TypeConfig {
  label: string;
  icon: typeof IconPhone;
  color: string;
  activeClass: string;
}

const TYPE_CONFIG: Record<ActivityTypeValue, TypeConfig> = {
  CALL:     { label: 'Call',     icon: IconPhone,           color: 'text-blue-600',   activeClass: 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
  MEETING:  { label: 'Meeting',  icon: IconUsers,            color: 'text-green-600',  activeClass: 'border-green-500 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300' },
  TASK:     { label: 'Task',     icon: IconNotes,            color: 'text-orange-600', activeClass: 'border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300' },
  EMAIL:    { label: 'Email',    icon: IconMail,             color: 'text-purple-600', activeClass: 'border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300' },
  DEADLINE: { label: 'Deadline', icon: IconAlarm,            color: 'text-red-600',    activeClass: 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300' },
  LUNCH:    { label: 'Lunch',    icon: IconToolsKitchen2,    color: 'text-yellow-600', activeClass: 'border-yellow-500 bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300' }
};

const DURATION_PRESETS = [
  { label: '15m', value: 15 },
  { label: '30m', value: 30 },
  { label: '1h',  value: 60 },
  { label: '2h',  value: 120 }
];

// ─── Schema ───────────────────────────────────────────────────────────────────

/** Reminder offset options relative to dueAt (in minutes). null = no reminder. */
const REMINDER_PRESETS = [
  { label: 'None',       value: null    },
  { label: '15 min',     value: 15      },
  { label: '30 min',     value: 30      },
  { label: '1 hour',     value: 60      },
  { label: '2 hours',    value: 120     },
  { label: '1 day',      value: 1440    },
  { label: '2 days',     value: 2880    },
] as const;

type ReminderPresetValue = (typeof REMINDER_PRESETS)[number]['value'];

const activityFormSchema = z.object({
  type:           z.enum(ACTIVITY_TYPES),
  subject:        z.string().min(1, 'Subject is required').max(200),
  dueAt:          z.date().optional(),
  hasTime:        z.boolean(),
  dueTime:        z.string().optional(),
  durationMin:    z.coerce.number().int().min(1).max(1440).optional(),
  busyFlag:       z.enum(['FREE', 'BUSY']),
  /** null = no reminder, number = minutes before dueAt */
  reminderOffset: z.number().nullable().optional(),
  dealId:         z.string().optional(),
  leadId:         z.string().optional(),
  personId:       z.string().optional(),
  orgId:          z.string().optional(),
  note:           z.string().optional()
});

type ActivityFormValues = z.infer<typeof activityFormSchema>;

// ─── Props ────────────────────────────────────────────────────────────────────

interface ActivityFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity?: ActivityWithRelations;
  defaultDealId?: string;
  defaultLeadId?: string;
  defaultPersonId?: string;
  defaultOrgId?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ActivityFormDialog({
  open,
  onOpenChange,
  activity,
  defaultDealId,
  defaultLeadId,
  defaultPersonId,
  defaultOrgId
}: ActivityFormDialogProps) {
  const [deals, setDeals]             = useState<{ id: string; title: string }[]>([]);
  const [leads, setLeads]             = useState<{ id: string; title: string }[]>([]);
  const [persons, setPersons]         = useState<{ id: string; firstName: string; lastName: string }[]>([]);
  const [organizations, setOrgs]      = useState<{ id: string; name: string }[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);

  const subjectRef = useRef<HTMLInputElement | null>(null);

  const createActivity = useCreateActivity();
  const updateActivity = useUpdateActivity();

  const form = useForm<ActivityFormValues, unknown, ActivityFormValues>({
    resolver: standardSchemaResolver(activityFormSchema) as any,
    defaultValues: buildDefaultValues(activity, { defaultDealId, defaultLeadId, defaultPersonId, defaultOrgId }),
    mode: 'onChange'
  });

  const hasTime        = form.watch('hasTime');
  const type           = form.watch('type');
  const dueAt          = form.watch('dueAt');
  const note           = form.watch('note') ?? '';
  const reminderOffset = form.watch('reminderOffset');

  // Reset + load on open
  useEffect(() => {
    if (!open) return;
    form.reset(buildDefaultValues(activity, { defaultDealId, defaultLeadId, defaultPersonId, defaultOrgId }));
    loadRelatedData();
    setTimeout(() => subjectRef.current?.focus(), 50);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activity?.id]);

  // Clear time fields when "All day" selected
  useEffect(() => {
    if (!open) return;
    if (!hasTime) {
      form.setValue('dueTime', undefined, { shouldDirty: false });
      form.setValue('durationMin', undefined, { shouldDirty: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasTime, open]);

  // Smart defaults by type (create mode only)
  useEffect(() => {
    if (!open || activity) return;
    const dirty = form.formState.dirtyFields as Partial<Record<keyof ActivityFormValues, boolean>>;
    const timed = type === 'CALL' || type === 'MEETING' || type === 'LUNCH';
    if (!dirty.hasTime)    form.setValue('hasTime',    timed,            { shouldDirty: false });
    if (!dirty.busyFlag)   form.setValue('busyFlag',   timed ? 'BUSY' : 'FREE', { shouldDirty: false });
    if (timed && !dirty.durationMin && !form.getValues('durationMin'))
      form.setValue('durationMin', 30, { shouldDirty: false });
    if (!timed && !dirty.durationMin)
      form.setValue('durationMin', undefined, { shouldDirty: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, open]);

  // Cmd+Enter submit
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (open && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        form.handleSubmit(onSubmit)();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const loadRelatedData = async () => {
    setLoadingRelated(true);
    try {
      const [dr, lr, pr, or_] = await Promise.all([
        dealsApi.list({ take: 50 }),
        leadsApi.list({ take: 50 }),
        personsApi.list({ take: 50 }),
        organizationsApi.list({ take: 50 })
      ]);
      setDeals(dr.data.deals ?? []);
      setLeads(lr.data.leads ?? []);
      setPersons(pr.data.persons ?? []);
      setOrgs(or_.data.organizations ?? []);
    } catch { /* non-blocking */ } finally {
      setLoadingRelated(false);
    }
  };

  const onSubmit = async (values: ActivityFormValues) => {
    let dueAt = values.dueAt;
    if (dueAt && values.hasTime && values.dueTime) {
      const [h, m] = values.dueTime.split(':').map(Number);
      dueAt = new Date(dueAt);
      dueAt.setHours(h, m, 0, 0);
    }

    // Compute remindAt from offset (minutes before dueAt), null = no reminder
    let remindAt: Date | null | undefined;
    if (dueAt && values.reminderOffset != null) {
      remindAt = new Date(dueAt.getTime() - values.reminderOffset * 60_000);
    } else if (values.reminderOffset === null) {
      remindAt = null; // explicitly disable
    }

    const payload = {
      type:        values.type,
      subject:     values.subject,
      dueAt,
      remindAt,
      hasTime:     values.hasTime,
      durationMin: values.durationMin || undefined,
      busyFlag:    values.busyFlag === 'BUSY' ? BusyFlag.BUSY : BusyFlag.FREE,
      dealId:      values.dealId || undefined,
      leadId:      values.leadId || undefined,
      personId:    values.personId || undefined,
      orgId:       values.orgId || undefined,
      note:        values.note || undefined
    };
    try {
      if (activity) await updateActivity.mutateAsync({ id: activity.id, data: payload });
      else          await createActivity.mutateAsync(payload);
      onOpenChange(false);
    } catch { /* handled by mutation hooks */ }
  };

  const isPending  = createActivity.isPending || updateActivity.isPending;
  const canSubmit  = form.formState.isValid && !isPending;
  const typeConfig = TYPE_CONFIG[type];
  const TypeIcon   = typeConfig.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='flex flex-col gap-0 p-0 sm:max-w-[580px] max-h-[92vh] overflow-hidden'>

        {/* ── Header ── */}
        <DialogHeader className='flex-row items-center gap-3 border-b px-6 py-4'>
          <div className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2',
            typeConfig.activeClass
          )}>
            <TypeIcon className='h-4 w-4' />
          </div>
          <DialogTitle className='text-base font-semibold'>
            {activity ? 'Edit Activity' : 'Schedule Activity'}
          </DialogTitle>
        </DialogHeader>

        {/* ── Scrollable body ── */}
        <div className='flex-1 overflow-y-auto'>
          <Form form={form} onSubmit={form.handleSubmit(onSubmit)}>
            <div className='space-y-0 divide-y divide-border'>

              {/* ─ Type picker + Subject ─ */}
              <div className='px-6 py-5 space-y-4'>
                {/* Type picker */}
                <FormField
                  control={form.control}
                  name='type'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className='text-xs font-medium text-muted-foreground uppercase tracking-wider'>
                        Activity type
                      </FormLabel>
                      <div className='grid grid-cols-6 gap-1.5 mt-1.5'>
                        {ACTIVITY_TYPES.map((t) => {
                          const cfg  = TYPE_CONFIG[t];
                          const Icon = cfg.icon;
                          const active = field.value === t;
                          return (
                            <button
                              key={t}
                              type='button'
                              onClick={() => field.onChange(t)}
                              className={cn(
                                'flex flex-col items-center gap-1 rounded-lg border-2 px-2 py-2 text-center transition-all',
                                'hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                active ? cfg.activeClass : 'border-transparent text-muted-foreground bg-muted/30'
                              )}
                            >
                              <Icon className={cn('h-4 w-4', active ? '' : 'opacity-60')} />
                              <span className='text-[10px] font-medium leading-none'>{cfg.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </FormItem>
                  )}
                />

                {/* Subject */}
                <FormField
                  control={form.control}
                  name='subject'
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <input
                          placeholder='Subject…'
                          className={cn(
                            'w-full bg-transparent text-lg font-medium placeholder:text-muted-foreground/50',
                            'border-0 outline-none ring-0 focus:ring-0 focus:outline-none',
                            'py-1 leading-snug'
                          )}
                          {...field}
                          ref={(el) => {
                            field.ref(el);
                            subjectRef.current = el;
                          }}
                        />
                      </FormControl>
                      <FormMessage className='text-xs' />
                    </FormItem>
                  )}
                />
              </div>

              {/* ─ When ─ */}
              <div className='px-6 py-5 space-y-3'>
                <p className='text-xs font-medium text-muted-foreground uppercase tracking-wider'>When</p>

                {/* Date + All day / Set time */}
                <div className='flex items-center gap-3'>
                  <FormField
                    control={form.control}
                    name='dueAt'
                    render={({ field }) => (
                      <FormItem className='flex-1'>
                        <div className='relative'>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant='outline'
                                  className={cn(
                                    'w-full justify-start text-left font-normal h-9',
                                    field.value ? 'pr-8' : '',
                                    !field.value && 'text-muted-foreground'
                                  )}
                                >
                                  <IconCalendar className='mr-2 h-4 w-4 shrink-0' />
                                  {field.value ? format(field.value, 'EEE, MMM d, yyyy') : 'Pick a date'}
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className='w-auto p-0' align='start'>
                              <Calendar mode='single' selected={field.value} onSelect={field.onChange} initialFocus />
                            </PopoverContent>
                          </Popover>
                          {field.value && (
                            <button
                              type='button'
                              onClick={(e) => { e.stopPropagation(); field.onChange(undefined); }}
                              className='absolute right-2 top-1/2 -translate-y-1/2 rounded hover:bg-muted p-0.5 text-muted-foreground hover:text-foreground'
                              aria-label='Clear date'
                            >
                              <IconX className='h-3 w-3' />
                            </button>
                          )}
                        </div>
                        <FormMessage className='text-xs' />
                      </FormItem>
                    )}
                  />

                  {/* All day / Set time toggle */}
                  <FormField
                    control={form.control}
                    name='hasTime'
                    render={({ field }) => (
                      <FormItem className='shrink-0'>
                        <div className='inline-flex h-9 items-center rounded-md border bg-muted p-0.5 text-muted-foreground'>
                          <button
                            type='button'
                            onClick={() => field.onChange(false)}
                            className={cn(
                              'inline-flex items-center rounded px-2.5 py-1.5 text-xs font-medium transition-all',
                              !field.value ? 'bg-background text-foreground shadow-sm' : 'hover:text-foreground'
                            )}
                          >
                            All day
                          </button>
                          <button
                            type='button'
                            onClick={() => field.onChange(true)}
                            className={cn(
                              'inline-flex items-center rounded px-2.5 py-1.5 text-xs font-medium transition-all',
                              field.value ? 'bg-background text-foreground shadow-sm' : 'hover:text-foreground'
                            )}
                          >
                            Set time
                          </button>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Time row — only when hasTime */}
                {hasTime && (
                  <div className='flex items-end gap-3'>
                    {/* Time input */}
                    <FormField
                      control={form.control}
                      name='dueTime'
                      render={({ field }) => (
                        <FormItem className='w-32'>
                          <FormLabel className='text-xs text-muted-foreground'>Start time</FormLabel>
                          <FormControl>
                            <Input type='time' className='h-9' {...field} value={field.value ?? ''} />
                          </FormControl>
                          <FormMessage className='text-xs' />
                        </FormItem>
                      )}
                    />

                    {/* Duration presets */}
                    <FormField
                      control={form.control}
                      name='durationMin'
                      render={({ field }) => (
                        <FormItem className='flex-1'>
                          <FormLabel className='text-xs text-muted-foreground'>Duration</FormLabel>
                          <div className='flex items-center gap-1.5'>
                            {DURATION_PRESETS.map((p) => (
                              <button
                                key={p.value}
                                type='button'
                                onClick={() => field.onChange(field.value === p.value ? undefined : p.value)}
                                className={cn(
                                  'h-9 rounded-md border px-3 text-sm font-medium transition-colors',
                                  field.value === p.value
                                    ? 'border-primary bg-primary text-primary-foreground'
                                    : 'border-input bg-background hover:bg-muted'
                                )}
                              >
                                {p.label}
                              </button>
                            ))}
                            <Input
                              type='number'
                              min={1}
                              max={1440}
                              placeholder='min'
                              className='h-9 w-16 text-sm'
                              value={
                                field.value && !DURATION_PRESETS.some(p => p.value === field.value)
                                  ? field.value
                                  : ''
                              }
                              onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                            />
                          </div>
                          <FormMessage className='text-xs' />
                        </FormItem>
                      )}
                    />

                    {/* Busy / Free */}
                    <FormField
                      control={form.control}
                      name='busyFlag'
                      render={({ field }) => (
                        <FormItem className='w-28 shrink-0'>
                          <FormLabel className='text-xs text-muted-foreground'>Calendar</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className='h-9 text-sm'>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value='FREE'>🟢 Free</SelectItem>
                              <SelectItem value='BUSY'>🔴 Busy</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </div>

              {/* ─ Reminder ─ (only when dueAt is set) */}
              {dueAt && (
                <div className='px-6 py-4'>
                  <FormField
                    control={form.control}
                    name='reminderOffset'
                    render={({ field }) => (
                      <FormItem>
                        <div className='flex items-center gap-3'>
                          <div className='flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider shrink-0'>
                            <IconBell className='h-3.5 w-3.5' />
                            Remind
                          </div>
                          <div className='flex flex-wrap gap-1.5'>
                            {REMINDER_PRESETS.map((preset) => {
                              const isActive = field.value === preset.value ||
                                (preset.value === null && field.value == null);
                              return (
                                <button
                                  key={String(preset.value)}
                                  type='button'
                                  onClick={() => field.onChange(preset.value)}
                                  className={cn(
                                    'h-7 rounded-md border px-2.5 text-xs font-medium transition-colors',
                                    isActive
                                      ? 'border-primary bg-primary text-primary-foreground'
                                      : 'border-input bg-background hover:bg-muted text-muted-foreground hover:text-foreground'
                                  )}
                                >
                                  {preset.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* ─ Link to ─ */}
              <div className='px-6 py-5 space-y-3'>
                <p className='text-xs font-medium text-muted-foreground uppercase tracking-wider'>Link to</p>
                <div className='grid grid-cols-2 gap-3'>
                  <LinkedEntitySelect
                    control={form.control}
                    name='dealId'
                    label='Deal'
                    icon={IconBriefcase}
                    options={deals.map(d => ({ value: d.id, label: d.title }))}
                    loading={loadingRelated}
                  />
                  <LinkedEntitySelect
                    control={form.control}
                    name='leadId'
                    label='Lead'
                    icon={IconLink}
                    options={leads.map(l => ({ value: l.id, label: l.title }))}
                    loading={loadingRelated}
                  />
                  <LinkedEntitySelect
                    control={form.control}
                    name='personId'
                    label='Person'
                    icon={IconUser}
                    options={persons.map(p => ({ value: p.id, label: `${p.firstName} ${p.lastName}`.trim() }))}
                    loading={loadingRelated}
                  />
                  <LinkedEntitySelect
                    control={form.control}
                    name='orgId'
                    label='Organization'
                    icon={IconBuilding}
                    options={organizations.map(o => ({ value: o.id, label: o.name }))}
                    loading={loadingRelated}
                  />
                </div>
              </div>

              {/* ─ Note ─ */}
              <div className='px-6 py-5 space-y-2'>
                <div className='flex items-center justify-between'>
                  <p className='text-xs font-medium text-muted-foreground uppercase tracking-wider'>
                    Note <span className='normal-case'>(private)</span>
                  </p>
                  {note.length > 0 && (
                    <span className='text-[11px] text-muted-foreground tabular-nums'>
                      {note.length}/500
                    </span>
                  )}
                </div>
                <FormField
                  control={form.control}
                  name='note'
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea
                          placeholder='Add a private note visible only to your team…'
                          rows={3}
                          maxLength={500}
                          className='resize-none text-sm'
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className='text-xs' />
                    </FormItem>
                  )}
                />
              </div>

            </div>
          </Form>
        </div>

        {/* ── Footer ── */}
        <DialogFooter className='flex-row items-center justify-between border-t px-6 py-4 gap-3'>
          <span className='hidden text-[11px] text-muted-foreground sm:block'>
            <kbd className='rounded border bg-muted px-1 py-0.5 font-mono text-[10px]'>⌘ Enter</kbd>
            {' '}to {activity ? 'update' : 'schedule'}
          </span>
          <div className='flex items-center gap-2 ml-auto'>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              size='sm'
              disabled={!canSubmit}
              onClick={form.handleSubmit(onSubmit)}
              className='min-w-[100px]'
            >
              {isPending
                ? <><IconLoader2 className='mr-2 h-3.5 w-3.5 animate-spin' /> Saving…</>
                : activity ? 'Update' : 'Schedule'
              }
            </Button>
          </div>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}

// ─── LinkedEntitySelect ───────────────────────────────────────────────────────

function LinkedEntitySelect({
  control,
  name,
  label,
  icon: Icon,
  options,
  loading
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: any;
  name: 'dealId' | 'leadId' | 'personId' | 'orgId';
  label: string;
  icon: typeof IconBriefcase;
  options: { value: string; label: string }[];
  loading: boolean;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }: { field: any }) => {
        const selected = options.find(o => o.value === field.value);
        return (
          <FormItem>
            <div className='flex h-9 items-center rounded-md border bg-background pr-2 transition-colors hover:border-ring focus-within:border-ring focus-within:ring-1 focus-within:ring-ring'>
              <div className='flex h-9 w-9 shrink-0 items-center justify-center text-muted-foreground'>
                <Icon className='h-3.5 w-3.5' />
              </div>
              <Select
                onValueChange={(val) => field.onChange(val === '__none__' ? undefined : val)}
                value={field.value ?? '__none__'}
                disabled={loading}
              >
                <FormControl>
                  <SelectTrigger className='h-auto border-0 p-0 shadow-none focus:ring-0 text-sm font-normal flex-1'>
                    <SelectValue placeholder={loading ? 'Loading…' : label}>
                      {selected ? (
                        <span className='truncate'>{selected.label}</span>
                      ) : (
                        <span className='text-muted-foreground'>{loading ? 'Loading…' : label}</span>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value='__none__'>
                    <span className='text-muted-foreground'>None</span>
                  </SelectItem>
                  {options.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {field.value && (
                <button
                  type='button'
                  onClick={() => field.onChange(undefined)}
                  className='ml-1 rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors'
                  aria-label={`Clear ${label}`}
                >
                  <IconX className='h-3 w-3' />
                </button>
              )}
            </div>
          </FormItem>
        );
      }}
    />
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Derive reminder offset (minutes) from existing remindAt + dueAt. */
function deriveReminderOffset(
  dueAt: Date | undefined,
  remindAt: string | Date | null | undefined
): number | null | undefined {
  if (!dueAt || remindAt == null) return remindAt === null ? null : undefined;
  const diff = dueAt.getTime() - new Date(remindAt).getTime();
  const minutes = Math.round(diff / 60_000);
  // Snap to nearest preset if close, otherwise return raw minutes
  const preset = REMINDER_PRESETS.find((p) => p.value !== null && Math.abs((p.value as number) - minutes) < 2);
  return preset?.value ?? minutes;
}

function buildDefaultValues(
  activity: ActivityWithRelations | undefined,
  defaults: {
    defaultDealId?: string;
    defaultLeadId?: string;
    defaultPersonId?: string;
    defaultOrgId?: string;
  }
): ActivityFormValues {
  if (activity) {
    const dueAt   = activity.dueAt ? new Date(activity.dueAt) : undefined;
    const dueTime = dueAt && activity.hasTime ? format(dueAt, 'HH:mm') : undefined;
    const remindAt = (activity as ActivityWithRelations & { remindAt?: string | null }).remindAt;
    return {
      type:           activity.type as ActivityTypeValue,
      subject:        activity.subject,
      dueAt,
      hasTime:        activity.hasTime ?? false,
      dueTime,
      durationMin:    activity.durationMin ?? undefined,
      busyFlag:       (activity.busyFlag ?? 'FREE') as 'FREE' | 'BUSY',
      reminderOffset: deriveReminderOffset(dueAt, remindAt),
      dealId:         activity.deal?.id ?? undefined,
      leadId:         (activity as ActivityWithRelations & { lead?: { id: string } | null }).lead?.id ?? undefined,
      personId:       activity.person?.id ?? undefined,
      orgId:          activity.organization?.id ?? undefined,
      note:           activity.note ?? undefined
    };
  }
  return {
    type:           'TASK',
    subject:        '',
    hasTime:        false,
    busyFlag:       'FREE',
    reminderOffset: 60, // default: 1 hour before
    dealId:         defaults.defaultDealId ?? undefined,
    leadId:         defaults.defaultLeadId ?? undefined,
    personId:       defaults.defaultPersonId ?? undefined,
    orgId:          defaults.defaultOrgId ?? undefined
  };
}
