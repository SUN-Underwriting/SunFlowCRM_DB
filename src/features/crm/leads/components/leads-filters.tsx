'use client';

import { useQueryState, parseAsString } from 'nuqs';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { IconSearch, IconX } from '@tabler/icons-react';
import { useDebounce } from '@/hooks/use-debounce';

import type { LeadStatus } from '@prisma/client';

interface LeadsFiltersProps {
  onFilterChange: (filters: {
    search?: string;
    status?: LeadStatus;
    source?: string;
  }) => void;
}

/**
 * Leads Filters with URL-synced state via nuqs.
 * Search is debounced (300ms) and auto-applied on change.
 * Status and source are applied immediately on change.
 */
export function LeadsFilters({ onFilterChange }: LeadsFiltersProps) {
  const [search, setSearch] = useQueryState('q', parseAsString.withDefault(''));
  const [status, setStatus] = useQueryState(
    'status',
    parseAsString.withDefault('')
  );
  const [source, setSource] = useQueryState(
    'source',
    parseAsString.withDefault('')
  );

  const debouncedSearch = useDebounce(search, 300);

  // Auto-apply on debounced search or dropdown change
  // We use the debounced search but immediate status/source
  const currentFilters = {
    search: debouncedSearch || undefined,
    status: status ? (status as LeadStatus) : undefined,
    source: source || undefined
  };

  const handleApplyFilters = () => {
    onFilterChange(currentFilters);
  };

  const handleClearFilters = () => {
    setSearch('');
    setStatus('');
    setSource('');
    onFilterChange({});
  };

  const hasActiveFilters = search || status || source;

  return (
    <div className='flex flex-wrap items-end gap-4'>
      <div className='min-w-[200px] flex-1'>
        <label className='mb-2 block text-sm font-medium'>Search</label>
        <div className='relative'>
          <IconSearch className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
          <Input
            placeholder='Search leads...'
            value={search}
            onChange={(e) => {
              setSearch(e.target.value || '');
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
            className='pl-9'
          />
        </div>
      </div>

      <div className='w-[180px]'>
        <label className='mb-2 block text-sm font-medium'>Status</label>
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value);
            onFilterChange({
              ...currentFilters,
              status: value ? (value as LeadStatus) : undefined
            });
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder='All statuses' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='NEW'>New</SelectItem>
            <SelectItem value='IN_PROGRESS'>In Progress</SelectItem>
            <SelectItem value='CONVERTED'>Converted</SelectItem>
            <SelectItem value='ARCHIVED'>Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className='w-[180px]'>
        <label className='mb-2 block text-sm font-medium'>Source</label>
        <Select
          value={source}
          onValueChange={(value) => {
            setSource(value);
            onFilterChange({
              ...currentFilters,
              source: value || undefined
            });
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder='All sources' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='WEBSITE'>Website</SelectItem>
            <SelectItem value='REFERRAL'>Referral</SelectItem>
            <SelectItem value='COLD_CALL'>Cold Call</SelectItem>
            <SelectItem value='SOCIAL_MEDIA'>Social Media</SelectItem>
            <SelectItem value='EVENT'>Event</SelectItem>
            <SelectItem value='OTHER'>Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className='flex gap-2'>
        <Button onClick={handleApplyFilters}>Apply Filters</Button>
        {hasActiveFilters && (
          <Button variant='outline' onClick={handleClearFilters}>
            <IconX className='mr-2 h-4 w-4' />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
