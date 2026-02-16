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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  IconChevronLeft,
  IconChevronRight,
  IconPhone,
  IconWorld,
  IconBuilding
} from '@tabler/icons-react';
import type { OrganizationWithRelations } from '@/lib/api/crm-types';

interface OrganizationsTableProps {
  data: OrganizationWithRelations[];
  pageCount: number;
  pagination: PaginationState;
  onPaginationChange: React.Dispatch<React.SetStateAction<PaginationState>>;
  sorting: SortingState;
  onSortingChange: React.Dispatch<React.SetStateAction<SortingState>>;
  isLoading?: boolean;
  onRowClick?: (organization: OrganizationWithRelations) => void;
}

/**
 * Organizations Table Component
 * Best Practice (Context7): Server-side pagination, sorting, filtering with TanStack Table
 */
export function OrganizationsTable({
  data,
  pageCount,
  pagination,
  onPaginationChange,
  sorting,
  onSortingChange,
  isLoading,
  onRowClick
}: OrganizationsTableProps) {
  const columns: ColumnDef<OrganizationWithRelations>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => {
        const org = row.original;
        const initials = org.name
          .split(' ')
          .map((word) => word[0])
          .join('')
          .toUpperCase()
          .slice(0, 2);

        return (
          <div className='flex items-center gap-3'>
            <Avatar className='h-8 w-8'>
              <AvatarFallback className='text-xs'>
                {initials || <IconBuilding className='h-4 w-4' />}
              </AvatarFallback>
            </Avatar>
            <span className='font-medium'>{org.name}</span>
          </div>
        );
      }
    },
    {
      accessorKey: 'industry',
      header: 'Industry',
      cell: ({ row }) => {
        const industry = row.original.industry;
        return industry ? (
          <Badge variant='secondary'>{industry}</Badge>
        ) : (
          <span className='text-muted-foreground'>—</span>
        );
      }
    },
    {
      accessorKey: 'size',
      header: 'Size',
      cell: ({ row }) => {
        const size = row.original.size;
        return size ? (
          <span className='text-sm'>{size}</span>
        ) : (
          <span className='text-muted-foreground'>—</span>
        );
      }
    },
    {
      accessorKey: 'website',
      header: 'Website',
      cell: ({ row }) => {
        const website = row.original.website;
        if (!website) return <span className='text-muted-foreground'>—</span>;

        return (
          <div className='flex items-center gap-2'>
            <IconWorld className='text-muted-foreground h-4 w-4' />
            <a
              href={website}
              target='_blank'
              rel='noopener noreferrer'
              className='text-primary text-sm hover:underline'
              onClick={(e) => e.stopPropagation()}
            >
              {website.replace(/^https?:\/\//, '')}
            </a>
          </div>
        );
      }
    },
    {
      accessorKey: 'phone',
      header: 'Phone',
      cell: ({ row }) => {
        const phone = row.original.phone;
        if (!phone) return <span className='text-muted-foreground'>—</span>;

        return (
          <div className='flex items-center gap-2'>
            <IconPhone className='text-muted-foreground h-4 w-4' />
            <span className='text-sm'>{phone}</span>
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
          <div key={i} className='bg-muted h-12 animate-pulse rounded' />
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
                  data-state={row.getIsSelected() && 'selected'}
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
                  No organizations found.
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
