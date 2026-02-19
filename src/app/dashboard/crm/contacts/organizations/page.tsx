'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { IconPlus, IconSearch, IconBuilding } from '@tabler/icons-react';
import { OrganizationsTable } from '@/features/crm/contacts/components/organizations-table';
import { OrganizationFormDialog } from '@/features/crm/contacts/components/organization-form-dialog';
import { useOrganizations } from '@/features/crm/contacts/hooks/use-organizations';
import type { PaginationState, SortingState } from '@tanstack/react-table';
import {
  useQueryStates,
  parseAsInteger,
  parseAsString,
  parseAsBoolean
} from 'nuqs';

/**
 * Organizations Page
 * Server-side pagination + filtering with React Query + debounced search
 */
export default function OrganizationsPage() {
  const router = useRouter();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // URL-synced state with nuqs
  const [urlState, setUrlState] = useQueryStates(
    {
      q: parseAsString.withDefault(''),
      page: parseAsInteger.withDefault(0),
      pageSize: parseAsInteger.withDefault(10),
      sortBy: parseAsString.withDefault('name'),
      sortDesc: parseAsBoolean.withDefault(false)
    },
    {
      history: 'replace',
      shallow: true
    }
  );

  // Local search state for debouncing
  const [searchInput, setSearchInput] = useState(urlState.q);

  // Debounce search: update URL after typing stops
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== urlState.q) {
        setUrlState({ q: searchInput, page: 0 }); // Reset page on search
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Sync pagination state with URL
  const pagination: PaginationState = {
    pageIndex: urlState.page,
    pageSize: urlState.pageSize
  };

  // Sync sorting state with URL
  const sorting: SortingState = urlState.sortBy
    ? [{ id: urlState.sortBy, desc: urlState.sortDesc }]
    : [];

  const { data, isLoading, error } = useOrganizations({
    search: urlState.q,
    skip: urlState.page * urlState.pageSize,
    take: urlState.pageSize,
    sortBy: urlState.sortBy,
    sortDesc: urlState.sortDesc
  });

  const organizations = data?.organizations || [];
  const total = data?.total || 0;
  const pageCount = Math.ceil(total / urlState.pageSize);

  return (
    <div className='flex-1 space-y-4 p-4 pt-6 md:p-8'>
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-3xl font-bold tracking-tight'>Organizations</h2>
          <p className='text-muted-foreground'>
            Manage your organizations and companies
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <IconPlus className='mr-2 h-4 w-4' />
          Add Organization
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle>All Organizations</CardTitle>
              <CardDescription>
                A list of all organizations in your CRM
              </CardDescription>
            </div>
            <div className='relative w-72'>
              <IconSearch className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
              <Input
                placeholder='Search organizations...'
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
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
                : 'Failed to load organizations'}
            </div>
          ) : !isLoading && organizations.length === 0 && !urlState.q ? (
            <div className='flex flex-col items-center justify-center py-16 text-center'>
              <IconBuilding className='text-muted-foreground/50 mb-4 h-12 w-12' />
              <h3 className='text-lg font-semibold'>No organizations yet</h3>
              <p className='text-muted-foreground mt-1 max-w-sm text-sm'>
                Get started by adding your first organization to the CRM.
              </p>
              <Button
                className='mt-4'
                onClick={() => setCreateDialogOpen(true)}
              >
                <IconPlus className='mr-2 h-4 w-4' />
                Add First Organization
              </Button>
            </div>
          ) : (
            <OrganizationsTable
              data={organizations}
              pageCount={pageCount}
              pagination={pagination}
              onPaginationChange={(updater) => {
                const newPagination =
                  typeof updater === 'function' ? updater(pagination) : updater;
                setUrlState({
                  page: newPagination.pageIndex,
                  pageSize: newPagination.pageSize
                });
              }}
              sorting={sorting}
              onSortingChange={(updater) => {
                const newSorting =
                  typeof updater === 'function' ? updater(sorting) : updater;
                const firstSort = newSorting[0];
                if (firstSort) {
                  setUrlState({
                    sortBy: firstSort.id,
                    sortDesc: firstSort.desc
                  });
                } else {
                  setUrlState({ sortBy: 'name', sortDesc: false });
                }
              }}
              isLoading={isLoading}
              onRowClick={(org) =>
                router.push(`/dashboard/crm/contacts/organizations/${org.id}`)
              }
            />
          )}
        </CardContent>
      </Card>

      <OrganizationFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  );
}
