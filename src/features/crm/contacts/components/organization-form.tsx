'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const organizationFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  industry: z.string().optional(),
  size: z.string().optional(),
  website: z.string().url('Invalid URL').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional()
});

export type OrganizationFormValues = z.infer<typeof organizationFormSchema>;

interface OrganizationFormProps {
  defaultValues?: Partial<OrganizationFormValues>;
  onSubmit: (values: OrganizationFormValues) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function OrganizationForm({
  defaultValues,
  onSubmit,
  onCancel,
  isLoading
}: OrganizationFormProps) {
  const form = useForm<OrganizationFormValues>({
    resolver: zodResolver(organizationFormSchema),
    defaultValues: {
      name: '',
      industry: '',
      size: '',
      website: '',
      phone: '',
      address: '',
      ...defaultValues
    }
  });

  return (
    <Form form={form} onSubmit={form.handleSubmit(onSubmit)}>
      <div className='space-y-6'>
        <FormField
          control={form.control}
          name='name'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Organization Name *</FormLabel>
              <FormControl>
                <Input placeholder='e.g., Acme Corporation' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className='grid grid-cols-2 gap-4'>
          <FormField
            control={form.control}
            name='industry'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Industry</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder='Select industry' />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value='TECHNOLOGY'>Technology</SelectItem>
                    <SelectItem value='FINANCE'>Finance</SelectItem>
                    <SelectItem value='HEALTHCARE'>Healthcare</SelectItem>
                    <SelectItem value='RETAIL'>Retail</SelectItem>
                    <SelectItem value='MANUFACTURING'>Manufacturing</SelectItem>
                    <SelectItem value='EDUCATION'>Education</SelectItem>
                    <SelectItem value='OTHER'>Other</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='size'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Company Size</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder='Select size' />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value='1-10'>1-10 employees</SelectItem>
                    <SelectItem value='11-50'>11-50 employees</SelectItem>
                    <SelectItem value='51-200'>51-200 employees</SelectItem>
                    <SelectItem value='201-500'>201-500 employees</SelectItem>
                    <SelectItem value='501-1000'>501-1000 employees</SelectItem>
                    <SelectItem value='1000+'>1000+ employees</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className='grid grid-cols-2 gap-4'>
          <FormField
            control={form.control}
            name='website'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Website</FormLabel>
                <FormControl>
                  <Input placeholder='https://example.com' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='phone'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <Input placeholder='+1 (555) 123-4567' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name='address'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address</FormLabel>
              <FormControl>
                <Textarea
                  placeholder='Enter full address...'
                  className='resize-none'
                  rows={3}
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
            {isLoading ? 'Saving...' : 'Save Organization'}
          </Button>
        </div>
      </div>
    </Form>
  );
}
