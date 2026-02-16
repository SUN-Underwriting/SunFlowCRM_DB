'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DealFormWithCustomFields,
  type DealFormValues
} from './deal-form-with-custom-fields';
import { useCreateDeal } from '../hooks/use-deals';
import { pipelinesApi } from '@/lib/api/crm-client';
import type { PipelineWithRelations } from '@/lib/api/crm-types';

interface CreateDealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultValues?: Partial<DealFormValues>;
}

/**
 * Create Deal Dialog with custom fields support.
 * Uses React Query for cached pipeline/stage data.
 *
 * @param defaultValues - Pre-fill form values (e.g., pipelineId/stageId for quick add)
 */
export function CreateDealDialogEnhanced({
  open,
  onOpenChange,
  defaultValues
}: CreateDealDialogProps) {
  const createDeal = useCreateDeal();

  // Cached pipelines — no re-fetch every time dialog opens
  const { data: pipelinesData, isLoading: loadingPipelines } = useQuery({
    queryKey: ['pipelines', 'create-deal-dialog'],
    queryFn: async () => {
      const response = await pipelinesApi.list();
      const raw = response.data;
      return Array.isArray(raw?.pipelines) ? raw.pipelines : [];
    },
    staleTime: 60 * 1000,
    enabled: open
  });

  const handleSubmit = async (values: DealFormValues) => {
    await createDeal.mutateAsync(values);
    onOpenChange(false);
  };

  // Safe computation of pipelines and stages - only when data is available
  const { pipelines, stages } = useMemo(() => {
    const pipelines = Array.isArray(pipelinesData) ? pipelinesData : [];
    const stages = pipelines.reduce<
      Array<{ id: string; name: string; pipelineId: string }>
    >((acc, pipeline) => {
      const pipelineStages = Array.isArray(pipeline.stages)
        ? pipeline.stages
        : [];
      for (const stage of pipelineStages) {
        acc.push({
          id: stage.id,
          name: stage.name,
          pipelineId: pipeline.id
        });
      }
      return acc;
    }, []);

    return { pipelines, stages };
  }, [pipelinesData]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-[700px]'>
        <DialogHeader>
          <DialogTitle>Create New Deal</DialogTitle>
          <DialogDescription>
            Add a new deal to your pipeline. Fill in the details below.
          </DialogDescription>
        </DialogHeader>
        {loadingPipelines || !pipelinesData ? (
          <div className='space-y-4 py-4'>
            <Skeleton className='h-10 w-full' />
            <div className='grid grid-cols-2 gap-4'>
              <Skeleton className='h-10 w-full' />
              <Skeleton className='h-10 w-full' />
            </div>
            <Skeleton className='h-10 w-full' />
          </div>
        ) : (
          <DealFormWithCustomFields
            defaultValues={defaultValues}
            onSubmit={handleSubmit}
            onCancel={() => onOpenChange(false)}
            isLoading={createDeal.isPending}
            pipelines={pipelines}
            stages={stages}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
