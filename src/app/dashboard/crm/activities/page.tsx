'use client';

import { useState } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { IconPlus } from '@tabler/icons-react';
import { ActivitiesTable } from '@/features/crm/activities/components/activities-table';
import { ActivityFormDialog } from '@/features/crm/activities/components/activity-form-dialog';
import {
  useActivities,
  useToggleActivityDone
} from '@/features/crm/activities/hooks/use-activities';
import type { PaginationState, SortingState } from '@tanstack/react-table';
import type { ActivityType } from '@prisma/client';

/**
 * Activities Page
 * Best Practice (Context7): Server-side filtering with React Query + tabbed interface
 */
export default function ActivitiesPage() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<ActivityType | 'ALL'>('ALL');
  const [doneTab, setDoneTab] = useState<'pending' | 'completed'>('pending');
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10
  });
  const [sorting, setSorting] = useState<SortingState>([]);

  const { data, isLoading, error } = useActivities({
    type: typeFilter === 'ALL' ? undefined : typeFilter,
    done: doneTab === 'completed',
    skip: pagination.pageIndex * pagination.pageSize,
    take: pagination.pageSize
  });

  const toggleDone = useToggleActivityDone();

  const activities = data?.activities || [];
  const total = data?.total || 0;
  const pageCount = Math.ceil(total / pagination.pageSize);

  const handleToggleDone = async (id: string, done: boolean) => {
    await toggleDone.mutateAsync({ id, done });
  };

  return (
    <div className='flex-1 space-y-4 p-4 pt-6 md:p-8'>
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-3xl font-bold tracking-tight'>Activities</h2>
          <p className='text-muted-foreground'>
            Manage calls, meetings, tasks, and emails
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <IconPlus className='mr-2 h-4 w-4' />
          New Activity
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle>All Activities</CardTitle>
              <CardDescription>
                Track and manage your scheduled activities
              </CardDescription>
            </div>
            <Select
              value={typeFilter}
              onValueChange={(value) => {
                setTypeFilter(value as ActivityType | 'ALL');
                setPagination({ ...pagination, pageIndex: 0 });
              }}
            >
              <SelectTrigger className='w-[180px]'>
                <SelectValue placeholder='Filter by type' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='ALL'>All Types</SelectItem>
                <SelectItem value='CALL'>Calls</SelectItem>
                <SelectItem value='EMAIL'>Emails</SelectItem>
                <SelectItem value='MEETING'>Meetings</SelectItem>
                <SelectItem value='TASK'>Tasks</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs
            value={doneTab}
            onValueChange={(v) => {
              setDoneTab(v as 'pending' | 'completed');
              setPagination((prev) => ({ ...prev, pageIndex: 0 }));
            }}
          >
            <TabsList className='mb-4'>
              <TabsTrigger value='pending'>Pending</TabsTrigger>
              <TabsTrigger value='completed'>Completed</TabsTrigger>
            </TabsList>
          </Tabs>

          {error ? (
            <div className='text-destructive py-12 text-center'>
              {error instanceof Error
                ? error.message
                : 'Failed to load activities'}
            </div>
          ) : !isLoading && activities.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-16 text-center'>
              <IconPlus className='text-muted-foreground/50 mb-4 h-12 w-12' />
              <h3 className='text-lg font-semibold'>
                {doneTab === 'pending'
                  ? 'No pending activities'
                  : 'No completed activities'}
              </h3>
              <p className='text-muted-foreground mt-1 max-w-sm text-sm'>
                {doneTab === 'pending'
                  ? 'Schedule calls, meetings, and tasks to stay on track.'
                  : 'Completed activities will appear here.'}
              </p>
              {doneTab === 'pending' && (
                <Button
                  className='mt-4'
                  onClick={() => setCreateDialogOpen(true)}
                >
                  <IconPlus className='mr-2 h-4 w-4' />
                  New Activity
                </Button>
              )}
            </div>
          ) : (
            <ActivitiesTable
              data={activities}
              pageCount={pageCount}
              pagination={pagination}
              onPaginationChange={setPagination}
              sorting={sorting}
              onSortingChange={setSorting}
              isLoading={isLoading}
              onToggleDone={handleToggleDone}
            />
          )}
        </CardContent>
      </Card>

      <ActivityFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  );
}
