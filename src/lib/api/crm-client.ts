/**
 * Type-safe API client for CRM endpoints
 */

import {
  OrganizationWithRelations,
  PersonWithRelations,
  LeadWithRelations,
  DealWithRelations,
  PipelineWithRelations,
  StageWithRelations,
  ActivityWithRelations,
  EmailWithRelations,
  PipelineWithDealsResponse,
  LeadConvertResponse,
  DeleteResponse
} from './crm-types';

// Base API configuration
const API_BASE = '/api/crm';

/**
 * Generic API request handler
 * Exported for use in other modules (e.g., dashboard)
 * Context7: Improved error extraction with status code and field errors
 */
export async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<{ data: T }> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({
      error: { message: `Request failed with status ${response.status}` }
    }));

    // Extract error message with fallback hierarchy
    const message =
      errorData.error?.message ||
      errorData.message ||
      `Request failed with status ${response.status}`;

    // Create error with status and field details if available
    const error = new Error(message) as Error & {
      status?: number;
      fields?: Record<string, string[]>;
    };
    error.status = response.status;

    // Attach field errors if present (validation errors)
    if (errorData.error?.fields) {
      error.fields = errorData.error.fields;
    }

    throw error;
  }

  return response.json();
}

// Organizations API
export const organizationsApi = {
  list: (params?: {
    search?: string;
    industry?: string;
    size?: string;
    skip?: number;
    take?: number;
  }) => {
    const query = new URLSearchParams(
      Object.entries(params || {})
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    );
    return apiRequest<{
      organizations: OrganizationWithRelations[];
      total: number;
    }>(`/organizations?${query}`);
  },
  getById: (id: string) =>
    apiRequest<OrganizationWithRelations>(`/organizations/${id}`),
  create: (data: Partial<OrganizationWithRelations>) =>
    apiRequest<OrganizationWithRelations>('/organizations', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  update: (id: string, data: Partial<OrganizationWithRelations>) =>
    apiRequest<OrganizationWithRelations>(`/organizations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),
  delete: (id: string) =>
    apiRequest<{ success: boolean }>(`/organizations/${id}`, {
      method: 'DELETE'
    })
};

// Persons API
export const personsApi = {
  list: (params?: {
    search?: string;
    orgId?: string;
    skip?: number;
    take?: number;
  }) => {
    const query = new URLSearchParams(
      Object.entries(params || {})
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    );
    return apiRequest<{
      persons: PersonWithRelations[];
      total: number;
    }>(`/persons?${query}`);
  },
  getById: (id: string) => apiRequest<PersonWithRelations>(`/persons/${id}`),
  create: (data: Partial<PersonWithRelations>) =>
    apiRequest<PersonWithRelations>('/persons', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  update: (id: string, data: Partial<PersonWithRelations>) =>
    apiRequest<PersonWithRelations>(`/persons/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),
  delete: (id: string) =>
    apiRequest<{ success: boolean }>(`/persons/${id}`, {
      method: 'DELETE'
    })
};

// Leads API
export const leadsApi = {
  list: (params?: {
    status?: string;
    source?: string;
    ownerId?: string;
    search?: string;
    skip?: number;
    take?: number;
  }) => {
    const query = new URLSearchParams(
      Object.entries(params || {})
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    );
    return apiRequest<{
      leads: LeadWithRelations[];
      total: number;
    }>(`/leads?${query}`);
  },
  getById: (id: string) => apiRequest<LeadWithRelations>(`/leads/${id}`),
  create: (data: Partial<LeadWithRelations>) =>
    apiRequest<LeadWithRelations>('/leads', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  update: (id: string, data: Partial<LeadWithRelations>) =>
    apiRequest<LeadWithRelations>(`/leads/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),
  delete: (id: string) =>
    apiRequest<{ success: boolean }>(`/leads/${id}`, {
      method: 'DELETE'
    }),
  convert: (id: string, data: Record<string, unknown>) =>
    apiRequest<{ deal: DealWithRelations; lead: LeadWithRelations }>(
      `/leads/${id}/convert`,
      {
        method: 'POST',
        body: JSON.stringify(data)
      }
    )
};

// Deals API
export const dealsApi = {
  list: (params?: {
    pipelineId?: string;
    stageId?: string;
    ownerId?: string;
    status?: string;
    search?: string;
    skip?: number;
    take?: number;
  }) => {
    const query = new URLSearchParams(
      Object.entries(params || {})
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    );
    return apiRequest<{
      deals: DealWithRelations[];
      total: number;
    }>(`/deals?${query}`);
  },
  getById: (id: string) => apiRequest<DealWithRelations>(`/deals/${id}`),
  getByPipeline: (pipelineId: string) =>
    apiRequest<{
      pipeline: PipelineWithRelations;
      stages: StageWithRelations[];
      deals: DealWithRelations[];
    }>(`/pipelines/${pipelineId}/deals`),
  create: (data: Partial<DealWithRelations>) =>
    apiRequest<DealWithRelations>('/deals', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  update: (id: string, data: Partial<DealWithRelations>) =>
    apiRequest<DealWithRelations>(`/deals/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),
  delete: (id: string) =>
    apiRequest<{ success: boolean }>(`/deals/${id}`, {
      method: 'DELETE'
    }),
  moveToStage: (id: string, stageId: string) =>
    apiRequest<DealWithRelations>(`/deals/${id}/move`, {
      method: 'POST',
      body: JSON.stringify({ stageId })
    })
};

// Pipelines API
export const pipelinesApi = {
  list: () => apiRequest<{ pipelines: PipelineWithRelations[] }>('/pipelines'),
  getById: (id: string) =>
    apiRequest<PipelineWithRelations>(`/pipelines/${id}`),
  create: (data: Partial<PipelineWithRelations>) =>
    apiRequest<PipelineWithRelations>('/pipelines', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  update: (id: string, data: Partial<PipelineWithRelations>) =>
    apiRequest<PipelineWithRelations>(`/pipelines/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),
  delete: (id: string) =>
    apiRequest<{ success: boolean }>(`/pipelines/${id}`, {
      method: 'DELETE'
    }),
  getStages: (id: string) =>
    apiRequest<{ stages: StageWithRelations[] }>(`/pipelines/${id}/stages`)
};

// Activities API
export const activitiesApi = {
  list: (params?: {
    type?: string;
    done?: boolean;
    ownerId?: string;
    dealId?: string;
    personId?: string;
    skip?: number;
    take?: number;
  }) => {
    const query = new URLSearchParams(
      Object.entries(params || {})
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    );
    return apiRequest<{
      activities: ActivityWithRelations[];
      total: number;
    }>(`/activities?${query}`);
  },
  getById: (id: string) =>
    apiRequest<ActivityWithRelations>(`/activities/${id}`),
  create: (data: Partial<ActivityWithRelations>) =>
    apiRequest<ActivityWithRelations>('/activities', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  update: (id: string, data: Partial<ActivityWithRelations>) =>
    apiRequest<ActivityWithRelations>(`/activities/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),
  delete: (id: string) =>
    apiRequest<{ success: boolean }>(`/activities/${id}`, {
      method: 'DELETE'
    })
};

// Stages API
export const stagesApi = {
  listByPipeline: (pipelineId: string) =>
    apiRequest<StageWithRelations[]>(`/stages?pipelineId=${pipelineId}`),
  getById: (id: string) => apiRequest<StageWithRelations>(`/stages/${id}`),
  create: (data: Partial<StageWithRelations>) =>
    apiRequest<StageWithRelations>('/stages', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  update: (id: string, data: Partial<StageWithRelations>) =>
    apiRequest<StageWithRelations>(`/stages/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),
  delete: (id: string) =>
    apiRequest<{ success: boolean }>(`/stages/${id}`, {
      method: 'DELETE'
    })
};

// Emails API
export const emailsApi = {
  list: (params?: {
    direction?: string;
    dealId?: string;
    personId?: string;
    threadId?: string;
    search?: string;
    skip?: number;
    take?: number;
  }) => {
    const query = new URLSearchParams(
      Object.entries(params || {})
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    );
    return apiRequest<{
      emails: EmailWithRelations[];
      total: number;
    }>(`/emails?${query}`);
  },
  getById: (id: string) => apiRequest<EmailWithRelations>(`/emails/${id}`),
  create: (data: Partial<EmailWithRelations>) =>
    apiRequest<EmailWithRelations>('/emails', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  delete: (id: string) =>
    apiRequest<{ success: boolean }>(`/emails/${id}`, {
      method: 'DELETE'
    })
};

// Field Definitions API
export const fieldDefinitionsApi = {
  list: (params?: { entityType?: string }) => {
    const query = new URLSearchParams(
      Object.entries(params || {})
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    );
    return apiRequest<{ fieldDefinitions: any[] }>(
      `/field-definitions?${query}`
    );
  },
  getById: (id: string) => apiRequest<any>(`/field-definitions/${id}`),
  create: (data: any) =>
    apiRequest<any>('/field-definitions', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  update: (id: string, data: any) =>
    apiRequest<any>(`/field-definitions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),
  delete: (id: string) =>
    apiRequest<{ success: boolean }>(`/field-definitions/${id}`, {
      method: 'DELETE'
    })
};
