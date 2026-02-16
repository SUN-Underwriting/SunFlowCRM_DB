'use client';

import { useState } from 'react';
import { type PaginationState, type SortingState } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { IconPlus, IconTarget } from '@tabler/icons-react';
import { CreateLeadDialog } from '@/features/crm/leads/components/create-lead-dialog';
import { LeadsFilters } from '@/features/crm/leads/components/leads-filters';
import { LeadsTable } from '@/features/crm/leads/components/leads-table';
import { LeadDetailSheet } from '@/features/crm/leads/components/lead-detail-sheet';
import {
  useLeads,
  type LeadsFilters as ILeadsFilters
} from '@/features/crm/leads/hooks/use-leads';
import type { LeadStatus } from '@prisma/client';

/**
 * Leads Page - CRM Lead Management
 *
 * Best Practices (Context7):
 * - Server-side data fetching with React Query
 * - URL-synced pagination and filtering
 * - Optimistic updates for better UX
 */
export default function LeadsPage() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10
  });
  const [sorting, setSorting] = useState<SortingState>([]);
  const [filters, setFilters] = useState<{
    search?: string;
    status?: LeadStatus;
    source?: string;
  }>({});

  // Prepare filters for API
  const apiFilters: ILeadsFilters = {
    ...filters,
    skip: pagination.pageIndex * pagination.pageSize,
    take: pagination.pageSize
  };

  // Fetch leads with React Query
  const { data, isLoading, error } = useLeads(apiFilters);

  const leads = data?.leads || [];
  const total = data?.total || 0;
  const pageCount = Math.ceil(total / pagination.pageSize);

  return (
    <div className='flex-1 space-y-4 p-4 pt-6 md:p-8'>
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-3xl font-bold tracking-tight'>Leads</h2>
          <p className='text-muted-foreground'>
            Manage your sales leads and convert them to deals
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <IconPlus className='mr-2 h-4 w-4' />
          Add Lead
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Filter leads by search, status, and source
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LeadsFilters
            onFilterChange={(newFilters) => {
              setFilters(newFilters);
              // Reset to first page when filters change
              setPagination((prev) => ({ ...prev, pageIndex: 0 }));
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Leads</CardTitle>
          <CardDescription>
            {isLoading
              ? 'Loading...'
              : `${total} lead${total !== 1 ? 's' : ''} found`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className='text-destructive py-8 text-center'>
              {error instanceof Error ? error.message : 'Failed to load leads'}
            </div>
          ) : !isLoading &&
            leads.length === 0 &&
            !filters.search &&
            !filters.status &&
            !filters.source ? (
            <div className='flex flex-col items-center justify-center py-16 text-center'>
              <IconTarget className='text-muted-foreground/50 mb-4 h-12 w-12' />
              <h3 className='text-lg font-semibold'>No leads yet</h3>
              <p className='text-muted-foreground mt-1 max-w-sm text-sm'>
                Create your first lead to start building your sales pipeline.
              </p>
              <Button
                className='mt-4'
                onClick={() => setCreateDialogOpen(true)}
              >
                <IconPlus className='mr-2 h-4 w-4' />
                Add First Lead
              </Button>
            </div>
          ) : (
            <LeadsTable
              data={leads}
              pageCount={pageCount}
              pagination={pagination}
              onPaginationChange={setPagination}
              sorting={sorting}
              onSortingChange={setSorting}
              isLoading={isLoading}
              onRowClick={(lead) => {
                setSelectedLeadId(lead.id);
                setDetailSheetOpen(true);
              }}
            />
          )}
        </CardContent>
      </Card>

      <CreateLeadDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      <LeadDetailSheet
        leadId={selectedLeadId}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
      />
    </div>
  );
}
