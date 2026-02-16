'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import type { DealsByStage } from '../hooks/use-dashboard';

interface DealsByStageChartProps {
  data: DealsByStage[];
  isLoading?: boolean;
}

/**
 * Deals by Stage Bar Chart
 * Best Practice (Context7): Recharts with responsive container
 */
export function DealsByStageChart({ data, isLoading }: DealsByStageChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Deals by Stage</CardTitle>
          <CardDescription>
            Distribution of deals across pipeline stages
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='bg-muted h-[300px] animate-pulse rounded' />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Deals by Stage</CardTitle>
          <CardDescription>
            Distribution of deals across pipeline stages
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='text-muted-foreground flex h-[300px] items-center justify-center'>
            No data available
          </div>
        </CardContent>
      </Card>
    );
  }

  // Format data for chart
  const chartData = data.map((stage) => ({
    name: stage.stageName,
    count: stage.count,
    value: stage.totalValue
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Deals by Stage</CardTitle>
        <CardDescription>
          Distribution of deals across pipeline stages
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width='100%' height={300}>
          <BarChart
            data={chartData}
            margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray='3 3' className='stroke-muted' />
            <XAxis
              dataKey='name'
              className='text-xs'
              tick={{ fontSize: 12 }}
              tickLine={false}
            />
            <YAxis
              className='text-xs'
              tick={{ fontSize: 12 }}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px'
              }}
              formatter={(value: number, name: string) => {
                if (name === 'count') return [value, 'Deals'];
                if (name === 'value')
                  return [`$${value.toLocaleString()}`, 'Total Value'];
                return [value, name];
              }}
            />
            <Bar
              dataKey='count'
              fill='hsl(var(--primary))'
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
