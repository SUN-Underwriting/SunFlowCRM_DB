'use client';

import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { IconCalendar } from '@tabler/icons-react';
import { useCreateActivity, useUpdateActivity } from '../hooks/use-activities';
import { dealsApi, personsApi, organizationsApi } from '@/lib/api/crm-client';
import type { ActivityType } from '@prisma/client';
import type { ActivityWithRelations } from '@/lib/api/crm-types';

const activityFormSchema = z.object({
  type: z.enum(['CALL', 'EMAIL', 'MEETING', 'TASK']),
  subject: z.string().min(1, 'Subject is required'),
  dueAt: z.date().optional(),
  dealId: z.string().optional(),
  personId: z.string().optional(),
  organizationId: z.string().optional(),
  note: z.string().optional()
});

type ActivityFormValues = z.infer<typeof activityFormSchema>;

interface ActivityFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity?: ActivityWithRelations;
}

/**
 * Activity Form Dialog
 * Best Practice (Context7): Reusable form for create/edit operations
 */
export function ActivityFormDialog({
  open,
  onOpenChange,
  activity
}: ActivityFormDialogProps) {
  const [deals, setDeals] = useState<any[]>([]);
  const [persons, setPersons] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);

  const createActivity = useCreateActivity();
  const updateActivity = useUpdateActivity();

  const form = useForm<ActivityFormValues>({
    resolver: zodResolver(activityFormSchema),
    defaultValues: {
      type: activity?.type || 'TASK',
      subject: activity?.subject || '',
      dueAt: activity?.dueAt ? new Date(activity.dueAt) : undefined,
      dealId: activity?.deal?.id || undefined,
      personId: activity?.person?.id || undefined,
      organizationId: activity?.organization?.id || undefined,
      note: activity?.note || ''
    }
  });

  useEffect(() => {
    if (open) {
      loadRelatedData();
      if (activity) {
        form.reset({
          type: activity.type,
          subject: activity.subject,
          dueAt: activity.dueAt ? new Date(activity.dueAt) : undefined,
          dealId: activity.deal?.id || undefined,
          personId: activity.person?.id || undefined,
          organizationId: activity.organization?.id || undefined,
          note: activity.note || ''
        });
      }
    }
  }, [open, activity]);

  const loadRelatedData = async () => {
    try {
      setLoadingRelated(true);
      const [dealsRes, personsRes, orgsRes] = await Promise.all([
        dealsApi.list({ take: 50 }),
        personsApi.list({ take: 50 }),
        organizationsApi.list({ take: 50 })
      ]);
      setDeals(dealsRes.data.deals || []);
      setPersons(personsRes.data.persons || []);
      setOrganizations(orgsRes.data.organizations || []);
    } catch (error) {
      console.error('Failed to load related data:', error);
    } finally {
      setLoadingRelated(false);
    }
  };

  const onSubmit = async (values: ActivityFormValues) => {
    try {
      if (activity) {
        await updateActivity.mutateAsync({ id: activity.id, data: values });
      } else {
        await createActivity.mutateAsync(values);
      }
      form.reset();
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation hooks
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[600px]'>
        <DialogHeader>
          <DialogTitle>
            {activity ? 'Edit Activity' : 'Create New Activity'}
          </DialogTitle>
          <DialogDescription>
            {activity
              ? 'Update the activity details below.'
              : 'Schedule a new activity for your CRM.'}
          </DialogDescription>
        </DialogHeader>

        <Form
          form={form}
          onSubmit={form.handleSubmit(onSubmit)}
          className='space-y-4'
        >
          <div className='grid grid-cols-2 gap-4'>
            <FormField
              control={form.control}
              name='type'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder='Select type' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value='CALL'>Call</SelectItem>
                      <SelectItem value='EMAIL'>Email</SelectItem>
                      <SelectItem value='MEETING'>Meeting</SelectItem>
                      <SelectItem value='TASK'>Task</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='dueAt'
              render={({ field }) => (
                <FormItem className='flex flex-col'>
                  <FormLabel>Due Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant='outline'
                          className={cn(
                            'w-full pl-3 text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          {field.value ? (
                            format(field.value, 'PPP')
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <IconCalendar className='ml-auto h-4 w-4 opacity-50' />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className='w-auto p-0' align='start'>
                      <Calendar
                        mode='single'
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name='subject'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Subject *</FormLabel>
                <FormControl>
                  <Input
                    placeholder='e.g., Follow-up call with client'
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='dealId'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Related Deal</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                  disabled={loadingRelated}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder='Select deal' />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {deals.map((deal) => (
                      <SelectItem key={deal.id} value={deal.id}>
                        {deal.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className='grid grid-cols-2 gap-4'>
            <FormField
              control={form.control}
              name='personId'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Related Person</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={loadingRelated}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder='Select person' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {persons.map((person) => (
                        <SelectItem key={person.id} value={person.id}>
                          {person.firstName} {person.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='organizationId'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Related Organization</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={loadingRelated}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder='Select organization' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {organizations.map((org) => (
                        <SelectItem key={org.id} value={org.id}>
                          {org.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name='note'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder='Add any additional notes...'
                    rows={4}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className='flex justify-end gap-3 pt-4'>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type='submit'
              disabled={createActivity.isPending || updateActivity.isPending}
            >
              {createActivity.isPending || updateActivity.isPending
                ? 'Saving...'
                : activity
                  ? 'Update Activity'
                  : 'Create Activity'}
            </Button>
          </div>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
