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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { useCreatePerson, useUpdatePerson } from '../hooks/use-persons';
import { organizationsApi } from '@/lib/api/crm-client';
import type { PersonWithRelations } from '@/lib/api/crm-types';

const personFormSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  jobTitle: z.string().optional(),
  organizationId: z.string().optional()
});

type PersonFormValues = z.infer<typeof personFormSchema>;

interface PersonFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  person?: PersonWithRelations;
}

/**
 * Person Form Dialog
 * Best Practice (Context7): Reusable form for create/edit operations
 */
export function PersonFormDialog({
  open,
  onOpenChange,
  person
}: PersonFormDialogProps) {
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);

  const createPerson = useCreatePerson();
  const updatePerson = useUpdatePerson();

  const form = useForm<PersonFormValues>({
    resolver: zodResolver(personFormSchema),
    defaultValues: {
      firstName: person?.firstName || '',
      lastName: person?.lastName || '',
      email: person?.email || '',
      phone: person?.phone || '',
      jobTitle: person?.jobTitle || '',
      organizationId: person?.organization?.id || ''
    }
  });

  useEffect(() => {
    if (open) {
      loadOrganizations();
      if (person) {
        form.reset({
          firstName: person.firstName || '',
          lastName: person.lastName || '',
          email: person.email || '',
          phone: person.phone || '',
          jobTitle: person.jobTitle || '',
          organizationId: person.organization?.id || ''
        });
      }
    }
  }, [open, person]);

  const loadOrganizations = async () => {
    try {
      setLoadingOrgs(true);
      const response = await organizationsApi.list({ take: 100 });
      setOrganizations(response.data.organizations || []);
    } catch (error) {
      console.error('Failed to load organizations:', error);
    } finally {
      setLoadingOrgs(false);
    }
  };

  const onSubmit = async (values: PersonFormValues) => {
    try {
      if (person) {
        await updatePerson.mutateAsync({ id: person.id, data: values });
      } else {
        await createPerson.mutateAsync(values);
      }
      form.reset();
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation hooks
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[500px]'>
        <DialogHeader>
          <DialogTitle>
            {person ? 'Edit Contact' : 'Create New Contact'}
          </DialogTitle>
          <DialogDescription>
            {person
              ? 'Update the contact details below.'
              : 'Add a new contact to your CRM.'}
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

          <FormField
            control={form.control}
            name='jobTitle'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Job Title</FormLabel>
                <FormControl>
                  <Input placeholder='CEO' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='organizationId'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Organization</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                  disabled={loadingOrgs}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder='Select organization' />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value=''>None</SelectItem>
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
              disabled={createPerson.isPending || updatePerson.isPending}
            >
              {createPerson.isPending || updatePerson.isPending
                ? 'Saving...'
                : person
                  ? 'Update Contact'
                  : 'Create Contact'}
            </Button>
          </div>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
