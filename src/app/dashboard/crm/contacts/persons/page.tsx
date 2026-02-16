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
import { Input } from '@/components/ui/input';
import { IconPlus, IconSearch, IconUsers } from '@tabler/icons-react';
import { PersonsTable } from '@/features/crm/contacts/components/persons-table';
import { PersonFormDialog } from '@/features/crm/contacts/components/person-form-dialog';
import { usePersons } from '@/features/crm/contacts/hooks/use-persons';
import { useDebounce } from '@/hooks/use-debounce';
import type { PaginationState, SortingState } from '@tanstack/react-table';

/**
 * Persons Page
 * Server-side pagination + filtering with React Query + debounced search
 */
export default function PersonsPage() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10
  });
  const [sorting, setSorting] = useState<SortingState>([]);

  const { data, isLoading, error } = usePersons({
    search: debouncedSearch,
    skip: pagination.pageIndex * pagination.pageSize,
    take: pagination.pageSize
  });

  const persons = data?.persons || [];
  const total = data?.total || 0;
  const pageCount = Math.ceil(total / pagination.pageSize);

  return (
    <div className='flex-1 space-y-4 p-4 pt-6 md:p-8'>
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-3xl font-bold tracking-tight'>Contacts</h2>
          <p className='text-muted-foreground'>
            Manage your contacts and their information
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <IconPlus className='mr-2 h-4 w-4' />
          Add Contact
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle>All Contacts</CardTitle>
              <CardDescription>
                A list of all contacts in your CRM
              </CardDescription>
            </div>
            <div className='relative w-72'>
              <IconSearch className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
              <Input
                placeholder='Search contacts...'
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPagination((prev) => ({ ...prev, pageIndex: 0 }));
                }}
                className='pl-9'
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className='text-destructive py-12 text-center'>
              {error instanceof Error
                ? error.message
                : 'Failed to load contacts'}
            </div>
          ) : !isLoading && persons.length === 0 && !debouncedSearch ? (
            <div className='flex flex-col items-center justify-center py-16 text-center'>
              <IconUsers className='text-muted-foreground/50 mb-4 h-12 w-12' />
              <h3 className='text-lg font-semibold'>No contacts yet</h3>
              <p className='text-muted-foreground mt-1 max-w-sm text-sm'>
                Get started by adding your first contact to the CRM.
              </p>
              <Button
                className='mt-4'
                onClick={() => setCreateDialogOpen(true)}
              >
                <IconPlus className='mr-2 h-4 w-4' />
                Add First Contact
              </Button>
            </div>
          ) : (
            <PersonsTable
              data={persons}
              pageCount={pageCount}
              pagination={pagination}
              onPaginationChange={setPagination}
              sorting={sorting}
              onSortingChange={setSorting}
              isLoading={isLoading}
            />
          )}
        </CardContent>
      </Card>

      <PersonFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  );
}
