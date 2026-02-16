'use client';

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
  type SortingState
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  IconChevronLeft,
  IconChevronRight,
  IconPhone,
  IconMail,
  IconCalendar,
  IconNotes
} from '@tabler/icons-react';
import { format } from 'date-fns';
import type { ActivityWithRelations } from '@/lib/api/crm-types';
import type { ActivityType } from '@prisma/client';

interface ActivitiesTableProps {
  data: ActivityWithRelations[];
  pageCount: number;
  pagination: PaginationState;
  onPaginationChange: React.Dispatch<React.SetStateAction<PaginationState>>;
  sorting: SortingState;
  onSortingChange: React.Dispatch<React.SetStateAction<SortingState>>;
  isLoading?: boolean;
  onToggleDone?: (id: string, done: boolean) => void;
  onRowClick?: (activity: ActivityWithRelations) => void;
}

/**
 * Activity type icons mapping
 */
const activityTypeIcons: Record<ActivityType, any> = {
  CALL: IconPhone,
  EMAIL: IconMail,
  MEETING: IconCalendar,
  TASK: IconNotes
};

/**
 * Activity type colors
 */
const activityTypeColors: Record<ActivityType, string> = {
  CALL: 'bg-blue-500/10 text-blue-700 border-blue-200',
  EMAIL: 'bg-purple-500/10 text-purple-700 border-purple-200',
  MEETING: 'bg-green-500/10 text-green-700 border-green-200',
  TASK: 'bg-orange-500/10 text-orange-700 border-orange-200'
};

/**
 * Activities Table Component
 * Best Practice (Context7): Server-side pagination, sorting with TanStack Table
 */
export function ActivitiesTable({
  data,
  pageCount,
  pagination,
  onPaginationChange,
  sorting,
  onSortingChange,
  isLoading,
  onToggleDone,
  onRowClick
}: ActivitiesTableProps) {
  const columns: ColumnDef<ActivityWithRelations>[] = [
    {
      id: 'done',
      header: '',
      cell: ({ row }) => {
        const activity = row.original;
        return (
          <Checkbox
            checked={activity.done}
            onCheckedChange={(checked) =>
              onToggleDone?.(activity.id, checked as boolean)
            }
            onClick={(e) => e.stopPropagation()}
          />
        );
      },
      size: 40
    },
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ row }) => {
        const type = row.original.type;
        const Icon = activityTypeIcons[type];
        const colorClass = activityTypeColors[type];

        return (
          <Badge variant='outline' className={colorClass}>
            <Icon className='mr-1 h-3 w-3' />
            {type}
          </Badge>
        );
      },
      size: 120
    },
    {
      accessorKey: 'subject',
      header: 'Subject',
      cell: ({ row }) => {
        const activity = row.original;
        return (
          <div className='space-y-1'>
            <div
              className={`font-medium ${activity.done ? 'text-muted-foreground line-through' : ''}`}
            >
              {activity.subject}
            </div>
            {activity.note && (
              <div className='text-muted-foreground line-clamp-1 text-xs'>
                {activity.note}
              </div>
            )}
          </div>
        );
      }
    },
    {
      accessorKey: 'related',
      header: 'Related To',
      cell: ({ row }) => {
        const activity = row.original;
        const related = [];

        if (activity.deal) {
          related.push(`Deal: ${activity.deal.title}`);
        }
        if (activity.person) {
          related.push(
            `${activity.person.firstName} ${activity.person.lastName}`
          );
        }
        if (activity.organization) {
          related.push(activity.organization.name);
        }

        return related.length > 0 ? (
          <div className='space-y-1 text-sm'>
            {related.map((item, idx) => (
              <div key={idx}>{item}</div>
            ))}
          </div>
        ) : (
          <span className='text-muted-foreground'>—</span>
        );
      }
    },
    {
      accessorKey: 'dueAt',
      header: 'Due Date',
      cell: ({ row }) => {
        const dueAt = row.original.dueAt;
        if (!dueAt) return <span className='text-muted-foreground'>—</span>;

        const isPast = new Date(dueAt) < new Date() && !row.original.done;

        return (
          <div
            className={`text-sm ${isPast ? 'text-destructive font-medium' : ''}`}
          >
            {format(new Date(dueAt), 'MMM d, yyyy HH:mm')}
          </div>
        );
      }
    },
    {
      accessorKey: 'owner',
      header: 'Owner',
      cell: ({ row }) => {
        const owner = row.original.owner;
        if (!owner) return <span className='text-muted-foreground'>—</span>;

        const initials =
          `${owner.firstName?.[0] || ''}${owner.lastName?.[0] || ''}`.toUpperCase();

        return (
          <div className='flex items-center gap-2'>
            <Avatar className='h-6 w-6'>
              <AvatarFallback className='text-xs'>{initials}</AvatarFallback>
            </Avatar>
            <span className='text-sm'>{`${owner.firstName} ${owner.lastName}`}</span>
          </div>
        );
      }
    }
  ];

  const table = useReactTable({
    data,
    columns,
    pageCount,
    state: {
      pagination,
      sorting
    },
    onPaginationChange,
    onSortingChange,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true
  });

  if (isLoading) {
    return (
      <div className='space-y-2'>
        {[...Array(5)].map((_, i) => (
          <div key={i} className='bg-muted h-16 animate-pulse rounded' />
        ))}
      </div>
    );
  }

  return (
    <div className='space-y-4'>
      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  onClick={() => onRowClick?.(row.original)}
                  className='hover:bg-muted/50 cursor-pointer'
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className='h-24 text-center'
                >
                  No activities found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className='flex items-center justify-between'>
        <div className='text-muted-foreground text-sm'>
          Page {pagination.pageIndex + 1} of {pageCount || 1}
        </div>
        <div className='flex items-center gap-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={() =>
              onPaginationChange({
                ...pagination,
                pageIndex: pagination.pageIndex - 1
              })
            }
            disabled={pagination.pageIndex === 0}
          >
            <IconChevronLeft className='h-4 w-4' />
            Previous
          </Button>
          <Button
            variant='outline'
            size='sm'
            onClick={() =>
              onPaginationChange({
                ...pagination,
                pageIndex: pagination.pageIndex + 1
              })
            }
            disabled={pagination.pageIndex >= pageCount - 1}
          >
            Next
            <IconChevronRight className='h-4 w-4' />
          </Button>
        </div>
      </div>
    </div>
  );
}
