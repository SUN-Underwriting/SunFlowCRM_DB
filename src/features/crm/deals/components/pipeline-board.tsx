'use client';

import { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragOverEvent,
  useDroppable
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DealCard } from './deal-card';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format-currency';
import { IconPlus } from '@tabler/icons-react';
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
 * Droppable Zone for empty stages
 * Best Practice (Context7): Provide drop target for empty containers
 */
function DroppableStageZone({
  id,
  children,
  isOver
}: {
  id: string;
  children: React.ReactNode;
  isOver?: boolean;
}) {
  const { setNodeRef } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'min-h-[100px] space-y-2 rounded-md p-2 transition-colors',
        isOver && 'bg-primary/10 border-primary border-2 border-dashed'
      )}
    >
      {children}
    </div>
  );
}

/**
 * Pipeline Board - Kanban view for deals
 *
 * Best Practices (Context7 + dnd-kit):
 * - Multiple droppable containers for stages
 * - Sortable items within each stage
 * - Optimistic UI updates via React Query
 * - Collision detection with closestCenter
 * - Quick add button in stage header (Pipedrive-like)
 */
export function PipelineBoard({
  stages,
  dealsByStage,
  onDealMove,
  onDealClick,
  onQuickAddClick,
  isLoading
}: PipelineBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeDeal, setActiveDeal] = useState<DealWithRelations | null>(null);
  const [overStageId, setOverStageId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8 // Prevent accidental drags
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);

    // Find the deal being dragged
    const deal = dealsByStage
      .flatMap((s) => s.deals)
      .find((d) => d.id === active.id);
    setActiveDeal(deal || null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;

    // Track which stage we're hovering over for visual feedback
    if (over) {
      const stageId = over.id as string;
      if (stages.some((s) => s.id === stageId)) {
        setOverStageId(stageId);
      }
    } else {
      setOverStageId(null);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    setOverStageId(null);

    if (!over) {
      setActiveId(null);
      setActiveDeal(null);
      return;
    }

    const dealId = active.id as string;
    let newStageId = over.id as string;

    // If dropped on a deal, find its stage
    const targetDealStage = dealsByStage.find((s) =>
      s.deals.some((d) => d.id === newStageId)
    );
    if (targetDealStage) {
      newStageId = targetDealStage.stage.id;
    }

    // Find current stage
    const currentStage = dealsByStage.find((s) =>
      s.deals.some((d) => d.id === dealId)
    );

    if (currentStage && currentStage.stage.id !== newStageId) {
      await onDealMove(dealId, newStageId);
    }

    setActiveId(null);
    setActiveDeal(null);
  };

  const getTotalValue = (deals: DealWithRelations[]) => {
    return deals.reduce((sum, deal) => sum + (deal.value || 0), 0);
  };

  if (isLoading) {
    return (
      <div className='flex gap-4 overflow-x-auto pb-4'>
        {[1, 2, 3, 4].map((i) => (
          <Card
            key={i}
            className='w-[280px] flex-shrink-0 animate-pulse md:w-[320px]'
          >
            <CardHeader className='pb-3'>
              <div className='bg-muted h-5 w-24 rounded' />
              <div className='bg-muted mt-2 h-4 w-16 rounded' />
            </CardHeader>
            <CardContent>
              <div className='space-y-2'>
                {[1, 2].map((j) => (
                  <div key={j} className='bg-muted h-24 rounded' />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className='-mx-2 flex gap-4 overflow-x-auto px-2 pb-4'>
        {dealsByStage.map(({ stage, deals }) => (
          <Card
            key={stage.id}
            className={cn(
              'w-[280px] flex-shrink-0 transition-colors md:w-[320px]',
              overStageId === stage.id && 'ring-primary ring-2'
            )}
          >
            <CardHeader className='pb-3'>
              <div className='flex items-center justify-between gap-2'>
                <div className='flex items-center gap-2'>
                  <CardTitle className='text-base font-medium'>
                    {stage.name}
                  </CardTitle>
                  <Badge variant='secondary'>{deals.length}</Badge>
                </div>

                {/* Quick Add Button */}
                {onQuickAddClick && (
                  <Button
                    size='icon'
                    variant='ghost'
                    className='h-7 w-7 flex-shrink-0'
                    onClick={() => onQuickAddClick(stage.id)}
                    title={`Add deal to ${stage.name}`}
                  >
                    <IconPlus className='h-4 w-4' />
                  </Button>
                )}
              </div>
              <div className='text-muted-foreground text-sm'>
                {formatCurrency(getTotalValue(deals))}
              </div>
            </CardHeader>
            <CardContent className='pt-0'>
              <ScrollArea className='h-[calc(100vh-300px)]'>
                <SortableContext
                  id={stage.id}
                  items={deals.map((d) => d.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <DroppableStageZone
                    id={stage.id}
                    isOver={overStageId === stage.id}
                  >
                    {deals.map((deal) => (
                      <DealCard
                        key={deal.id}
                        deal={deal}
                        isDragging={activeId === deal.id}
                        onClick={onDealClick}
                      />
                    ))}
                    {deals.length === 0 && (
                      <div className='text-muted-foreground py-8 text-center text-sm'>
                        Drop deals here
                      </div>
                    )}
                  </DroppableStageZone>
                </SortableContext>
              </ScrollArea>
            </CardContent>
          </Card>
        ))}
      </div>

      <DragOverlay>
        {activeDeal ? <DealCard deal={activeDeal} isDragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}
