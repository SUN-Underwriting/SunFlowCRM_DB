'use client';

import { useMemo, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
  type SortingState,
  type RowSelectionState,
  type Updater,
  type ColumnFiltersState,
  type VisibilityState
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
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
import { Button } from '@/components/ui/button';
import { DataTableFacetedFilter } from '@/components/ui/table/data-table-faceted-filter';
import { DataTableViewOptions } from '@/components/ui/table/data-table-view-options';
import { DataTablePagination } from '@/components/ui/table/data-table-pagination';
import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  IconPhone,
  IconMail,
  IconCalendar,
  IconNotes,
  IconAlarm,
  IconToolsKitchen2,
  IconChevronUp,
  IconChevronDown,
  IconArrowsSort,
  IconDotsVertical,
  IconEdit,
  IconTrash,
  IconCheck,
  IconUsers,
  IconBriefcase,
  IconFlag3,
  IconHash
} from '@tabler/icons-react';
import { format, isToday, isPast, isFuture, formatDistanceToNowStrict } from 'date-fns';
import { cn } from '@/lib/utils';
import type { ActivityWithRelations } from '@/lib/api/crm-types';
import type { ActivityType } from '@prisma/client';
import { useDeleteActivity } from '../hooks/use-activities';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActivitiesTableProps {
  data: ActivityWithRelations[];
  pageCount: number;
  pagination: PaginationState;
  onPaginationChange: (updater: PaginationState | ((prev: PaginationState) => PaginationState)) => void;
  sorting: SortingState;
  onSortingChange: (updater: SortingState | ((prev: SortingState) => SortingState)) => void;
  isLoading?: boolean;
  onToggleDone?: (id: string, done: boolean) => void;
  onRowClick?: (activity: ActivityWithRelations) => void;
  onEditActivity?: (activity: ActivityWithRelations) => void;
  enableBulkSelection?: boolean;
  bulkSelection?: RowSelectionState;
  onBulkSelectionChange?: React.Dispatch<React.SetStateAction<RowSelectionState>>;
  total?: number;
  columnFilters?: ColumnFiltersState;
  onColumnFiltersChange?: (filters: ColumnFiltersState) => void;
}

// ─── Activity type config ─────────────────────────────────────────────────────

const TYPE_CONFIG: Record<ActivityType, {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  bg: string;
  text: string;
}> = {
  CALL:     { icon: IconPhone,         label: 'Call',     bg: 'bg-blue-500/10',   text: 'text-blue-600' },
  EMAIL:    { icon: IconMail,          label: 'Email',    bg: 'bg-purple-500/10', text: 'text-purple-600' },
  MEETING:  { icon: IconUsers,         label: 'Meeting',  bg: 'bg-green-500/10',  text: 'text-green-600' },
  TASK:     { icon: IconNotes,         label: 'Task',     bg: 'bg-orange-500/10', text: 'text-orange-600' },
  DEADLINE: { icon: IconAlarm,         label: 'Deadline', bg: 'bg-red-500/10',    text: 'text-red-600' },
  LUNCH:    { icon: IconToolsKitchen2, label: 'Lunch',    bg: 'bg-yellow-500/10', text: 'text-yellow-600' }
};

const TYPE_FILTER_OPTIONS = [
  { label: 'Call',     value: 'CALL',     icon: IconPhone },
  { label: 'Email',    value: 'EMAIL',    icon: IconMail },
  { label: 'Meeting',  value: 'MEETING',  icon: IconUsers },
  { label: 'Task',     value: 'TASK',     icon: IconNotes },
  { label: 'Deadline', value: 'DEADLINE', icon: IconAlarm },
  { label: 'Lunch',    value: 'LUNCH',    icon: IconToolsKitchen2 }
];

const DUE_FILTER_OPTIONS = [
  { label: 'Overdue',   value: 'overdue' },
  { label: 'Today',     value: 'today' },
  { label: 'This week', value: 'week' }
];

// ─── Due date helpers ─────────────────────────────────────────────────────────

function getDueDateInfo(dueAt: Date | string | null, hasTime: boolean, done: boolean) {
  if (!dueAt) return { label: '—', className: 'text-muted-foreground', sub: null };
  const date = new Date(dueAt);
  const dateStr = hasTime ? format(date, 'MMM d, HH:mm') : format(date, 'MMM d');

  if (done) return { label: dateStr, className: 'text-muted-foreground', sub: null };
  if (isPast(date) && !isToday(date)) {
    const ago = formatDistanceToNowStrict(date, { addSuffix: false });
    return { label: dateStr, className: 'text-destructive font-medium', sub: `Overdue by ${ago}` };
  }
  if (isToday(date)) return { label: dateStr, className: 'text-emerald-600 font-medium', sub: 'Today' };
  if (isFuture(date)) return { label: dateStr, className: 'text-foreground', sub: null };
  return { label: dateStr, className: 'text-muted-foreground', sub: null };
}

