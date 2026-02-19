'use client';

import * as React from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type PaginationState,
  type SortingState,
  type RowSelectionState
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight
} from '@tabler/icons-react';
import { DealLabelBadge } from './deal-label-badge';
import type { DealWithRelations } from '@/lib/api/crm-types';
import { format } from 'date-fns';

interface DealsTableProps {
  data: DealWithRelations[];
  pageCount: number;
  pagination: PaginationState;
  onPaginationChange: (
    updater: PaginationState | ((old: PaginationState) => PaginationState)
  ) => void;
  sorting: SortingState;
  onSortingChange: (
    updater: SortingState | ((old: SortingState) => SortingState)
  ) => void;
  isLoading?: boolean;
  onRowClick?: (deal: DealWithRelations) => void;
  enableRowSelection?: boolean;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: (
    updater: RowSelectionState | ((old: RowSelectionState) => RowSelectionState)
  ) => void;
}

const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case 'OPEN':
      return 'default' as const;
    case 'WON':
      return 'default' as const;
    case 'LOST':
      return 'destructive' as const;
    default:
      return 'secondary' as const;
  }
};

const getPriorityColor = (priority?: string | null) => {
  switch (priority) {
    case 'HIGH':
      return 'text-red-600';
    case 'NORMAL':
      return 'text-yellow-600';
    case 'LOW':
      return 'text-gray-600';
    default:
      return '';
  }
};

/**
 * Deals Table Component using TanStack Table
 * 
 * Features:
 * - Server-side pagination/sorting
 * - Priority, Visibility, Source columns
 * - Labels display
 * - Row selection
 */
