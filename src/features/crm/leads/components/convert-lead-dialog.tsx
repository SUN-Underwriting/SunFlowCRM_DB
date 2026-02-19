'use client';

import { useEffect, useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
  FormControl,
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
import { useConvertLead } from '../hooks/use-leads';
import { pipelinesApi, stagesApi } from '@/lib/api/crm-client';
import type { PipelineWithRelations } from '@/lib/api/crm-types';

const convertLeadSchema = z.object({
  pipelineId: z.string().min(1, 'Pipeline is required'),
  stageId: z.string().min(1, 'Stage is required'),
  dealTitle: z.string().optional(),
  dealValue: z.number().optional(),
  currency: z.string().optional(),
  expectedCloseDate: z.date().optional()
});

type ConvertLeadFormValues = z.infer<typeof convertLeadSchema>;

interface ConvertLeadDialogProps {
  leadId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

/**
 * Convert Lead to Deal Dialog
 * Best Practice (Context7): Multi-step form with validation
 */
export function ConvertLeadDialog({
  leadId,
  open,
  onOpenChange,
  onSuccess
}: ConvertLeadDialogProps) {
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [loadingPipelines, setLoadingPipelines] = useState(false);
  const [loadingStages, setLoadingStages] = useState(false);

  const convertLead = useConvertLead();

  const form = useForm<ConvertLeadFormValues>({
    resolver: zodResolver(convertLeadSchema),
    defaultValues: {
      currency: 'USD'
    }
  });

  const selectedPipelineId = form.watch('pipelineId');

  // Load pipelines on mount
  useEffect(() => {
    if (open) {
      loadPipelines();
    }
  }, [open]);

  // Load stages when pipeline changes
  useEffect(() => {
    if (selectedPipelineId) {
      loadStages(selectedPipelineId);
    }
  }, [selectedPipelineId]);

  const loadPipelines = async () => {
    try {
      setLoadingPipelines(true);
      const response = await pipelinesApi.list();
      const raw = response.data.pipelines;
      const pipelinesList = Array.isArray(raw) ? raw : [];
      setPipelines(pipelinesList);

      // Auto-select default pipeline
      const defaultPipeline = pipelinesList.find(
        (p: PipelineWithRelations) => p.isDefault
      );
      if (defaultPipeline) {
        form.setValue('pipelineId', defaultPipeline.id);
      }
    } catch (error) {
      console.error('Failed to load pipelines:', error);
    } finally {
      setLoadingPipelines(false);
    }
  };

  const loadStages = async (pipelineId: string) => {
    try {
      setLoadingStages(true);
      const response = await stagesApi.listByPipeline(pipelineId);
      const stagesList = Array.isArray(response.data) ? response.data : [];
      setStages(stagesList);

      // Auto-select first stage
      if (stagesList.length > 0) {
        form.setValue('stageId', stagesList[0].id);
      }
    } catch (error) {
      console.error('Failed to load stages:', error);
    } finally {
      setLoadingStages(false);
    }
  };

  const onSubmit = async (values: ConvertLeadFormValues) => {
    await convertLead.mutateAsync({
      id: leadId,
      data: values
    });
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[600px]'>
        <DialogHeader>
          <DialogTitle>Convert Lead to Deal</DialogTitle>
          <DialogDescription>
            Convert this lead into an active deal in your pipeline.
          </DialogDescription>
        </DialogHeader>

        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
            <FormField
              control={form.control}
              name='dealTitle'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deal Title (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='Leave empty to use lead title'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className='grid grid-cols-2 gap-4'>
              <FormField
                control={form.control}
                name='pipelineId'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pipeline *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={loadingPipelines}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='Select pipeline' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {pipelines.map((pipeline) => (
                          <SelectItem key={pipeline.id} value={pipeline.id}>
                            {pipeline.name}
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
                name='stageId'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stage *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={loadingStages || !selectedPipelineId}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='Select stage' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {stages.map((stage) => (
                          <SelectItem key={stage.id} value={stage.id}>
                            {stage.name}
                          </SelectItem>
                        ))}
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
                name='dealValue'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deal Value</FormLabel>
                    <FormControl>
                      <MaskInput
                        mask='currency'
                        currency={form.watch('currency') || 'USD'}
                        placeholder='$0.00'
                        value={
                          field.value != null ? String(field.value) : ''
                        }
                        onValueChange={(_masked, unmasked) => {
                          field.onChange(
                            unmasked === '' ? undefined : parseFloat(unmasked)
                          );
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='currency'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value='USD'>USD</SelectItem>
                        <SelectItem value='EUR'>EUR</SelectItem>
                        <SelectItem value='GBP'>GBP</SelectItem>
                        <SelectItem value='CHF'>CHF</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name='expectedCloseDate'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expected Close Date</FormLabel>
                  <FormControl>
                    <Input
                      type='date'
                      {...field}
                      value={
                        field.value
                          ? new Date(field.value).toISOString().split('T')[0]
                          : ''
                      }
                      onChange={(e) =>
                        field.onChange(
                          e.target.value ? new Date(e.target.value) : undefined
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className='flex justify-end gap-3'>
              <Button
                type='button'
                variant='outline'
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type='submit' disabled={convertLead.isPending}>
                {convertLead.isPending ? 'Converting...' : 'Convert to Deal'}
              </Button>
            </div>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
