'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { IconPlus } from '@tabler/icons-react';
import { PipelineBoard } from '@/features/crm/deals/components/pipeline-board';
import { CreateDealDialogEnhanced } from '@/features/crm/deals/components/create-deal-dialog-enhanced';
import { DealDetailSheet } from '@/features/crm/deals/components/deal-detail-sheet';
import {
  useDealsByPipeline,
  useMoveDeal
} from '@/features/crm/deals/hooks/use-deals';
import { pipelinesApi } from '@/lib/api/crm-client';
import type {
  DealWithRelations,
  StageWithRelations
} from '@/lib/api/crm-types';

/**
 * Deals Page - Kanban Board View
 *
 * Best Practices (Context7):
 * - React Query for data fetching and cache management
 * - Optimistic drag & drop updates via useMoveDeal
 * - Pipeline selector with auto-select default
 * - Loading and error states
 */
export default function DealsPage() {
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);

  // Load pipelines
  const { data: pipelinesData, isLoading: loadingPipelines } = useQuery({
    queryKey: ['pipelines'],
    queryFn: async () => {
      const response = await pipelinesApi.list();
      return response.data;
    },
    staleTime: 60 * 1000 // 1 minute
  });

  const pipelines = Array.isArray(pipelinesData?.pipelines)
    ? pipelinesData.pipelines
    : [];
  const selectedPipeline = pipelines.find((p) => p.id === selectedPipelineId);

  // Auto-select default pipeline on load
  useEffect(() => {
    if (pipelines.length > 0 && !selectedPipelineId) {
      const defaultPipeline =
        pipelines.find((p) => p.isDefault) || pipelines[0];
      setSelectedPipelineId(defaultPipeline.id);
    }
  }, [pipelines, selectedPipelineId]);

  // Load deals for selected pipeline
  const {
    data: dealsData,
    isLoading: loadingDeals,
    error: dealsError
  } = useDealsByPipeline(selectedPipelineId);

  const moveDeal = useMoveDeal();

  const handleDealMove = async (dealId: string, newStageId: string) => {
    await moveDeal.mutateAsync({ id: dealId, stageId: newStageId });
  };

  // Group deals by stage
  const dealsByStage =
    selectedPipeline && dealsData && selectedPipeline.stages
      ? selectedPipeline.stages.map((stage: StageWithRelations) => ({
          stage,
          deals: (dealsData.deals || []).filter(
            (deal: DealWithRelations) => deal.stageId === stage.id
          )
        }))
      : [];

  const isLoading = loadingPipelines || loadingDeals;

  return (
    <div className='flex-1 space-y-4 p-4 pt-6 md:p-8'>
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-3xl font-bold tracking-tight'>Deals</h2>
          <p className='text-muted-foreground'>
            Manage your deals through the sales pipeline
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <IconPlus className='mr-2 h-4 w-4' />
          Add Deal
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle>Pipeline View</CardTitle>
              <CardDescription>
                Drag and drop deals between stages
              </CardDescription>
            </div>
            {pipelines.length > 0 && (
              <Select
                value={selectedPipelineId}
                onValueChange={setSelectedPipelineId}
              >
                <SelectTrigger className='w-[250px]'>
                  <SelectValue placeholder='Select pipeline' />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.map((pipeline) => (
                    <SelectItem key={pipeline.id} value={pipeline.id}>
                      {pipeline.name}
                      {pipeline.isDefault && ' (Default)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {dealsError ? (
            <div className='text-destructive py-12 text-center'>
              {dealsError instanceof Error
                ? dealsError.message
                : 'Failed to load deals'}
            </div>
          ) : !selectedPipelineId ? (
            <div className='text-muted-foreground py-12 text-center'>
              {pipelines.length === 0
                ? 'No pipelines found. Create a pipeline first.'
                : 'Select a pipeline to view deals'}
            </div>
          ) : (
            <PipelineBoard
              stages={selectedPipeline?.stages || []}
              dealsByStage={dealsByStage}
              onDealMove={handleDealMove}
              onDealClick={(deal) => {
                setSelectedDealId(deal.id);
                setDetailSheetOpen(true);
              }}
              isLoading={isLoading}
            />
          )}
        </CardContent>
      </Card>

      <CreateDealDialogEnhanced
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      <DealDetailSheet
        dealId={selectedDealId}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
      />
    </div>
  );
}