function getStatusBadge(activity: ActivityWithRelations) {
  if (activity.done) {
    return { label: 'Done', className: 'bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-300' };
  }
  const dueAt = activity.dueAt ? new Date(activity.dueAt) : null;
  if (!dueAt) return { label: 'To-do', className: 'bg-slate-500/10 text-slate-700 border-slate-200 dark:text-slate-300' };
  if (isPast(dueAt) && !isToday(dueAt)) {
    return { label: 'Overdue', className: 'bg-red-500/10 text-red-700 border-red-200 dark:text-red-300' };
  }
  if (isToday(dueAt)) {
    return { label: 'Today', className: 'bg-amber-500/10 text-amber-800 border-amber-200 dark:text-amber-300' };
  }
  return { label: 'Scheduled', className: 'bg-blue-500/10 text-blue-700 border-blue-200 dark:text-blue-300' };
}

function getPriorityBadge(activity: ActivityWithRelations) {
  if (activity.done) return { label: '—', className: 'text-muted-foreground border-transparent bg-transparent' };
  const dueAt = activity.dueAt ? new Date(activity.dueAt) : null;
  if (!dueAt) return { label: 'Low', className: 'bg-slate-500/10 text-slate-700 border-slate-200 dark:text-slate-300' };
  if (isPast(dueAt) && !isToday(dueAt)) {
    return { label: 'High', className: 'bg-red-500/10 text-red-700 border-red-200 dark:text-red-300' };
  }
  if (isToday(dueAt)) {
    return { label: 'High', className: 'bg-red-500/10 text-red-700 border-red-200 dark:text-red-300' };
  }
  const diffMs = dueAt.getTime() - Date.now();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays <= 3) {
    return { label: 'Medium', className: 'bg-amber-500/10 text-amber-800 border-amber-200 dark:text-amber-300' };
  }
  return { label: 'Low', className: 'bg-slate-500/10 text-slate-700 border-slate-200 dark:text-slate-300' };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TypeIcon({ type }: { type: ActivityType }) {
  const cfg = TYPE_CONFIG[type];
  if (!cfg) return null;
  const Icon = cfg.icon;
  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md', cfg.bg)}>
          <Icon className={cn('h-3.5 w-3.5', cfg.text)} />
        </div>
      </TooltipTrigger>
      <TooltipContent side='top'>{cfg.label}</TooltipContent>
    </Tooltip>
  );
}

