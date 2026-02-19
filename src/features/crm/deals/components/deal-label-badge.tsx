'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { DealLabel } from '@prisma/client';

interface DealLabelBadgeProps {
  label: DealLabel;
  onRemove?: () => void;
  className?: string;
}

/**
 * Deal Label Badge Component
 * Displays a colored badge with optional remove button
 */
export function DealLabelBadge({
  label,
  onRemove,
  className
}: DealLabelBadgeProps) {
  const color = label.color || '#6B7280';

  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 border-0 px-2 py-0.5 text-xs font-medium',
        className
      )}
      style={{
        backgroundColor: `${color}15`,
        color: color
      }}
    >
      <span>{label.name}</span>
      {onRemove && !label.isSystem && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-1 rounded-full hover:bg-black/10"
          aria-label={`Remove ${label.name} label`}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M9 3L3 9M3 3L9 9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </Badge>
  );
}
