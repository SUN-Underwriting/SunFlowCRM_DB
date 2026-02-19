'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, FormProvider } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { MaskInput } from '@/components/ui/mask-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useEffect, useState } from 'react';
import { personsApi, organizationsApi } from '@/lib/api/crm-client';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { DatePicker } from '@/components/ui/date-picker';

const leadFormSchema = z
  .object({
    title: z.string().min(1, 'Title is required').max(200),
    description: z.string().optional(),
    source: z.string().optional(),
    valueAmount: z.number().optional(),
    valueCurrency: z.string().optional(),
    expectedCloseDate: z.date().optional(),
    personId: z.string().optional(),
    orgId: z.string().optional(),
    // Advanced (optional)
    origin: z.string().optional(),
    inboxChannel: z.string().optional(),
    externalSourceId: z.string().optional()
  })
  .refine((data) => !!data.personId || !!data.orgId, {
    message: 'Select a person or an organization',
    path: ['personId']
  })
  .refine((data) => !!data.personId || !!data.orgId, {
    message: 'Select a person or an organization',
    path: ['orgId']
  });

export type LeadFormValues = z.infer<typeof leadFormSchema>;

interface LeadFormProps {
  defaultValues?: Partial<LeadFormValues>;
  onSubmit: (values: LeadFormValues) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function LeadForm({
  defaultValues,
  onSubmit,
  onCancel,
  isLoading
}: LeadFormProps) {
  const [persons, setPersons] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(false);
  const [loadingOrgs, setLoadingOrgs] = useState(false);

  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      title: '',
      description: '',
      source: '',
      valueAmount: undefined,
      valueCurrency: 'CHF',
      ...defaultValues
    }
  });

  useEffect(() => {
    // Load persons and organizations for dropdowns
    setLoadingPeople(true);
    personsApi
      .list({ take: 100 })
      .then((res) => setPersons(res.data.persons || []))
      .finally(() => setLoadingPeople(false));

    setLoadingOrgs(true);
    organizationsApi
      .list({ take: 100 })
      .then((res) => setOrgs(res.data.organizations || []))
      .finally(() => setLoadingOrgs(false));
  }, []);

  return (
    <FormProvider {...form}>
      <form
        onSubmit={form.handleSubmit(async (values) => {
          // Normalize empty strings from selects/inputs
          const normalized: LeadFormValues = {
            ...values,
            personId: values.personId || undefined,
            orgId: values.orgId || undefined,
            source: values.source || undefined,
            origin: values.origin || undefined,
            inboxChannel: values.inboxChannel || undefined,
            externalSourceId: values.externalSourceId || undefined,
            valueCurrency: values.valueCurrency || undefined
          };
          await onSubmit(normalized);
        })}
        className='space-y-6'
      >
        <div className='space-y-2'>
          <FormField
            control={form.control}
            name='title'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title *</FormLabel>
                <FormControl>
                  <Input
                    placeholder='e.g., Enterprise Software Deal'
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className='rounded-lg border bg-muted/30 p-4'>
          <div className='mb-3'>
            <div className='text-sm font-medium'>Contact</div>
            <div className='text-muted-foreground text-xs'>
              Choose a person and/or organization (at least one required).
            </div>
          </div>
          <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
            <FormField
              control={form.control}
              name='personId'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Person</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      // Auto-fill organization if the selected person is linked to one
                      const selectedPerson = persons.find((p) => p.id === value);
                      if (selectedPerson?.organization?.id) {
                        const currentOrgId = form.getValues('orgId');
                        if (!currentOrgId) {
                          form.setValue('orgId', selectedPerson.organization.id, {
                            shouldValidate: true
                          });
                        }
                      }
                    }}
                    value={field.value ?? ''}
                    disabled={loadingPeople}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            loadingPeople ? 'Loading...' : 'Select person'
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {persons.length === 0 ? (
                        <SelectItem value='__none__' disabled>
                          No persons found
                        </SelectItem>
                      ) : (
                        persons.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.firstName} {p.lastName}
                            {p.email ? ` — ${p.email}` : ''}
                            {p.organization ? ` (${p.organization.name})` : ''}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='orgId'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ?? ''}
                    disabled={loadingOrgs}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            loadingOrgs ? 'Loading...' : 'Select organization'
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {orgs.length === 0 ? (
                        <SelectItem value='__none__' disabled>
                          No organizations found
                        </SelectItem>
                      ) : (
                        orgs.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {persons.length === 0 &&
            orgs.length === 0 &&
            !loadingPeople &&
            !loadingOrgs && (
              <Alert className='mt-4'>
                <AlertTitle>No contacts yet</AlertTitle>
                <AlertDescription>
                  <p>
                    Leads must be linked to at least a person or an organization.
                  </p>
                  <div className='flex gap-3 pt-1'>
                    <Button asChild variant='link' className='h-auto p-0'>
                      <Link href='/dashboard/crm/persons'>Create a person</Link>
                    </Button>
                    <Button asChild variant='link' className='h-auto p-0'>
                      <Link href='/dashboard/crm/organizations'>
                        Create an organization
                      </Link>
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}
        </div>

        <div className='rounded-lg border p-4'>
          <div className='mb-3'>
            <div className='text-sm font-medium'>Deal details</div>
            <div className='text-muted-foreground text-xs'>
              Optional context for prioritization and forecasting.
            </div>
          </div>

          <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
            <FormField
              control={form.control}
              name='source'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Source</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ?? ''}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder='Select source' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value='WEBSITE'>Website</SelectItem>
                      <SelectItem value='REFERRAL'>Referral</SelectItem>
                      <SelectItem value='COLD_CALL'>Cold Call</SelectItem>
                      <SelectItem value='SOCIAL_MEDIA'>Social Media</SelectItem>
                      <SelectItem value='EVENT'>Event</SelectItem>
                      <SelectItem value='PARTNER'>Partner</SelectItem>
                      <SelectItem value='OTHER'>Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='expectedCloseDate'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expected close</FormLabel>
                  <FormControl>
                    <DatePicker
                      value={field.value}
                      onChange={field.onChange}
                      placeholder='Pick expected close date'
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className='mt-4 grid grid-cols-1 items-start gap-4 md:grid-cols-2'>
            <FormField
              control={form.control}
              name='valueAmount'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estimated value</FormLabel>
                  <FormControl>
                    <MaskInput
                      mask='currency'
                      currency={form.watch('valueCurrency') || 'CHF'}
                      placeholder='CHF 0.00'
                      value={
                        field.value != null ? String(field.value) : ''
                      }
                      onValueChange={(_masked, unmasked) => {
                        const num = unmasked === '' ? undefined : parseFloat(unmasked);
                        field.onChange(num != null && Number.isNaN(num) ? undefined : num);
                      }}
                    />
                  </FormControl>
                  <FormDescription>Amount in the selected currency.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='valueCurrency'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Currency</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ?? 'CHF'}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value='CHF'>CHF</SelectItem>
                      <SelectItem value='EUR'>EUR</SelectItem>
                      <SelectItem value='USD'>USD</SelectItem>
                      <SelectItem value='GBP'>GBP</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription className='invisible'>
                    Amount in the selected currency.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <FormField
          control={form.control}
          name='description'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder='Add context, next steps, or requirements...'
                  className='min-h-[100px] resize-none'
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Accordion type='single' collapsible className='rounded-lg border'>
          <AccordionItem value='advanced' className='border-b-0'>
            <AccordionTrigger className='px-4'>Advanced</AccordionTrigger>
            <AccordionContent className='px-4 pb-4'>
              <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                <FormField
                  control={form.control}
                  name='origin'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Origin</FormLabel>
                      <FormControl>
                        <Input placeholder='e.g., API / WebForm / Import' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='inboxChannel'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Inbox channel</FormLabel>
                      <FormControl>
                        <Input placeholder='e.g., web_form / email_inbox' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='externalSourceId'
                  render={({ field }) => (
                    <FormItem className='md:col-span-2'>
                      <FormLabel>External source ID</FormLabel>
                      <FormControl>
                        <Input placeholder='e.g., Facebook Lead ID' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className='flex justify-end gap-3 pt-4'>
          {onCancel && (
            <Button type='button' variant='outline' onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type='submit' disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save Lead'}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
