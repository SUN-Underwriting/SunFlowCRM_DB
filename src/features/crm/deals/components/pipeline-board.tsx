'use client';

import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Kanban,
  KanbanBoard,
  KanbanColumn,
  KanbanColumnHandle,
  KanbanItem,
  KanbanOverlay
} from '@/components/ui/kanban';
import { DealCard } from './deal-card';
import { cn } from '@/lib/utils';
import { IconPlus, IconGripVertical } from '@tabler/icons-react';
import type { DragEndEvent } from '@dnd-kit/core';
import type {
  DealWithRelations,
  StageWithRelations
} from '@/lib/api/crm-types';

interface PipelineBoardProps {
  stages: StageWithRelations[];
  dealsByStage: Array<{
    stage: StageWithRelations;
    deals: DealWithRelations[];
  }>;
  onDealMove: (dealId: string, newStageId: string) => Promise<void>;
  onDealClick?: (deal: DealWithRelations) => void;
  onQuickAddClick?: (stageId: string) => void;
  isLoading?: boolean;
}

/**
 * Pipeline Board - Kanban view for deals
 * Follows DiceUI controlled component pattern:
 *   value={columns} onValueChange={setColumns}
 * API call fires once on onDragEnd (not on every drag-over).
 * @see https://www.diceui.com/docs/components/radix/kanban
 */
export function PipelineBoard({
  stages,
  dealsByStage,
  onDealMove,
  onDealClick,
  onQuickAddClick,
  isLoading
}: PipelineBoardProps) {
  // Server-sourced column map
  const serverColumns = useMemo(() => {
    const map: Record<string, DealWithRelations[]> = {};
    dealsByStage.forEach(({ stage, deals }) => {
      map[stage.id] = deals;
    });
    return map;
  }, [dealsByStage]);

  // Local state for instant visual feedback during drag
  const [columns, setColumns] = useState(serverColumns);

  // Sync local state when server data changes (after API mutation / React Query refetch)
  useEffect(() => {
    setColumns(serverColumns);
  }, [serverColumns]);

  // Always-current ref so onDragEnd reads post-move state
  const columnsRef = useRef(columns);
  columnsRef.current = columns;

  // Pre-drag snapshot to detect what changed on drop
  const snapshotRef = useRef(serverColumns);
  useEffect(() => {
    snapshotRef.current = serverColumns;
  }, [serverColumns]);

  // Fires once when user drops the card.
  // Cross-column moves are already reflected in `columns` from onDragOver→onValueChange.
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const draggedId = event.active.id as string;
      const snapshot = snapshotRef.current;
      const current = columnsRef.current;

      // Find original column
      let originalStageId: string | null = null;
      for (const [stageId, deals] of Object.entries(snapshot)) {
        if (deals.some((d) => d.id === draggedId)) {
          originalStageId = stageId;
          break;
        }
      }

      // Find current column
      let newStageId: string | null = null;
      for (const [stageId, deals] of Object.entries(current)) {
        if (deals.some((d) => d.id === draggedId)) {
          newStageId = stageId;
          break;
        }
      }

      if (newStageId && originalStageId && newStageId !== originalStageId) {
        onDealMove(draggedId, newStageId);
      }
    },
    [onDealMove]
  );

  if (isLoading) {
    return (
      <div className='grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className='flex animate-pulse flex-col gap-2 rounded-lg border bg-zinc-100 p-2.5 dark:bg-zinc-900'
          >
            <div className='bg-muted h-5 w-24 rounded' />
            <div className='bg-muted h-4 w-16 rounded' />
            <div className='space-y-2'>
              {[1, 2, 3].map((j) => (
                <div key={j} className='bg-muted h-24 rounded' />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const stageCount = dealsByStage.length;

  return (
    <Kanban
      value={columns}
      onValueChange={setColumns}
      onDragEnd={handleDragEnd}
      getItemValue={(deal) => deal.id}
    >
      <KanbanBoard
        className={cn(
          'grid auto-rows-fr gap-4 !h-auto',
          stageCount === 1 && 'grid-cols-1',
          stageCount === 2 && 'grid-cols-1 sm:grid-cols-2',
          stageCount === 3 && 'grid-cols-1 sm:grid-cols-3',
          stageCount === 4 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
          stageCount === 5 && 'grid-cols-1 sm:grid-cols-3 lg:grid-cols-5',
          stageCount >= 6 && 'grid-cols-1 sm:grid-cols-3 lg:grid-cols-6'
        )}
      >
        {Object.entries(columns).map(([stageId, deals]) => {
          const stage = stages.find((s) => s.id === stageId);
          if (!stage) return null;

          return (
            <KanbanColumn key={stageId} value={stageId}>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <span className='font-semibold text-sm'>{stage.name}</span>
                  <Badge
                    variant='secondary'
                    className='pointer-events-none rounded-sm'
                  >
                    {deals.length}
                  </Badge>
                </div>

                <div className='flex items-center'>
                  <KanbanColumnHandle asChild>
                    <Button variant='ghost' size='icon' className='h-7 w-7'>
                      <IconGripVertical className='h-4 w-4' />
                    </Button>
                  </KanbanColumnHandle>
                  {onQuickAddClick && (
                    <Button
                      size='icon'
                      variant='ghost'
                      className='h-7 w-7 flex-shrink-0'
                      onClick={() => onQuickAddClick(stageId)}
                      title={`Add deal to ${stage.name}`}
                    >
                      <IconPlus className='h-4 w-4' />
                    </Button>
                  )}
                </div>
              </div>
              <div className='flex flex-col gap-2 p-0.5'>
                {deals.map((deal) => (
                  <KanbanItem key={deal.id} value={deal.id} asHandle asChild>
                    <div className='rounded-md border bg-card p-3 shadow-xs'>
                      <DealCard deal={deal} onClick={onDealClick} />
                    </div>
                  </KanbanItem>
                ))}
                {deals.length === 0 && (
                  <div className='text-muted-foreground py-8 text-center text-sm'>
                    Drop deals here
                  </div>
                )}
              </div>
            </KanbanColumn>
          );
        })}
      </KanbanBoard>

      <KanbanOverlay>
        {({ value }) => {
          const deal = Object.values(columns)
            .flat()
            .find((d) => d.id === value);
          if (!deal) return null;
          return (
            <div className='rounded-md border bg-card p-3 shadow-xs'>
              <DealCard deal={deal} isDragging />
            </div>
          );
        }}
      </KanbanOverlay>
    </Kanban>
  );
}
