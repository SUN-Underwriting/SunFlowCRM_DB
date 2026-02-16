'use client';

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
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
  IconStar,
  IconStarFilled
} from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pipelinesApi } from '@/lib/api/crm-client';
import { toast } from 'sonner';
import type { PipelineWithRelations } from '@/lib/api/crm-types';

interface PipelinesListProps {
  onEdit?: (pipeline: PipelineWithRelations) => void;
  onCreate?: () => void;
}

/**
 * Pipelines List Component
 * Best Practice: CRUD management with optimistic updates
 */
export function PipelinesList({ onEdit, onCreate }: PipelinesListProps) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['pipelines'],
    queryFn: async () => {
      const response = await pipelinesApi.list();
      const raw = response.data.pipelines;
      return Array.isArray(raw) ? raw : [];
    }
  });

  const deletePipeline = useMutation({
    mutationFn: async (id: string) => {
      await pipelinesApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
      toast.success('Pipeline deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete pipeline');
    }
  });

  const setDefaultPipeline = useMutation({
    mutationFn: async (id: string) => {
      await pipelinesApi.update(id, { isDefault: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
      toast.success('Default pipeline updated');
    },
    onError: () => {
      toast.error('Failed to set default pipeline');
    }
  });

  const pipelines = data || [];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pipelines</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='space-y-2'>
            {[...Array(3)].map((_, i) => (
              <div key={i} className='bg-muted h-16 animate-pulse rounded' />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <div>
            <CardTitle>Pipelines</CardTitle>
            <CardDescription>
              Manage your sales pipelines and deal stages
            </CardDescription>
          </div>
          <Button onClick={onCreate}>
            <IconPlus className='mr-2 h-4 w-4' />
            New Pipeline
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {pipelines.length === 0 ? (
          <div className='text-muted-foreground py-12 text-center'>
            <p>No pipelines found</p>
            <p className='mt-2 text-sm'>
              Create your first pipeline to get started
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Stages</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className='text-right'>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pipelines.map((pipeline) => (
                <TableRow key={pipeline.id}>
                  <TableCell className='font-medium'>
                    <div className='flex items-center gap-2'>
                      {pipeline.name}
                      {pipeline.isDefault && (
                        <Badge variant='secondary'>Default</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{pipeline.stages?.length || 0} stages</TableCell>
                  <TableCell>
                    {pipeline.isDefault ? (
                      <IconStarFilled className='h-4 w-4 text-yellow-500' />
                    ) : (
                      <IconStar className='text-muted-foreground h-4 w-4' />
                    )}
                  </TableCell>
                  <TableCell className='text-right'>
                    <div className='flex items-center justify-end gap-2'>
                      {!pipeline.isDefault && (
                        <Button
                          variant='ghost'
                          size='sm'
                          onClick={() => setDefaultPipeline.mutate(pipeline.id)}
                          title='Set as default'
                        >
                          <IconStar className='h-4 w-4' />
                        </Button>
                      )}
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={() => onEdit?.(pipeline)}
                      >
                        <IconEdit className='h-4 w-4' />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant='ghost'
                            size='sm'
                            disabled={
                              pipeline.isDefault || deletePipeline.isPending
                            }
                          >
                            <IconTrash className='h-4 w-4' />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Pipeline</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete &quot;
                              {pipeline.name}&quot;? All stages within this
                              pipeline will also be removed.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deletePipeline.mutate(pipeline.id)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
