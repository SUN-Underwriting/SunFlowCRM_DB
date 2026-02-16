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

const personFormSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().optional(),
  jobTitle: z.string().optional(),
  orgId: z.string().optional()
});

export type PersonFormValues = z.infer<typeof personFormSchema>;

interface PersonFormProps {
  defaultValues?: Partial<PersonFormValues>;
  onSubmit: (values: PersonFormValues) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
  organizations?: Array<{ id: string; name: string }>;
}

export function PersonForm({
  defaultValues,
  onSubmit,
  onCancel,
  isLoading,
  organizations = []
}: PersonFormProps) {
  const form = useForm<PersonFormValues>({
    resolver: zodResolver(personFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      jobTitle: '',
      orgId: '',
      ...defaultValues
    }
  });

  return (
    <Form form={form} onSubmit={form.handleSubmit(onSubmit)}>
      <div className='space-y-6'>
        <div className='grid grid-cols-2 gap-4'>
          <FormField
            control={form.control}
            name='firstName'
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Name *</FormLabel>
                <FormControl>
                  <Input placeholder='John' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='lastName'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last Name *</FormLabel>
                <FormControl>
                  <Input placeholder='Doe' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className='grid grid-cols-2 gap-4'>
          <FormField
            control={form.control}
            name='email'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type='email'
                    placeholder='john.doe@example.com'
                    {...field}
                  />
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
          name='jobTitle'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Job Title</FormLabel>
              <FormControl>
                <Input placeholder='e.g., Sales Manager' {...field} />
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
            {isLoading ? 'Saving...' : 'Save Contact'}
          </Button>
        </div>
      </div>
    </Form>
  );
}
