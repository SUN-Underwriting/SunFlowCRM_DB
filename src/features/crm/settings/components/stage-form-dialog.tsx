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
import { stagesApi } from '@/lib/api/crm-client';
import { toast } from 'sonner';
import type { StageWithRelations } from '@/lib/api/crm-types';

const stageFormSchema = z.object({
  name: z.string().min(1, 'Stage name is required'),
  probability: z.number().min(0).max(100),
  isRotten: z.boolean().optional(),
  rottenDays: z.number().min(1).optional()
});

type StageFormValues = z.infer<typeof stageFormSchema>;

interface StageFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelineId: string;
  stage?: StageWithRelations;
}

/**
 * Stage Form Dialog
 * Best Practice: Form with conditional fields (rottenDays enabled by isRotten)
 */
export function StageFormDialog({
  open,
  onOpenChange,
  pipelineId,
  stage
}: StageFormDialogProps) {
  const queryClient = useQueryClient();

  const form = useForm<StageFormValues>({
    resolver: zodResolver(stageFormSchema),
    defaultValues: {
      name: stage?.name || '',
      probability:
        typeof stage?.probability === 'number'
          ? stage.probability
          : typeof stage?.probability === 'object'
            ? Number(stage.probability)
            : 0,
      isRotten: stage?.isRotten || false,
      rottenDays:
        typeof stage?.rottenDays === 'number'
          ? stage.rottenDays
          : typeof stage?.rottenDays === 'object'
            ? Number(stage.rottenDays)
            : 30
    }
  });

  const isRottenEnabled = form.watch('isRotten');

  useEffect(() => {
    if (open) {
      if (stage) {
        form.reset({
          name: stage.name,
          probability:
            typeof stage.probability === 'number'
              ? stage.probability
              : Number(stage.probability),
          isRotten: stage.isRotten,
          rottenDays:
            typeof stage.rottenDays === 'number'
              ? stage.rottenDays
              : stage.rottenDays
                ? Number(stage.rottenDays)
                : 30
        });
      } else {
        form.reset({
          name: '',
          probability: 0,
          isRotten: false,
          rottenDays: 30
        });
      }
    }
  }, [open, stage]);

  const createStage = useMutation({
    mutationFn: async (data: StageFormValues) => {
      await stagesApi.create({
        name: data.name,
        probability: data.probability,
        isRotten: data.isRotten || false,
        pipelineId,
        rottenDays: data.isRotten ? data.rottenDays : null
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stages', pipelineId] });
      toast.success('Stage created successfully');
      onOpenChange(false);
    },
    onError: () => {
      toast.error('Failed to create stage');
    }
  });

  const updateStage = useMutation({
    mutationFn: async (data: StageFormValues) => {
      if (!stage) return;
      await stagesApi.update(stage.id, {
        name: data.name,
        probability: data.probability,
        isRotten: data.isRotten || false,
        rottenDays: data.isRotten ? data.rottenDays : null
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stages', pipelineId] });
      toast.success('Stage updated successfully');
      onOpenChange(false);
    },
    onError: () => {
      toast.error('Failed to update stage');
    }
  });

  const onSubmit = async (values: StageFormValues) => {
    if (stage) {
      await updateStage.mutateAsync(values);
    } else {
      await createStage.mutateAsync(values);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[500px]'>
        <DialogHeader>
          <DialogTitle>{stage ? 'Edit Stage' : 'Create New Stage'}</DialogTitle>
          <DialogDescription>
            {stage
              ? 'Update stage details.'
              : 'Add a new stage to the pipeline.'}
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
                <FormLabel>Stage Name *</FormLabel>
                <FormControl>
                  <Input placeholder='e.g., Qualified' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='probability'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Win Probability (%) *</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    min='0'
                    max='100'
                    placeholder='0'
                    {...field}
                    onChange={(e) =>
                      field.onChange(parseInt(e.target.value) || 0)
                    }
                  />
                </FormControl>
                <FormDescription>
                  Likelihood of winning deals in this stage (0-100%)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='isRotten'
            render={({ field }) => (
              <FormItem className='flex flex-row items-start space-y-0 space-x-3 rounded-md border p-4'>
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className='space-y-1 leading-none'>
                  <FormLabel>Enable rotten deal detection</FormLabel>
                  <FormDescription>
                    Mark deals as rotten if they stay too long in this stage
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />

          {isRottenEnabled && (
            <FormField
              control={form.control}
              name='rottenDays'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rotten Days *</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min='1'
                      placeholder='30'
                      {...field}
                      onChange={(e) =>
                        field.onChange(parseInt(e.target.value) || 1)
                      }
                    />
                  </FormControl>
                  <FormDescription>
                    Number of days before a deal is marked as rotten
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
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
              disabled={createStage.isPending || updateStage.isPending}
            >
              {createStage.isPending || updateStage.isPending
                ? 'Saving...'
                : stage
                  ? 'Update Stage'
                  : 'Create Stage'}
            </Button>
          </div>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
