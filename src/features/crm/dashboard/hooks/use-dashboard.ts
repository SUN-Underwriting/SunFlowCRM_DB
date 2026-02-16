'use client';

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api/crm-client';
import type { ActivityType } from '@prisma/client';

interface DashboardActivity {
  id: string;
  type: ActivityType;
  subject: string;
  createdAt: Date;
  owner?: {
    firstName: string;
    lastName: string;
  };
}

/**
 * Dashboard Query Keys
 * Best Practice (Context7): Centralized query keys for cache management
 */
export const dashboardKeys = {
  all: ['dashboard'] as const,
  kpis: () => [...dashboardKeys.all, 'kpis'] as const,
  dealsByStage: () => [...dashboardKeys.all, 'deals-by-stage'] as const,
  dealsByPipeline: () => [...dashboardKeys.all, 'deals-by-pipeline'] as const,
  recentActivities: () => [...dashboardKeys.all, 'recent-activities'] as const
};

export interface DashboardKPIs {
  totalDeals: number;
  totalValue: number;
  wonDeals: number;
  lostDeals: number;
  openDeals: number;
  newLeads: number;
  conversionRate: number;
  avgDealValue: number;
}

export interface DealsByStage {
  stageName: string;
  stageId: string;
  count: number;
  totalValue: number;
}

export interface DealsByPipeline {
  pipelineName: string;
  pipelineId: string;
  count: number;
  totalValue: number;
}

/**
 * Hook to fetch dashboard KPIs
 */
export function useDashboardKPIs() {
  return useQuery({
    queryKey: dashboardKeys.kpis(),
    queryFn: async () => {
      const response = await apiRequest<DashboardKPIs>('/dashboard/kpis');
      return response.data;
    },
    staleTime: 60 * 1000, // 1 minute
    refetchOnWindowFocus: true
  });
}

/**
 * Hook to fetch deals distribution by stage
 */
export function useDealsByStage() {
  return useQuery({
    queryKey: dashboardKeys.dealsByStage(),
    queryFn: async () => {
      const response = await apiRequest<{ stages: DealsByStage[] }>(
        '/dashboard/deals-by-stage'
      );
      return response.data?.stages ?? [];
    },
    staleTime: 60 * 1000
  });
}

/**
 * Hook to fetch deals distribution by pipeline
 */
export function useDealsByPipeline() {
  return useQuery({
    queryKey: dashboardKeys.dealsByPipeline(),
    queryFn: async () => {
      const response = await apiRequest<{ pipelines: DealsByPipeline[] }>(
        '/dashboard/deals-by-pipeline'
      );
      return response.data?.pipelines ?? [];
    },
    staleTime: 60 * 1000
  });
}

/**
 * Hook to fetch recent activities
 */
export function useRecentActivities(limit: number = 5) {
  return useQuery({
    queryKey: [...dashboardKeys.recentActivities(), limit],
    queryFn: async () => {
      const response = await apiRequest<{ activities: DashboardActivity[] }>(
        `/dashboard/recent-activities?limit=${limit}`
      );
      return response.data?.activities ?? [];
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000 // Refetch every minute
  });
}
