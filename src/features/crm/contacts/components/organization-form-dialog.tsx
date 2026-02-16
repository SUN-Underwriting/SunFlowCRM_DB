'use client';

import { useEffect } from 'react';
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
  useCreateOrganization,
  useUpdateOrganization
} from '../hooks/use-organizations';
import type { OrganizationWithRelations } from '@/lib/api/crm-types';

const organizationFormSchema = z.object({
  name: z.string().min(1, 'Organization name is required'),
  industry: z.string().optional(),
  size: z.string().optional(),
  website: z.string().url('Invalid URL').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional()
});

type OrganizationFormValues = z.infer<typeof organizationFormSchema>;

interface OrganizationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organization?: OrganizationWithRelations;
}

/**
 * Organization Form Dialog
 * Best Practice (Context7): Reusable form for create/edit operations
 */
export function OrganizationFormDialog({
  open,
  onOpenChange,
  organization
}: OrganizationFormDialogProps) {
  const createOrganization = useCreateOrganization();
  const updateOrganization = useUpdateOrganization();

  const form = useForm<OrganizationFormValues>({
    resolver: zodResolver(organizationFormSchema),
    defaultValues: {
      name: organization?.name || '',
      industry: organization?.industry || '',
      size: organization?.size || '',
      website: organization?.website || '',
      phone: organization?.phone || '',
      address: organization?.address || ''
    }
  });

  useEffect(() => {
    if (open && organization) {
      form.reset({
        name: organization.name || '',
        industry: organization.industry || '',
        size: organization.size || '',
        website: organization.website || '',
        phone: organization.phone || '',
        address: organization.address || ''
      });
    } else if (open && !organization) {
      form.reset({
        name: '',
        industry: '',
        size: '',
        website: '',
        phone: '',
        address: ''
      });
    }
  }, [open, organization]);

  const onSubmit = async (values: OrganizationFormValues) => {
    try {
      if (organization) {
        await updateOrganization.mutateAsync({
          id: organization.id,
          data: values
        });
      } else {
        await createOrganization.mutateAsync(values);
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
            {organization ? 'Edit Organization' : 'Create New Organization'}
          </DialogTitle>
          <DialogDescription>
            {organization
              ? 'Update the organization details below.'
              : 'Add a new organization to your CRM.'}
          </DialogDescription>
        </DialogHeader>

        <Form
          form={form}
          onSubmit={form.handleSubmit(onSubmit)}
          className='space-y-4'
        >
          <FormField
            control={form.control}
            name='name'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Organization Name *</FormLabel>
                <FormControl>
                  <Input placeholder='Acme Inc.' {...field} />
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
                  <FormControl>
                    <Input placeholder='Technology' {...field} />
                  </FormControl>
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
                  <FormControl>
                    <Input placeholder='1-50 employees' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name='website'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Website</FormLabel>
                <FormControl>
                  <Input
                    type='url'
                    placeholder='https://example.com'
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
            name='address'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Address</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder='123 Main St, City, State, ZIP'
                    rows={3}
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
              disabled={
                createOrganization.isPending || updateOrganization.isPending
              }
            >
              {createOrganization.isPending || updateOrganization.isPending
                ? 'Saving...'
                : organization
                  ? 'Update Organization'
                  : 'Create Organization'}
            </Button>
          </div>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