export function DealsTable({
  data,
  pageCount,
  pagination,
  onPaginationChange,
  sorting,
  onSortingChange,
  isLoading,
  onRowClick,
  enableRowSelection = false,
  rowSelection = {},
  onRowSelectionChange
}: DealsTableProps) {
  const columns = React.useMemo<ColumnDef<DealWithRelations>[]>(
    () => [
      // Checkbox column
      ...(enableRowSelection
        ? [
            {
              id: 'select',
              header: ({ table }: any) => (
                <Checkbox
                  checked={table.getIsAllPageRowsSelected()}
                  onCheckedChange={(value: boolean) =>
                    table.toggleAllPageRowsSelected(!!value)
                  }
                  aria-label='Select all'
                />
              ),
              cell: ({ row }: any) => (
                <Checkbox
                  checked={row.getIsSelected()}
                  onCheckedChange={(value: boolean) =>
                    row.toggleSelected(!!value)
                  }
                  aria-label='Select row'
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                />
              ),
              size: 40,
              enableSorting: false,
              enableHiding: false
            } as ColumnDef<DealWithRelations>
          ]
        : []),
      {
        accessorKey: 'title',
        header: 'Title',
        cell: ({ row }) => (
          <div className='flex items-center gap-2'>
            <span className='font-medium'>{row.original.title}</span>
          </div>
        )
      },
      {
        id: 'contact',
        header: 'Contact',
        cell: ({ row }) => {
          const { person, organization } = row.original;
          if (person) {
            return (
              <div>
                <div className='font-medium'>
                  {person.firstName} {person.lastName}
                </div>
                {person.email && (
                  <div className='text-muted-foreground text-sm'>
                    {person.email}
                  </div>
                )}
              </div>
            );
          }
          if (organization) {
            return <div className='font-medium'>{organization.name}</div>;
          }
          return <span className='text-muted-foreground'>—</span>;
        }
      },
      {
        accessorKey: 'value',
        header: 'Value',
        cell: ({ row }) => {
          const value = row.original.value;
          const currency = row.original.currency || 'USD';
          return (
            <div className='font-medium'>
              {value
                ? new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency
                  }).format(Number(value))
                : '—'}
            </div>
          );
        }
      },
      {
        accessorKey: 'stage',
        header: 'Stage',
        cell: ({ row }) => (
          <Badge variant='outline'>{row.original.stage?.name || '—'}</Badge>
        )
      },
      {
        accessorKey: 'priority',
        header: 'Priority',
        cell: ({ row }) => {
          const priority = row.original.priority;
          if (!priority) return <span className='text-muted-foreground'>—</span>;
          return (
            <Badge
              variant='outline'
              className={getPriorityColor(priority)}
            >
              {priority}
            </Badge>
          );
        }
      },
      {
        accessorKey: 'visibility',
        header: 'Visibility',
        cell: ({ row }) => {
          const visibility = row.original.visibility || 'COMPANY';
          return (
            <Badge variant='secondary' className='text-xs'>
              {visibility}
            </Badge>
          );
        }
      },
      {
        accessorKey: 'source',
        header: 'Source',
        cell: ({ row }) => (
          <span className='text-sm'>
            {row.original.source || <span className='text-muted-foreground'>—</span>}
          </span>
        )
      },
      {
        id: 'labels',
        header: 'Labels',
        cell: ({ row }) => {
          const labels = row.original.labelLinks || [];
          if (labels.length === 0) {
            return <span className='text-muted-foreground'>—</span>;
          }
          return (
            <div className='flex flex-wrap gap-1'>
              {labels.slice(0, 2).map((link) => (
                <DealLabelBadge key={link.id} label={link.label} />
              ))}
              {labels.length > 2 && (
                <Badge variant='outline' className='text-xs'>
                  +{labels.length - 2}
                </Badge>
              )}
            </div>
          );
        }
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={getStatusBadgeVariant(row.original.status)}>
            {row.original.status}
          </Badge>
        )
      },
      {
        accessorKey: 'owner',
        header: 'Owner',
        cell: ({ row }) => {
          const owner = row.original.owner;
          return (
            <div className='text-sm'>
              {owner
                ? `${owner.firstName || ''} ${owner.lastName || ''}`.trim() ||
                  owner.email
                : '—'}
            </div>
          );
        }
      },
      {
        accessorKey: 'expectedCloseDate',
        header: 'Close Date',
        cell: ({ row }) =>
          row.original.expectedCloseDate ? (
            <span className='text-sm'>
              {format(new Date(row.original.expectedCloseDate), 'MMM d, yyyy')}
            </span>
          ) : (
            <span className='text-muted-foreground'>—</span>
          )
      }
    ],
    [enableRowSelection]
  );

  const table = useReactTable({
    data,
    columns,
    pageCount,
    state: {
      pagination,
      sorting,
      rowSelection
    },
    enableRowSelection,
    onPaginationChange,
    onSortingChange,
    onRowSelectionChange,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true
  });

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
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className='h-24 text-center'
                >
                  Loading...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  onClick={() => onRowClick?.(row.original)}
                  className='cursor-pointer'
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
                  No deals found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className='flex items-center justify-between px-2'>
        <div className='text-muted-foreground text-sm'>
          {enableRowSelection && (
            <span>
              {table.getFilteredSelectedRowModel().rows.length} of{' '}
              {table.getFilteredRowModel().rows.length} row(s) selected.
            </span>
          )}
        </div>
        <div className='flex items-center space-x-6 lg:space-x-8'>
          <div className='flex items-center space-x-2'>
            <p className='text-sm font-medium'>Page</p>
            <p className='text-sm font-medium'>
              {pagination.pageIndex + 1} of {pageCount || 1}
            </p>
          </div>
          <div className='flex items-center space-x-2'>
            <Button
              variant='outline'
              size='icon'
              className='h-8 w-8'
              onClick={() =>
                onPaginationChange({ ...pagination, pageIndex: 0 })
              }
              disabled={pagination.pageIndex === 0}
            >
              <IconChevronsLeft className='h-4 w-4' />
            </Button>
            <Button
              variant='outline'
              size='icon'
              className='h-8 w-8'
              onClick={() =>
                onPaginationChange({
                  ...pagination,
                  pageIndex: pagination.pageIndex - 1
                })
              }
              disabled={pagination.pageIndex === 0}
            >
              <IconChevronLeft className='h-4 w-4' />
            </Button>
            <Button
              variant='outline'
              size='icon'
              className='h-8 w-8'
              onClick={() =>
                onPaginationChange({
                  ...pagination,
                  pageIndex: pagination.pageIndex + 1
                })
              }
              disabled={pagination.pageIndex >= pageCount - 1}
            >
              <IconChevronRight className='h-4 w-4' />
            </Button>
            <Button
              variant='outline'
              size='icon'
              className='h-8 w-8'
              onClick={() =>
                onPaginationChange({
                  ...pagination,
                  pageIndex: pageCount - 1
                })
              }
              disabled={pagination.pageIndex >= pageCount - 1}
            >
              <IconChevronsRight className='h-4 w-4' />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