function SortableHeader({ label, columnId, sorting, onSort }: {
  label: string;
  columnId: string;
  sorting: SortingState;
  onSort: (id: string) => void;
}) {
  const current = sorting.find(s => s.id === columnId);
  return (
    <button
      className='flex items-center gap-1 font-medium hover:text-foreground transition-colors'
      onClick={() => onSort(columnId)}
    >
      {label}
      {current
        ? current.desc
          ? <IconChevronDown className='h-3 w-3' />
          : <IconChevronUp className='h-3 w-3' />
        : <IconArrowsSort className='h-3 w-3 text-muted-foreground' />}
    </button>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ActivitiesTable({
  data,
  pageCount,
  pagination,
  onPaginationChange,
  sorting,
  onSortingChange,
  isLoading,
  onToggleDone,
  onRowClick,
  onEditActivity,
  enableBulkSelection = false,
  bulkSelection = {},
  onBulkSelectionChange,
  total,
  columnFilters,
  onColumnFiltersChange
}: ActivitiesTableProps) {
  const deleteActivity = useDeleteActivity();

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    // Data-grid default (similar to shadcn tasks table).
    lead:         false,
    person:       false,
    deal:         false,
    organization: false
  });

  const [localColumnFilters, setLocalColumnFilters] = useState<ColumnFiltersState>([]);
  const activeFilters  = columnFilters ?? localColumnFilters;
  const setActiveFilters = onColumnFiltersChange ?? setLocalColumnFilters;

  const handleSort = (id: string) => {
    const cur = sorting.find(s => s.id === id);
    onSortingChange([{ id, desc: cur ? !cur.desc : false }]);
  };

  const columns = useMemo<ColumnDef<ActivityWithRelations>[]>(() => [
    // ── Bulk select ──────────────────────────────────────────────────────────
    ...(enableBulkSelection ? [{
      id: 'select',
      header: ({ table }: { table: import('@tanstack/react-table').Table<ActivityWithRelations> }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label='Select all'
          className='size-5 rounded-md'
        />
      ),
      cell: ({ row }: { row: import('@tanstack/react-table').Row<ActivityWithRelations> }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          onClick={(e) => e.stopPropagation()}
          aria-label='Select row'
          className='size-5 rounded-md'
        />
      ),
      size: 40,
      enableSorting: false,
      enableHiding: false
    } as ColumnDef<ActivityWithRelations>] : []),

    // ── ID (short) ───────────────────────────────────────────────────────────
    {
      id: 'shortId',
      meta: { label: 'ID' },
      header: () => (
        <span className='inline-flex items-center gap-1'>
          <IconHash className='h-3.5 w-3.5' />
          ID
        </span>
      ),
      cell: ({ row }) => {
        const id = row.original.id;
        const short = id.length > 8 ? id.slice(0, 8).toUpperCase() : id.toUpperCase();
        return (
          <span className='font-mono text-xs text-muted-foreground'>
            {short}
          </span>
        );
      },
      size: 90,
      enableSorting: false
    },

    // ── Title (type + subject + note + linked context) ───────────────────────
    {
      id: 'title',
      meta: { label: 'Title' },
      header: () => <SortableHeader label='Title' columnId='subject' sorting={sorting} onSort={handleSort} />,
      cell: ({ row }) => {
        const a = row.original;
        const t = a.type as ActivityType;
        const cfg = TYPE_CONFIG[t];

        const deal = a.deal as (ActivityWithRelations['deal'] & { stage?: { name: string } | null }) | null;
        const org  = a.organization;
        const person = a.person;

        return (
          <div className='min-w-0 space-y-1'>
            <div className='flex min-w-0 items-center gap-2'>
              <span className='inline-flex items-center gap-1 text-xs text-muted-foreground'>
                <TypeIcon type={t} />
                <span className='hidden sm:inline'>{cfg?.label ?? t}</span>
              </span>
              <span className={cn('truncate text-sm font-medium', a.done && 'text-muted-foreground line-through')}>
                {a.subject}
              </span>
            </div>
            {(a.note || deal || org || person) && (
              <div className='flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground'>
                {a.note && <span className='truncate max-w-[520px]'>{a.note}</span>}
                {deal && (
                  <span
                    className='inline-flex items-center gap-1 cursor-pointer hover:underline text-foreground/80'
                    onClick={(e) => { e.stopPropagation(); window.location.href = `/dashboard/crm/deals?dealId=${deal.id}`; }}
                  >
                    <IconBriefcase className='h-3 w-3' />{deal.title}
                  </span>
                )}
                {org && <span className='truncate'>{org.name}</span>}
                {person && <span className='truncate'>{person.firstName} {person.lastName}</span>}
              </div>
            )}
          </div>
        );
      }
    },

    // ── Status ───────────────────────────────────────────────────────────────
    {
      id: 'status',
      meta: { label: 'Status' },
      header: () => <SortableHeader label='Status' columnId='done' sorting={sorting} onSort={handleSort} />,
      cell: ({ row }) => {
        const s = getStatusBadge(row.original);
        return (
          <Badge variant='outline' className={cn('px-2 py-0.5 text-xs font-medium', s.className)}>
            {s.label}
          </Badge>
        );
      },
      size: 120
    },

    // ── Priority ─────────────────────────────────────────────────────────────
    {
      id: 'priority',
      meta: { label: 'Priority' },
      header: () => (
        <span className='inline-flex items-center gap-1'>
          <IconFlag3 className='h-3.5 w-3.5' />
          Priority
        </span>
      ),
      cell: ({ row }) => {
        const p = getPriorityBadge(row.original);
        return (
          <Badge variant='outline' className={cn('px-2 py-0.5 text-xs font-medium', p.className)}>
            {p.label}
          </Badge>
        );
      },
      size: 120,
      enableSorting: false
    },

    // ── Due date ─────────────────────────────────────────────────────────────
    {
      id: 'dueAt',
      meta: { label: 'Due date' },
      header: () => <SortableHeader label='Due date' columnId='dueAt' sorting={sorting} onSort={handleSort} />,
      cell: ({ row }) => {
        const { dueAt, hasTime, done } = row.original;
        const { label, className, sub } = getDueDateInfo(dueAt, hasTime, done);
        return (
          <div className='space-y-0.5'>
            <div className={cn('text-sm tabular-nums', className)}>{label}</div>
            {sub && <div className={cn('text-xs', done ? 'text-muted-foreground' : className)}>{sub}</div>}
          </div>
        );
      },
      size: 130
    },

    // ── Type (kept for faceted filter / view options) ────────────────────────
    {
      id: 'type',
      meta: { label: 'Type' },
      header: () => <SortableHeader label='Type' columnId='type' sorting={sorting} onSort={handleSort} />,
      cell: ({ row }) => {
        const t = row.original.type as ActivityType;
        const cfg = TYPE_CONFIG[t];
        return <span className='text-sm text-muted-foreground'>{cfg?.label ?? t}</span>;
      },
      size: 140
    },

    // ── Deal (hidden by default — shown in subject context) ──────────────────
    {
      id: 'deal',
      meta: { label: 'Deal' },
      header: 'Deal',
      cell: ({ row }) => {
        const deal = row.original.deal as (ActivityWithRelations['deal'] & { stage?: { name: string } | null }) | null;
        if (!deal) return <span className='text-muted-foreground text-sm'>—</span>;
        return (
          <div
            className='max-w-[160px] cursor-pointer text-sm hover:underline'
            onClick={(e) => { e.stopPropagation(); window.location.href = `/dashboard/crm/deals?dealId=${deal.id}`; }}
          >
            <div className='truncate font-medium'>{deal.title}</div>
            {deal.stage && <div className='text-xs text-muted-foreground'>{deal.stage.name}</div>}
          </div>
        );
      },
      size: 160
    },

    // ── Lead (hidden by default) ─────────────────────────────────────────────
    {
      id: 'lead',
      meta: { label: 'Lead' },
      header: 'Lead',
      cell: ({ row }) => {
        const lead = row.original.lead as { id: string; title: string } | null;
        if (!lead) return <span className='text-muted-foreground text-sm'>—</span>;
        return (
          <div
            className='max-w-[140px] cursor-pointer truncate text-sm font-medium hover:underline'
            onClick={(e) => { e.stopPropagation(); window.location.href = `/dashboard/crm/leads?leadId=${lead.id}`; }}
          >
            {lead.title}
          </div>
        );
      },
      size: 140
    },

    // ── Person (hidden by default) ───────────────────────────────────────────
    {
      id: 'person',
      meta: { label: 'Person' },
      header: 'Person',
      cell: ({ row }) => {
        const p = row.original.person;
        if (!p) return <span className='text-muted-foreground text-sm'>—</span>;
        return <div className='max-w-[140px] truncate text-sm font-medium'>{p.firstName} {p.lastName}</div>;
      },
      size: 140
    },

    // ── Organization (hidden by default) ─────────────────────────────────────
    {
      id: 'organization',
      meta: { label: 'Organization' },
      header: 'Organization',
      cell: ({ row }) => {
        const org = row.original.organization;
        if (!org) return <span className='text-muted-foreground text-sm'>—</span>;
        return <div className='max-w-[140px] truncate text-sm font-medium'>{org.name}</div>;
      },
      size: 140
    },

    // ── Owner (avatar + tooltip) ─────────────────────────────────────────────
    {
      id: 'owner',
      meta: { label: 'Owner' },
      header: 'Owner',
      cell: ({ row }) => {
        const owner = row.original.owner;
        if (!owner) return <span className='text-muted-foreground text-sm'>—</span>;
        const initials = `${owner.firstName?.[0] ?? ''}${owner.lastName?.[0] ?? ''}`.toUpperCase() || '?';
        const fullName = `${owner.firstName ?? ''} ${owner.lastName ?? ''}`.trim();
        return (
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <div className='flex min-w-0 items-center gap-2'>
                <Avatar className='h-6 w-6 shrink-0 cursor-default'>
                  <AvatarFallback className='text-[10px]'>{initials}</AvatarFallback>
                </Avatar>
                <span className='truncate text-sm text-muted-foreground'>{fullName}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side='top'>{fullName}</TooltipContent>
          </Tooltip>
        );
      },
      size: 160
    },

    // ── Row actions ───────────────────────────────────────────────────────────
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => (
        <RowActions
          activity={row.original}
          onEdit={onEditActivity}
          onToggleDone={onToggleDone}
          onDelete={(id) => deleteActivity.mutate(id)}
          deleting={deleteActivity.isPending}
        />
      ),
      size: 80
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [enableBulkSelection, sorting, onToggleDone, onEditActivity, deleteActivity.isPending]);

  const table = useReactTable({
    data,
    columns,
    pageCount,
    rowCount: data.length,
    state: {
      pagination,
      sorting,
      columnVisibility,
      columnFilters: activeFilters,
      ...(enableBulkSelection && { rowSelection: bulkSelection })
    },
    getRowId: (row) => row.id,
    onPaginationChange:     onPaginationChange as (updater: Updater<PaginationState>) => void,
    onSortingChange:        onSortingChange    as (updater: Updater<SortingState>)    => void,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange:  setActiveFilters   as (updater: Updater<ColumnFiltersState>) => void,
    ...(enableBulkSelection && {
      enableRowSelection: true,
      onRowSelectionChange: onBulkSelectionChange
    }),
    getCoreRowModel:  getCoreRowModel(),
    manualPagination: true,
    manualSorting:    true,
    manualFiltering:  true
  });

  if (isLoading) {
    return (
      <DataTableSkeleton
        columnCount={enableBulkSelection ? 10 : 9}
        rowCount={8}
        filterCount={2}
        withViewOptions
        withPagination
        cellWidths={['44px', '90px', '1fr', '120px', '120px', '130px', '140px', '160px', '80px']}
      />
    );
  }

  return (
    <div className='flex h-full min-h-0 flex-col gap-3'>

      {/* Toolbar */}
      <div className='flex items-center justify-between gap-2'>
        <div className='flex flex-wrap items-center gap-2'>
          <DataTableFacetedFilter
            column={table.getColumn('type')}
            title='Type'
            options={TYPE_FILTER_OPTIONS}
            multiple
          />
          <DataTableFacetedFilter
            column={table.getColumn('dueAt')}
            title='Due date'
            options={DUE_FILTER_OPTIONS}
            multiple={false}
          />
          {activeFilters.length > 0 && (
            <Button
              variant='ghost'
              size='sm'
              className='h-8 px-2 text-xs text-muted-foreground hover:text-foreground'
              onClick={() => setActiveFilters([])}
            >
              Clear filters
            </Button>
          )}
        </div>
        <DataTableViewOptions table={table} />
      </div>

      {/* Table */}
      <div className='flex-1 min-h-0 overflow-hidden rounded-md border'>
        <ScrollArea className='h-full' scrollbars='both'>
          <Table className='min-w-[1120px]'>
            <TableHeader className='sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60'>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id} className='hover:bg-transparent'>
                  {hg.headers.map((h) => (
                    <TableHead
                      key={h.id}
                      style={{ width: h.getSize() }}
                      className={cn(
                        'text-xs font-medium text-muted-foreground',
                        h.id === 'actions' && 'text-right'
                      )}
                    >
                      {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>

            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() ? 'selected' : undefined}
                    onClick={() => onRowClick?.(row.original)}
                    className={cn(
                      'group cursor-pointer',
                      // Keep selection visually calm like a data grid
                      'data-[state=selected]:bg-muted/60'
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          'py-2.5',
                          cell.column.id === 'actions' && 'text-right'
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow className='hover:bg-transparent'>
                  <TableCell colSpan={columns.length} className='h-32 text-center text-sm text-muted-foreground'>
                    No activities found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      <DataTablePagination table={table} pageSizeOptions={[10, 25, 50, 100]} />
    </div>
  );
}

// ─── RowActions ───────────────────────────────────────────────────────────────

function RowActions({
  activity,
  onEdit,
  onToggleDone,
  onDelete,
  deleting
}: {
  activity: ActivityWithRelations;
  onEdit?: (a: ActivityWithRelations) => void;
  onToggleDone?: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete activity?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { onDelete(activity.id); setConfirmOpen(false); }}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
              disabled={deleting}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className='flex items-center justify-end gap-0.5' onClick={(e) => e.stopPropagation()}>
        {/* Inline Edit — visible on row hover */}
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <Button
              variant='ghost'
              size='icon'
              className='h-7 w-7 opacity-40 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity'
              onClick={() => onEdit?.(activity)}
            >
              <IconEdit className='h-3.5 w-3.5' />
            </Button>
          </TooltipTrigger>
          <TooltipContent side='top'>Edit</TooltipContent>
        </Tooltip>

        {/* More actions menu */}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              variant='ghost'
              size='icon'
              className='h-7 w-7 opacity-40 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity'
            >
              <IconDotsVertical className='h-3.5 w-3.5' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            <DropdownMenuLabel className='text-xs text-muted-foreground font-normal'>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onEdit?.(activity)}>
              <IconEdit className='mr-2 h-3.5 w-3.5' /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onToggleDone?.(activity.id, !activity.done)}>
              <IconCheck className='mr-2 h-3.5 w-3.5' />
              {activity.done ? 'Reopen' : 'Mark done'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className='text-destructive focus:text-destructive'
              onClick={() => setConfirmOpen(true)}
            >
              <IconTrash className='mr-2 h-3.5 w-3.5' /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}
