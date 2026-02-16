'use client';

import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
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
  FormMessage,
  FormDescription
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { IconPlus, IconX } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fieldDefinitionsApi } from '@/lib/api/crm-client';
import { toast } from 'sonner';
import type {
  FieldDefinition,
  FieldEntityType,
  FieldType
} from '@prisma/client';

const customFieldFormSchema = z
  .object({
    label: z.string().min(1, 'Label is required'),
    key: z
      .string()
      .min(1, 'Key is required')
      .regex(
        /^[a-z_][a-z0-9_]*$/,
        'Key must be lowercase with underscores only'
      ),
    fieldType: z.enum(['TEXT', 'NUMBER', 'DATE', 'SELECT', 'MULTI_SELECT']),
    options: z.array(z.string()).default([])
  })
  .superRefine((data, ctx) => {
    // Validate that SELECT/MULTI_SELECT have at least one non-empty option
    if (data.fieldType === 'SELECT' || data.fieldType === 'MULTI_SELECT') {
      const validOptions = data.options.filter(
        (opt) => opt && opt.trim().length > 0
      );
      if (validOptions.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['options'],
          message: 'At least one option is required for Select fields'
        });
      }
    }
  });

type CustomFieldFormValues = z.infer<typeof customFieldFormSchema>;

interface CustomFieldFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: FieldEntityType;
  field?: FieldDefinition;
}

/**
 * Custom Field Form Dialog
 * Best Practice (Context7): Dynamic form with useFieldArray for options
 */
export function CustomFieldFormDialog({
  open,
  onOpenChange,
  entityType,
  field
}: CustomFieldFormDialogProps) {
  const queryClient = useQueryClient();

  const handleAuthAwareError = (error: unknown, fallbackMessage: string) => {
    const status = (error as any)?.status;
    if (status === 401) {
      toast.error('Session expired. Please sign in again.');
      if (typeof window !== 'undefined') {
        const redirectToPath = encodeURIComponent(window.location.pathname);
        window.location.href = `/auth/sign-in?redirectToPath=${redirectToPath}`;
      }
      return;
    }
    toast.error(fallbackMessage);
  };

  const form = useForm<CustomFieldFormValues>({
    resolver: zodResolver(customFieldFormSchema) as any,
    defaultValues: {
      label: field?.label || '',
      key: field?.key || '',
      fieldType: field?.fieldType || 'TEXT',
      options: Array.isArray(field?.options) ? (field.options as string[]) : []
    }
  });

  const {
    fields: optionFields,
    append,
    remove
  } = useFieldArray({
    control: form.control as any,
    name: 'options'
  });

  const selectedFieldType = form.watch('fieldType');
  const needsOptions =
    selectedFieldType === 'SELECT' || selectedFieldType === 'MULTI_SELECT';

  useEffect(() => {
    if (open) {
      if (field) {
        form.reset({
          label: field.label,
          key: field.key,
          fieldType: field.fieldType,
          options: Array.isArray(field.options)
            ? (field.options as string[])
            : []
        });
      } else {
        form.reset({
          label: '',
          key: '',
          fieldType: 'TEXT',
          options: []
        });
      }
    }
  }, [open, field]);

  const createField = useMutation({
    mutationFn: async (data: CustomFieldFormValues) => {
      // Filter out empty options
      const cleanedOptions = needsOptions
        ? data.options.filter((opt) => opt && opt.trim().length > 0)
        : [];

      await fieldDefinitionsApi.create({
        ...data,
        entityType,
        options: cleanedOptions
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['field-definitions', entityType]
      });
      toast.success('Custom field created successfully');
      onOpenChange(false);
    },
    onError: (error) => {
      handleAuthAwareError(error, 'Failed to create custom field');
    }
  });

  const updateField = useMutation({
    mutationFn: async (data: CustomFieldFormValues) => {
      if (!field) return;

      // Filter out empty options
      const cleanedOptions = needsOptions
        ? data.options.filter((opt) => opt && opt.trim().length > 0)
        : [];

      await fieldDefinitionsApi.update(field.id, {
        ...data,
        options: cleanedOptions
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['field-definitions', entityType]
      });
      toast.success('Custom field updated successfully');
      onOpenChange(false);
    },
    onError: (error) => {
      handleAuthAwareError(error, 'Failed to update custom field');
    }
  });

  const onSubmit = async (values: CustomFieldFormValues) => {
    try {
      if (field) {
        await updateField.mutateAsync(values);
      } else {
        await createField.mutateAsync(values);
      }
    } catch {
      // Handled by onError; prevent runtime overlay.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[600px]'>
        <DialogHeader>
          <DialogTitle>
            {field ? 'Edit Custom Field' : 'Create Custom Field'}
          </DialogTitle>
          <DialogDescription>
            Define a custom field for {entityType.toLowerCase()}s
          </DialogDescription>
        </DialogHeader>

        <Form
          form={form}
          onSubmit={form.handleSubmit(onSubmit as any)}
          className='space-y-4'
        >
          <FormField
            control={form.control as any}
            name='label'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Label *</FormLabel>
                <FormControl>
                  <Input placeholder='e.g., Budget Range' {...field} />
                </FormControl>
                <FormDescription>Display name for this field</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control as any}
            name='key'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Key *</FormLabel>
                <FormControl>
                  <Input placeholder='e.g., budget_range' {...field} />
                </FormControl>
                <FormDescription>
                  Technical identifier (lowercase, underscores only)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control as any}
            name='fieldType'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Field Type *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder='Select type' />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value='TEXT'>Text</SelectItem>
                    <SelectItem value='NUMBER'>Number</SelectItem>
                    <SelectItem value='DATE'>Date</SelectItem>
                    <SelectItem value='SELECT'>Select (dropdown)</SelectItem>
                    <SelectItem value='MULTI_SELECT'>Multi Select</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {needsOptions && (
            <div className='space-y-3'>
              <div className='flex items-center justify-between'>
                <FormLabel>Options *</FormLabel>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={() => append('')}
                >
                  <IconPlus className='mr-1 h-3 w-3' />
                  Add Option
                </Button>
              </div>
              <div className='space-y-2'>
                {optionFields.map((optionField, index) => (
                  <div key={optionField.id} className='flex items-center gap-2'>
                    <Input
                      placeholder={`Option ${index + 1}`}
                      {...form.register(`options.${index}`)}
                    />
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      onClick={() => remove(index)}
                    >
                      <IconX className='h-4 w-4' />
                    </Button>
                  </div>
                ))}
                {optionFields.length === 0 && (
                  <div className='text-muted-foreground rounded border border-dashed py-4 text-center text-sm'>
                    No options added. Click "Add Option" to create choices.
                  </div>
                )}
              </div>
            </div>
          )}

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
              disabled={createField.isPending || updateField.isPending}
            >
              {createField.isPending || updateField.isPending
                ? 'Saving...'
                : field
                  ? 'Update Field'
                  : 'Create Field'}
            </Button>
          </div>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
