'use client';

import { useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { DealLabelBadge } from './deal-label-badge';
import { useDealLabels } from '../hooks/use-deal-labels';
import type { DealLabel } from '@prisma/client';

interface DealLabelSelectorProps {
  selectedLabels: DealLabel[];
  onLabelsChange: (labels: DealLabel[]) => void;
  className?: string;
}

/**
 * Deal Label Selector Component
 * Multi-select dropdown for choosing deal labels
 */
export function DealLabelSelector({
  selectedLabels,
  onLabelsChange,
  className
}: DealLabelSelectorProps) {
  const [open, setOpen] = useState(false);
  const { data: allLabels = [], isLoading } = useDealLabels();

  const selectedIds = new Set(selectedLabels.map((l) => l.id));

  const toggleLabel = (label: DealLabel) => {
    if (selectedIds.has(label.id)) {
      onLabelsChange(selectedLabels.filter((l) => l.id !== label.id));
    } else {
      onLabelsChange([...selectedLabels, label]);
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 border-dashed"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Label
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search labels..." />
            <CommandList>
              <CommandEmpty>
                {isLoading ? 'Loading...' : 'No labels found.'}
              </CommandEmpty>
              <CommandGroup>
                {allLabels.map((label) => {
                  const isSelected = selectedIds.has(label.id);
                  return (
                    <CommandItem
                      key={label.id}
                      onSelect={() => {
                        toggleLabel(label);
                      }}
                    >
                      <div
                        className={cn(
                          'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary',
                          isSelected
                            ? 'bg-primary text-primary-foreground'
                            : 'opacity-50 [&_svg]:invisible'
                        )}
                      >
                        <Check className="h-4 w-4" />
                      </div>
                      <div
                        className="h-3 w-3 rounded-full mr-2"
                        style={{ backgroundColor: label.color || '#6B7280' }}
                      />
                      <span>{label.name}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedLabels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedLabels.map((label) => (
            <DealLabelBadge
              key={label.id}
              label={label}
              onRemove={() => toggleLabel(label)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
