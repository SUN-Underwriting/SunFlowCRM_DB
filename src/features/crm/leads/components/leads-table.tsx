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
import type { LeadWithRelations } from '@/lib/api/crm-types';

interface LeadsTableProps {
  data: LeadWithRelations[];
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
  onRowClick?: (lead: LeadWithRelations) => void;
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
    case 'LOST':
      return 'destructive' as const;
    case 'CONVERTED':
      return 'outline' as const;
    case 'ARCHIVED':
      return 'secondary' as const;
    default:
      return 'default' as const;
  }
};

/**
 * Leads Table Component using TanStack Table
 *
 * Best Practices (Context7):
 * - Manual server-side pagination/sorting for performance
 * - Controlled state for external filter integration
 * - Memoized columns for performance
 * - Row selection with checkbox column (Pipedrive pattern)
 */
export function LeadsTable({
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
}: LeadsTableProps) {
  const columns = React.useMemo<ColumnDef<LeadWithRelations>[]>(
    () => [
      // Checkbox column (only if selection enabled)
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
            } as ColumnDef<LeadWithRelations>
          ]
        : []),
      {
        accessorKey: 'title',
        header: 'Title',
        cell: ({ row }) => (
          <div className='flex items-center gap-2'>
            {row.original.wasSeen === false && (
              <span className='h-2 w-2 shrink-0 rounded-full bg-blue-500' />
            )}
            <span className={row.original.wasSeen === false ? 'font-bold' : 'font-medium'}>
              {row.original.title}
            </span>
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
          return <span className='text-muted-foreground'>-</span>;
        }
      },
      {
        accessorKey: 'source',
        header: 'Source',
        cell: ({ row }) => row.original.source || '-'
      },
      {
        id: 'owner',
        header: 'Owner',
        cell: ({ row }) => {
          const { owner } = row.original;
          if (!owner) return <span className='text-muted-foreground'>-</span>;
          const name =
            `${owner.firstName || ''} ${owner.lastName || ''}`.trim();
          return (
            <div>
              <div className='font-medium'>{name || owner.email}</div>
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
        accessorKey: 'createdAt',
        header: 'Created',
        cell: ({ row }) =>
          new Date(row.original.createdAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          })
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
      ...(enableRowSelection && { rowSelection })
    },
    onPaginationChange,
    onSortingChange,
    ...(enableRowSelection && {
      enableRowSelection: true,
      onRowSelectionChange
    }),
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true, // Server-side pagination
    manualSorting: true, // Server-side sorting
    manualFiltering: true // Server-side filtering
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
                  onClick={() => onRowClick?.(row.original)}
                  className={onRowClick ? 'cursor-pointer' : undefined}
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
                  No leads found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      <div className='flex items-center justify-between px-2'>
        <div className='text-muted-foreground text-sm'>
          Page {pagination.pageIndex + 1} of {pageCount}
        </div>
        <div className='flex items-center space-x-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <IconChevronsLeft className='h-4 w-4' />
          </Button>
          <Button
            variant='outline'
            size='sm'
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <IconChevronLeft className='h-4 w-4' />
          </Button>
          <Button
            variant='outline'
            size='sm'
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <IconChevronRight className='h-4 w-4' />
          </Button>
          <Button
            variant='outline'
            size='sm'
            onClick={() => table.setPageIndex(pageCount - 1)}
            disabled={!table.getCanNextPage()}
          >
            <IconChevronsRight className='h-4 w-4' />
          </Button>
        </div>
      </div>
    </div>
  );
}
