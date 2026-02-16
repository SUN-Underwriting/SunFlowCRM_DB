'use client';

import { useQueryStates, parseAsString, parseAsArrayOf } from 'nuqs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { IconSearch, IconX, IconFilter } from '@tabler/icons-react';
import { useDebounce } from '@/hooks/use-debounce';
import { useMemo } from 'react';

/**
 * URL-synced filters parser (nuqs pattern)
 * Best Practice (Context7): URL as source of truth for filters
 */
const filtersParser = {
  q: parseAsString.withDefault(''),
  owner: parseAsArrayOf(parseAsString).withDefault([]),
  status: parseAsArrayOf(parseAsString).withDefault([])
};

interface DealsBoardToolbarProps {
  owners?: Array<{ id: string; name: string }>;
  statuses?: string[];
}

/**
 * Deals Board Toolbar - Search + Filters
 *
 * Best Practices:
 * - URL-synced state with nuqs (shareable links)
 * - Debounced search (300ms)
 * - Filter chips for active filters
 * - One-click reset
 */
export function DealsBoardToolbar({
  owners = [],
  statuses = ['OPEN', 'WON', 'LOST']
}: DealsBoardToolbarProps) {
  const [filters, setFilters] = useQueryStates(filtersParser, {
    shallow: true // Don't trigger server navigation
  });

  // Debounce search to avoid excessive URL updates
  const debouncedSearch = useDebounce(filters.q, 300);

  // Count active filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (debouncedSearch) count++;
    if (filters.owner.length > 0) count++;
    if (filters.status.length > 0) count++;
    return count;
  }, [debouncedSearch, filters.owner.length, filters.status.length]);

  const handleReset = () => {
    setFilters({
      q: '',
      owner: [],
      status: []
    });
  };

  // Helper to get owner name by ID
  const getOwnerName = (id: string) => {
    const owner = owners.find((o) => o.id === id);
    return owner?.name || id;
  };

  return (
    <div className='bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10 mb-4 space-y-3 rounded-lg border p-4 backdrop-blur'>
      <div className='flex flex-col gap-3 md:flex-row md:items-center'>
        {/* Search Input */}
        <div className='relative flex-1 md:max-w-sm'>
          <IconSearch className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
          <Input
            placeholder='Search deals by title, contact...'
            value={filters.q}
            onChange={(e) => setFilters({ q: e.target.value })}
            className='pl-9'
          />
        </div>

        {/* Owner Filter */}
        {owners.length > 0 && (
          <Select
            value={filters.owner[0] || 'all'}
            onValueChange={(value) => {
              setFilters({
                owner: value === 'all' ? [] : [value]
              });
            }}
          >
            <SelectTrigger className='w-full md:w-[180px]'>
              <SelectValue placeholder='All Owners' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All Owners</SelectItem>
              {owners.map((owner) => (
                <SelectItem key={owner.id} value={owner.id}>
                  {owner.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Status Filter */}
        <Select
          value={filters.status[0] || 'all'}
          onValueChange={(value) => {
            setFilters({
              status: value === 'all' ? [] : [value]
            });
          }}
        >
          <SelectTrigger className='w-full md:w-[180px]'>
            <SelectValue placeholder='All Statuses' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All Statuses</SelectItem>
            {statuses.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Reset Button */}
        {activeFiltersCount > 0 && (
          <Button
            variant='ghost'
            size='sm'
            onClick={handleReset}
            className='whitespace-nowrap'
          >
            <IconX className='mr-2 h-4 w-4' />
            Reset ({activeFiltersCount})
          </Button>
        )}
      </div>

      {/* Active Filters Chips */}
      {activeFiltersCount > 0 && (
        <div className='flex flex-wrap items-center gap-2'>
          <IconFilter className='text-muted-foreground h-4 w-4' />
          <span className='text-muted-foreground text-xs font-medium'>
            Active filters:
          </span>

          {debouncedSearch && (
            <Badge variant='secondary' className='gap-1'>
              Search: {debouncedSearch}
              <IconX
                className='h-3 w-3 cursor-pointer'
                onClick={() => setFilters({ q: '' })}
              />
            </Badge>
          )}

          {filters.owner.map((id) => (
            <Badge key={id} variant='secondary' className='gap-1'>
              Owner: {getOwnerName(id)}
              <IconX
                className='h-3 w-3 cursor-pointer'
                onClick={() =>
                  setFilters({ owner: filters.owner.filter((o) => o !== id) })
                }
              />
            </Badge>
          ))}

          {filters.status.map((s) => (
            <Badge key={s} variant='secondary' className='gap-1'>
              Status: {s}
              <IconX
                className='h-3 w-3 cursor-pointer'
                onClick={() =>
                  setFilters({
                    status: filters.status.filter((st) => st !== s)
                  })
                }
              />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
