'use client';

import { useUsers, useUpdateUser } from '../../hooks/use-settings';
import { columns } from './users-columns';
import { DataTable } from '@/components/ui/table/data-table';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  SortingState,
  ColumnFiltersState,
  VisibilityState
} from '@tanstack/react-table';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { UserRole, UserStatus } from '@prisma/client';

interface UsersTableProps {
  filter?: string;
}

export function UsersTable({ filter }: UsersTableProps) {
  const { data: users = [], isLoading } = useUsers();
  const { mutate: updateUser } = useUpdateUser();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});

  const handleUpdateRole = (id: string, role: UserRole) => {
    updateUser({ id, data: { role } });
  };

  const handleUpdateStatus = (id: string, status: UserStatus) => {
    updateUser({ id, data: { status } });
  };

  const handleUpdatePermissions = (
    id: string,
    permissions: Record<string, unknown>
  ) => {
    updateUser({ id, data: { permissions } });
  };

  const tableColumns = columns(
    handleUpdateRole,
    handleUpdateStatus,
    handleUpdatePermissions
  );

  const table = useReactTable({
    data: users,
    columns: tableColumns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection
    }
  });

  if (isLoading) {
    return <div className='bg-muted/20 h-48 w-full animate-pulse rounded-md' />;
  }

  return (
    <div className='space-y-4'>
      <div className='flex items-center py-4'>
        <Input
          placeholder='Filter emails...'
          value={(table.getColumn('email')?.getFilterValue() as string) ?? ''}
          onChange={(event) =>
            table.getColumn('email')?.setFilterValue(event.target.value)
          }
          className='max-w-sm'
        />
      </div>
      <DataTable table={table} className='h-[560px]' />
    </div>
  );
}
