'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryStates, parseAsString, parseAsInteger, parseAsBoolean } from 'nuqs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ToggleGroup,
  ToggleGroupItem
} from '@/components/ui/toggle-group';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import {
  IconPlus,
  IconSearch,
  IconCheck,
  IconTrash,
  IconCalendarEvent,
  IconActivity
} from '@tabler/icons-react';
import { ActivitiesTable } from '@/features/crm/activities/components/activities-table';
import { ActivityFormDialog } from '@/features/crm/activities/components/activity-form-dialog';
import { BulkActionBar } from '@/features/crm/components/bulk-action-bar';
import {
  useActivities,
  useToggleActivityDone,
  useBulkActivities
} from '@/features/crm/activities/hooks/use-activities';
import type { PaginationState, SortingState, RowSelectionState } from '@tanstack/react-table';
import type { ActivityWithRelations } from '@/lib/api/crm-types';

const PAGE_SIZE = 25;

export default function ActivitiesPage() {
  // ── URL state ──────────────────────────────────────────────────────────────
  const [params, setParams] = useQueryStates({
    status:   parseAsString.withDefault('todo'),
    q:        parseAsString.withDefault(''),
    owner:    parseAsString.withDefault('everyone'),
    page:     parseAsInteger.withDefault(0),
    pageSize: parseAsInteger.withDefault(PAGE_SIZE),
    sortBy:   parseAsString.withDefault('dueAt'),
    sortDesc: parseAsBoolean.withDefault(false)
  });

  // ── Local UI state ─────────────────────────────────────────────────────────
  const [createDialogOpen, setCreateDialogOpen]   = useState(false);
  const [selectedActivity, setSelectedActivity]   = useState<ActivityWithRelations | null>(null);
  const [bulkSelection, setBulkSelection]         = useState<RowSelectionState>({});
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const searchInputRef  = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, []);

  // ── API filters ────────────────────────────────────────────────────────────
  const filters = useMemo(() => ({
    status:   (params.status === 'todo' || params.status === 'done' || params.status === 'all'
      ? params.status : 'all') as 'todo' | 'done' | 'all',
    q:        params.q || undefined,
    owner:    params.owner !== 'everyone' ? params.owner : undefined,
    sortBy:   params.sortBy as 'dueAt' | 'createdAt' | 'subject' | 'type',
    sortDesc: params.sortDesc,
    skip:     params.page * params.pageSize,
    take:     params.pageSize
  }), [params]);

  const { data, isLoading, error } = useActivities(filters);
  const toggleDone   = useToggleActivityDone();
  const bulkMutation = useBulkActivities();

  const activities = data?.activities ?? [];
  const total      = data?.total ?? 0;
  const pageCount  = Math.ceil(total / params.pageSize);

  const pagination: PaginationState = { pageIndex: params.page, pageSize: params.pageSize };
  const sorting: SortingState = params.sortBy ? [{ id: params.sortBy, desc: params.sortDesc }] : [];

  const selectedIds = Object.keys(bulkSelection).filter(k => bulkSelection[k]);
  const selectedActivities = activities.filter(a => selectedIds.includes(a.id));

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleTabChange = (value: string) => {
    setParams({ status: value, page: 0 });
    setBulkSelection({});
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setParams({ q: val || '', page: 0 }, { shallow: true });
      setBulkSelection({});
    }, 250);
  };

  const handlePaginationChange = (updater: PaginationState | ((prev: PaginationState) => PaginationState)) => {
    const next = typeof updater === 'function' ? updater(pagination) : updater;
    const updates: Record<string, number> = { page: next.pageIndex };
    if (next.pageSize !== params.pageSize) { updates.pageSize = next.pageSize; updates.page = 0; }
    setParams(updates);
  };

  const handleSortingChange = (updater: SortingState | ((prev: SortingState) => SortingState)) => {
    const next = typeof updater === 'function' ? updater(sorting) : updater;
    if (next.length > 0) setParams({ sortBy: next[0].id, sortDesc: next[0].desc, page: 0 });
  };

  const handleToggleDone = (id: string, done: boolean) => toggleDone.mutate({ id, done });

  const handleBulkMarkDone = () => {
    bulkMutation.mutate({ ids: selectedIds, action: 'markDone' }, { onSuccess: () => setBulkSelection({}) });
  };

  const handleBulkDeleteConfirm = () => {
    bulkMutation.mutate(
      { ids: selectedIds, action: 'delete' },
      { onSuccess: () => { setBulkSelection({}); setDeleteConfirmOpen(false); } }
    );
  };

  return (
    <div className='flex h-full flex-col gap-0'>

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className='flex items-center justify-between border-b px-6 py-4'>
        <div className='flex items-center gap-3'>
          <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10'>
            <IconActivity className='h-4 w-4 text-primary' />
          </div>
          <div>
            <h1 className='text-lg font-semibold leading-none'>Activities</h1>
            {total > 0 && (
              <p className='mt-0.5 text-xs text-muted-foreground'>
                {total === 1 ? '1 activity' : `${total} activities`}
              </p>
            )}
          </div>
        </div>
        <Button size='sm' onClick={() => setCreateDialogOpen(true)}>
          <IconPlus className='mr-1.5 h-3.5 w-3.5' />
          Schedule
        </Button>
      </div>

      {/* ── Filter toolbar ───────────────────────────────────────────────────── */}
      <div className='flex flex-wrap items-center gap-2 border-b bg-muted/20 px-6 py-2.5'>
        {/* Tabs */}
        <Tabs value={params.status} onValueChange={handleTabChange}>
          <TabsList className='h-8'>
            <TabsTrigger value='todo' className='text-xs px-3 h-7'>To-do</TabsTrigger>
            <TabsTrigger value='done' className='text-xs px-3 h-7'>Done</TabsTrigger>
            <TabsTrigger value='all'  className='text-xs px-3 h-7'>All</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className='h-5 w-px bg-border' />

        {/* Search */}
        <div className='relative min-w-[200px] max-w-xs flex-1'>
          <IconSearch className='absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground' />
          <Input
            ref={searchInputRef}
            placeholder='Search activities…'
            defaultValue={params.q}
            onChange={handleSearchChange}
            className='h-8 pl-8 text-sm'
          />
        </div>

        {/* Owner toggle */}
        <ToggleGroup
          type='single'
          value={params.owner}
          onValueChange={(v) => { if (v) { setParams({ owner: v, page: 0 }); setBulkSelection({}); } }}
          className='h-8'
        >
          <ToggleGroupItem value='everyone' className='h-8 px-3 text-xs'>Everyone</ToggleGroupItem>
          <ToggleGroupItem value='me'       className='h-8 px-3 text-xs'>Mine</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* ── Bulk action bar ──────────────────────────────────────────────────── */}
      {selectedActivities.length > 0 && (
        <div className='border-b px-6 py-2'>
          <BulkActionBar
            selectedCount={selectedActivities.length}
            onClearSelection={() => setBulkSelection({})}
            actions={[
              {
                label: 'Mark Done',
                icon: IconCheck,
                onClick: handleBulkMarkDone,
                variant: 'default',
                disabled: bulkMutation.isPending
              },
              {
                label: 'Delete',
                icon: IconTrash,
                onClick: () => setDeleteConfirmOpen(true),
                variant: 'destructive',
                disabled: bulkMutation.isPending
              }
            ]}
          />
        </div>
      )}

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className='flex-1 min-h-0 px-6 py-4'>
        {error ? (
          <div className='flex h-full items-center justify-center text-sm text-destructive'>
            {error instanceof Error ? error.message : 'Failed to load activities'}
          </div>
        ) : !isLoading && activities.length === 0 ? (
          <EmptyState
            status={params.status}
            hasFilters={!!params.q || params.owner !== 'everyone'}
            onAdd={() => setCreateDialogOpen(true)}
            onClearFilters={() => setParams({ q: '', owner: 'everyone', page: 0 })}
          />
        ) : (
          <ActivitiesTable
            data={activities}
            pageCount={pageCount}
            pagination={pagination}
            onPaginationChange={handlePaginationChange}
            sorting={sorting}
            onSortingChange={handleSortingChange}
            isLoading={isLoading}
            onToggleDone={handleToggleDone}
            onRowClick={(a) => setSelectedActivity(a)}
            enableBulkSelection
            bulkSelection={bulkSelection}
            onBulkSelectionChange={setBulkSelection}
            total={total}
            onEditActivity={(a) => setSelectedActivity(a)}
          />
        )}
      </div>

      {/* ── Dialogs ─────────────────────────────────────────────────────────── */}
      <ActivityFormDialog
        open={createDialogOpen || !!selectedActivity}
        onOpenChange={(open) => {
          if (!open) { setCreateDialogOpen(false); setSelectedActivity(null); }
        }}
        activity={selectedActivity ?? undefined}
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedIds.length === 1 ? '1 activity' : `${selectedIds.length} activities`}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The selected activities will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDeleteConfirm}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
              disabled={bulkMutation.isPending}
            >
              {bulkMutation.isPending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({
  status,
  hasFilters,
  onAdd,
  onClearFilters
}: {
  status: string;
  hasFilters: boolean;
  onAdd: () => void;
  onClearFilters: () => void;
}) {
  if (hasFilters) {
    return (
      <div className='flex h-full flex-col items-center justify-center gap-3 py-16 text-center'>
        <div className='flex h-12 w-12 items-center justify-center rounded-full bg-muted'>
          <IconSearch className='h-5 w-5 text-muted-foreground' />
        </div>
        <div>
          <p className='text-sm font-medium'>No results found</p>
          <p className='mt-1 text-xs text-muted-foreground'>Try adjusting your search or filters</p>
        </div>
        <Button variant='outline' size='sm' onClick={onClearFilters}>Clear filters</Button>
      </div>
    );
  }

  if (status === 'done') {
    return (
      <div className='flex h-full flex-col items-center justify-center gap-3 py-16 text-center'>
        <div className='flex h-12 w-12 items-center justify-center rounded-full bg-muted'>
          <IconCheck className='h-5 w-5 text-muted-foreground' />
        </div>
        <div>
          <p className='text-sm font-medium'>No completed activities yet</p>
          <p className='mt-1 text-xs text-muted-foreground'>Completed activities will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className='flex h-full flex-col items-center justify-center gap-3 py-16 text-center'>
      <div className='flex h-12 w-12 items-center justify-center rounded-full bg-primary/10'>
        <IconCalendarEvent className='h-5 w-5 text-primary' />
      </div>
      <div>
        <p className='text-sm font-medium'>No activities yet</p>
        <p className='mt-1 text-xs text-muted-foreground max-w-xs'>
          Schedule calls, meetings, tasks, and more to keep track of your work
        </p>
      </div>
      <Button size='sm' onClick={onAdd}>
        <IconPlus className='mr-1.5 h-3.5 w-3.5' />
        Schedule activity
      </Button>
    </div>
  );
}
