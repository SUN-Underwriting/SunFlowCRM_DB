'use client';

import { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconGripVertical
} from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pipelinesApi, stagesApi } from '@/lib/api/crm-client';
import { toast } from 'sonner';
import type { StageWithRelations } from '@/lib/api/crm-types';

interface SortableStageItemProps {
  stage: StageWithRelations;
  onEdit: (stage: StageWithRelations) => void;
  onDelete: (id: string) => void;
}

/**
 * Sortable Stage Item
 * Best Practice (Context7): Drag-and-drop for reordering
 */
function SortableStageItem({
  stage,
  onEdit,
  onDelete
}: SortableStageItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: stage.id
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-card flex items-center gap-3 rounded-lg border p-3 ${
        isDragging ? 'opacity-50 shadow-lg' : 'hover:bg-muted/50'
      }`}
    >
      <div
        {...attributes}
        {...listeners}
        className='cursor-grab active:cursor-grabbing'
      >
        <IconGripVertical className='text-muted-foreground h-5 w-5' />
      </div>
      <div className='flex-1'>
        <div className='flex items-center gap-2'>
          <span className='font-medium'>{stage.name}</span>
          <Badge variant='secondary'>
            {typeof stage.probability === 'number'
              ? stage.probability
              : Number(stage.probability)}
            % win
          </Badge>
          {stage.isRotten && stage.rottenDays && (
            <Badge variant='destructive'>
              Rotten after{' '}
              {typeof stage.rottenDays === 'number'
                ? stage.rottenDays
                : Number(stage.rottenDays)}
              d
            </Badge>
          )}
        </div>
      </div>
      <div className='flex items-center gap-2'>
        <Button variant='ghost' size='sm' onClick={() => onEdit(stage)}>
          <IconEdit className='h-4 w-4' />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant='ghost' size='sm'>
              <IconTrash className='h-4 w-4' />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Stage</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete &quot;{stage.name}&quot;? Deals
                in this stage may be affected.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => onDelete(stage.id)}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

interface StagesManagerProps {
  onEditStage?: (stage: StageWithRelations) => void;
  onCreateStage?: (pipelineId: string) => void;
}

/**
 * Stages Manager Component
 * Best Practice (Context7): Drag-and-drop reordering with dnd-kit
 */
export function StagesManager({
  onEditStage,
  onCreateStage
}: StagesManagerProps) {
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
  const [stagesList, setStagesList] = useState<StageWithRelations[]>([]);
  const queryClient = useQueryClient();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  // Load pipelines
  const { data: pipelinesData } = useQuery({
    queryKey: ['pipelines'],
    queryFn: async () => {
      const response = await pipelinesApi.list();
      const raw = response.data.pipelines;
      return Array.isArray(raw) ? raw : [];
    }
  });

  const pipelines = pipelinesData || [];

  // Auto-select first pipeline
  useEffect(() => {
    if (pipelines.length > 0 && !selectedPipelineId) {
      const defaultPipeline =
        pipelines.find((p) => p.isDefault) || pipelines[0];
      setSelectedPipelineId(defaultPipeline.id);
    }
  }, [pipelines, selectedPipelineId]);

  // Load stages for selected pipeline
  const { data: stagesData, isLoading } = useQuery({
    queryKey: ['stages', selectedPipelineId],
    queryFn: async () => {
      const response = await stagesApi.listByPipeline(selectedPipelineId);
      return Array.isArray(response.data) ? response.data : [];
    },
    enabled: !!selectedPipelineId
  });

  useEffect(() => {
    if (stagesData) {
      setStagesList(stagesData);
    }
  }, [stagesData]);

  const deleteStage = useMutation({
    mutationFn: async (id: string) => {
      await stagesApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['stages', selectedPipelineId]
      });
      toast.success('Stage deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete stage');
    }
  });

  const reorderStages = useMutation({
    mutationFn: async (stages: StageWithRelations[]) => {
      // Update sortOrder for all stages
      const updates = stages.map((stage, index) =>
        stagesApi.update(stage.id, { sortOrder: index })
      );
      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['stages', selectedPipelineId]
      });
      toast.success('Stages reordered successfully');
    },
    onError: () => {
      toast.error('Failed to reorder stages');
      // Refetch to restore correct order
      queryClient.invalidateQueries({
        queryKey: ['stages', selectedPipelineId]
      });
    }
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    setStagesList((items) => {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);

      const newOrder = arrayMove(items, oldIndex, newIndex);

      // Trigger server update with context for rollback
      reorderStages.mutate(newOrder, {
        onError: () => {
          // Rollback UI on error
          setStagesList(items);
        }
      });

      return newOrder;
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <div>
            <CardTitle>Pipeline Stages</CardTitle>
            <CardDescription>
              Drag to reorder stages in the pipeline
            </CardDescription>
          </div>
          <div className='flex items-center gap-3'>
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
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => onCreateStage?.(selectedPipelineId)}
              disabled={!selectedPipelineId}
            >
              <IconPlus className='mr-2 h-4 w-4' />
              Add Stage
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className='space-y-2'>
            {[...Array(4)].map((_, i) => (
              <div key={i} className='bg-muted h-16 animate-pulse rounded' />
            ))}
          </div>
        ) : !selectedPipelineId ? (
          <div className='text-muted-foreground py-12 text-center'>
            Select a pipeline to manage stages
          </div>
        ) : stagesList.length === 0 ? (
          <div className='text-muted-foreground py-12 text-center'>
            <p>No stages found</p>
            <p className='mt-2 text-sm'>Add stages to this pipeline</p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={stagesList.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className='space-y-2'>
                {stagesList.map((stage) => (
                  <SortableStageItem
                    key={stage.id}
                    stage={stage}
                    onEdit={onEditStage || (() => {})}
                    onDelete={(id) => deleteStage.mutate(id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </CardContent>
    </Card>
  );
}
