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
  FormMessage,
  FormDescription
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { pipelinesApi } from '@/lib/api/crm-client';
import { toast } from 'sonner';
import type { PipelineWithRelations } from '@/lib/api/crm-types';

const pipelineFormSchema = z.object({
  name: z.string().min(1, 'Pipeline name is required'),
  isDefault: z.boolean().optional()
});

type PipelineFormValues = z.infer<typeof pipelineFormSchema>;

interface PipelineFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipeline?: PipelineWithRelations;
}

/**
 * Pipeline Form Dialog
 * Best Practice: Reusable form for create/edit operations
 */
export function PipelineFormDialog({
  open,
  onOpenChange,
  pipeline
}: PipelineFormDialogProps) {
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

  const form = useForm<PipelineFormValues>({
    resolver: zodResolver(pipelineFormSchema),
    defaultValues: {
      name: pipeline?.name || '',
      isDefault: pipeline?.isDefault || false
    }
  });

  useEffect(() => {
    if (open) {
      if (pipeline) {
        form.reset({
          name: pipeline.name,
          isDefault: pipeline.isDefault
        });
      } else {
        form.reset({
          name: '',
          isDefault: false
        });
      }
    }
  }, [open, pipeline]);

  const createPipeline = useMutation({
    mutationFn: async (data: PipelineFormValues) => {
      await pipelinesApi.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
      toast.success('Pipeline created successfully');
      onOpenChange(false);
    },
    onError: (error) => {
      handleAuthAwareError(error, 'Failed to create pipeline');
    }
  });

  const updatePipeline = useMutation({
    mutationFn: async (data: PipelineFormValues) => {
      if (!pipeline) return;
      await pipelinesApi.update(pipeline.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
      toast.success('Pipeline updated successfully');
      onOpenChange(false);
    },
    onError: (error) => {
      handleAuthAwareError(error, 'Failed to update pipeline');
    }
  });

  const onSubmit = async (values: PipelineFormValues) => {
    try {
      if (pipeline) {
        await updatePipeline.mutateAsync(values);
      } else {
        await createPipeline.mutateAsync(values);
      }
    } catch {
      // Errors are handled by React Query onError callbacks.
      // Prevent unhandled promise rejections from bubbling to the Next.js runtime overlay.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[500px]'>
        <DialogHeader>
          <DialogTitle>
            {pipeline ? 'Edit Pipeline' : 'Create New Pipeline'}
          </DialogTitle>
          <DialogDescription>
            {pipeline
              ? 'Update pipeline details.'
              : 'Create a new sales pipeline for your CRM.'}
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
                <FormLabel>Pipeline Name *</FormLabel>
                <FormControl>
                  <Input placeholder='e.g., Sales Pipeline' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='isDefault'
            render={({ field }) => (
              <FormItem className='flex flex-row items-start space-y-0 space-x-3 rounded-md border p-4'>
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className='space-y-1 leading-none'>
                  <FormLabel>Set as default pipeline</FormLabel>
                  <FormDescription>
                    New deals will be created in this pipeline by default
                  </FormDescription>
                </div>
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
              disabled={createPipeline.isPending || updatePipeline.isPending}
            >
              {createPipeline.isPending || updatePipeline.isPending
                ? 'Saving...'
                : pipeline
                  ? 'Update Pipeline'
                  : 'Create Pipeline'}
            </Button>
          </div>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
