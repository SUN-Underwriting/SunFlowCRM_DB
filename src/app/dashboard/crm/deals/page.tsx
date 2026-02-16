'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useQueryStates, parseAsString, parseAsArrayOf } from 'nuqs';
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
import { DealsBoardToolbar } from '@/features/crm/deals/components/deals-board-toolbar';
import { CreateDealDialogEnhanced } from '@/features/crm/deals/components/create-deal-dialog-enhanced';
import { DealDetailSheet } from '@/features/crm/deals/components/deal-detail-sheet';
import {
  useDealsByPipeline,
  useMoveDeal
} from '@/features/crm/deals/hooks/use-deals';
import { pipelinesApi } from '@/lib/api/crm-client';
import { useDebounce } from '@/hooks/use-debounce';
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
 * - URL-synced filters (nuqs) for shareable links
 * - Loading and error states
 */
export default function DealsPage() {
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [prefilledStageId, setPrefilledStageId] = useState<string | null>(null);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);

  // URL-synced filters (nuqs pattern)
  const [filters] = useQueryStates({
    q: parseAsString.withDefault(''),
    owner: parseAsArrayOf(parseAsString).withDefault([]),
    status: parseAsArrayOf(parseAsString).withDefault([])
  });

  const debouncedSearch = useDebounce(filters.q, 300);

  // Load pipelines
  const { data: pipelinesData, isLoading: loadingPipelines } = useQuery({
    queryKey: ['pipelines'],
    queryFn: async () => {
      const response = await pipelinesApi.list();
      const raw = response.data.pipelines;
      return Array.isArray(raw) ? raw : [];
    },
    staleTime: 60 * 1000 // 1 minute
  });

  const pipelines = pipelinesData || [];
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

  // Quick add handler - pre-fill pipeline and stage
  const handleQuickAdd = (stageId: string) => {
    setPrefilledStageId(stageId);
    setCreateDialogOpen(true);
  };

  // Filter deals based on URL params (client-side MVP)
  const filteredDeals = useMemo(() => {
    if (!dealsData?.deals) return [];

    let result = dealsData.deals;

    // Search by title, person name, or organization name
    if (debouncedSearch) {
      const query = debouncedSearch.toLowerCase();
      result = result.filter((deal) => {
        const titleMatch = deal.title?.toLowerCase().includes(query);
        const personMatch =
          deal.person?.firstName?.toLowerCase().includes(query) ||
          deal.person?.lastName?.toLowerCase().includes(query);
        const orgMatch = deal.organization?.name?.toLowerCase().includes(query);
        return titleMatch || personMatch || orgMatch;
      });
    }

    // Filter by owner
    if (filters.owner.length > 0) {
      result = result.filter((deal) =>
        deal.ownerId ? filters.owner.includes(deal.ownerId) : false
      );
    }

    // Filter by status
    if (filters.status.length > 0) {
      result = result.filter((deal) => filters.status.includes(deal.status));
    }

    return result;
  }, [dealsData?.deals, debouncedSearch, filters.owner, filters.status]);

  // Group filtered deals by stage
  const dealsByStage =
    selectedPipeline && selectedPipeline.stages
      ? selectedPipeline.stages.map((stage: StageWithRelations) => ({
          stage,
          deals: filteredDeals.filter(
            (deal: DealWithRelations) => deal.stageId === stage.id
          )
        }))
      : [];

  // Extract unique owners for filter dropdown
  const owners = useMemo(() => {
    if (!dealsData?.deals) return [];
    const uniqueOwners = new Map<string, { id: string; name: string }>();
    dealsData.deals.forEach((deal) => {
      if (deal.owner && deal.ownerId) {
        uniqueOwners.set(deal.ownerId, {
          id: deal.ownerId,
          name:
            `${deal.owner.firstName || ''} ${deal.owner.lastName || ''}`.trim() ||
            deal.owner.email ||
            'Unknown'
        });
      }
    });
    return Array.from(uniqueOwners.values());
  }, [dealsData?.deals]);

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
            <>
              {/* Toolbar with search and filters */}
              <DealsBoardToolbar
                owners={owners}
                statuses={['OPEN', 'WON', 'LOST']}
              />

              {/* Pipeline board */}
              <PipelineBoard
                stages={selectedPipeline?.stages || []}
                dealsByStage={dealsByStage}
                onDealMove={handleDealMove}
                onDealClick={(deal) => {
                  setSelectedDealId(deal.id);
                  setDetailSheetOpen(true);
                }}
                onQuickAddClick={handleQuickAdd}
                isLoading={isLoading}
              />

              {/* Results info */}
              {!isLoading &&
                filteredDeals.length !== dealsData?.deals?.length && (
                  <div className='text-muted-foreground mt-4 text-center text-sm'>
                    Showing {filteredDeals.length} of{' '}
                    {dealsData?.deals?.length || 0} deals
                  </div>
                )}
            </>
          )}
        </CardContent>
      </Card>

      <CreateDealDialogEnhanced
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) {
            // Clear prefilled stage when dialog closes
            setPrefilledStageId(null);
          }
        }}
        defaultValues={
          prefilledStageId
            ? {
                pipelineId: selectedPipelineId,
                stageId: prefilledStageId
              }
            : undefined
        }
      />

      <DealDetailSheet
        dealId={selectedDealId}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
      />
    </div>
  );
}
