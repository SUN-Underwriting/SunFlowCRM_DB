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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const leadFormSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  source: z.string().optional(),
  personId: z.string().optional(),
  orgId: z.string().optional(),
  value: z.number().optional(),
  notes: z.string().optional()
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
  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      title: '',
      source: '',
      value: 0,
      notes: '',
      ...defaultValues
    }
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
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

        <FormField
          control={form.control}
          name='source'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Source</FormLabel>
              <Select onValueChange={field.onChange} value={field.value ?? ''}>
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
                  <SelectItem value='OTHER'>Other</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='value'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Estimated Value</FormLabel>
              <FormControl>
                <Input
                  type='number'
                  placeholder='0'
                  {...field}
                  onChange={(e) => {
                    const value =
                      e.target.value === ''
                        ? undefined
                        : parseFloat(e.target.value);
                    field.onChange(Number.isNaN(value) ? undefined : value);
                  }}
                />
              </FormControl>
              <FormDescription>
                Estimated deal value in your default currency
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='notes'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea
                  placeholder='Add any additional notes...'
                  className='resize-none'
                  rows={4}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className='flex justify-end gap-3'>
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
