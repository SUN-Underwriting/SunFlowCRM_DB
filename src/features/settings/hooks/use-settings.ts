'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UserWithDetails,
  InviteUserRequest,
  UpdateUserRequest,
  TenantAuthSettings
} from '../types';
import { toast } from 'sonner';

const API_BASE = '/api/settings';

/**
 * Settings Query Keys
 * Best Practice (Context7): Centralized query keys for cache management
 */
export const settingsKeys = {
  all: ['settings'] as const,
  users: () => [...settingsKeys.all, 'users'] as const,
  auth: () => [...settingsKeys.all, 'auth'] as const
};

/**
 * Generic settings API request handler
 * Handles response unwrapping and error extraction
 */
async function settingsRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    }
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({
      error: { message: 'An error occurred' }
    }));
    throw new Error(
      errorBody.error?.message || errorBody.error || 'An error occurred'
    );
  }

  const json = await response.json();
  return json.data ?? json;
}

// --- Users Hook ---

export function useUsers() {
  return useQuery<UserWithDetails[]>({
    queryKey: settingsKeys.users(),
    queryFn: async () => {
      const result = await settingsRequest<{ users: UserWithDetails[] }>(
        '/users'
      );
      return result.users;
    }
  });
}

export function useInviteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: InviteUserRequest) => {
      return settingsRequest<UserWithDetails>('/users', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      toast.success('User invited successfully');
      queryClient.invalidateQueries({ queryKey: settingsKeys.users() });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data
    }: {
      id: string;
      data: UpdateUserRequest;
    }) => {
      return settingsRequest<UserWithDetails>(`/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      toast.success('User updated successfully');
      queryClient.invalidateQueries({ queryKey: settingsKeys.users() });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });
}

// --- Auth Settings Hook ---

export function useAuthSettings() {
  return useQuery<TenantAuthSettings>({
    queryKey: settingsKeys.auth(),
    queryFn: async () => {
      return settingsRequest<TenantAuthSettings>('/tenant/auth');
    }
  });
}

export function useUpdateAuthSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<TenantAuthSettings>) => {
      return settingsRequest<TenantAuthSettings>('/tenant/auth', {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      toast.success('Settings updated successfully');
      queryClient.invalidateQueries({ queryKey: settingsKeys.auth() });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });
}
