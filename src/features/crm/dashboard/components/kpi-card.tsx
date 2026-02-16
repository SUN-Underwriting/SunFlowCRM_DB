import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  isLoading?: boolean;
}

/**
 * KPI Card Component
 * Best Practice: Reusable metric display with optional trend indicator
 */
export function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  isLoading
}: KPICardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
          <CardTitle className='text-sm font-medium'>{title}</CardTitle>
          <Icon className='text-muted-foreground h-4 w-4' />
        </CardHeader>
        <CardContent>
          <div className='bg-muted h-7 w-20 animate-pulse rounded' />
          {subtitle && (
            <div className='bg-muted mt-1 h-3 w-32 animate-pulse rounded' />
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <CardTitle className='text-sm font-medium'>{title}</CardTitle>
        <Icon className='text-muted-foreground h-4 w-4' />
      </CardHeader>
      <CardContent>
        <div className='text-2xl font-bold'>{value}</div>
        {subtitle && (
          <p className='text-muted-foreground text-xs'>{subtitle}</p>
        )}
        {trend && (
          <div className='mt-1 flex items-center gap-1'>
            <span
              className={cn(
                'text-xs font-medium',
                trend.isPositive ? 'text-green-600' : 'text-red-600'
              )}
            >
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
            </span>
            <span className='text-muted-foreground text-xs'>
              from last month
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
