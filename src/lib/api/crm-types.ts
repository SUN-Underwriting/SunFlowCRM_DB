/**
 * Type definitions for CRM API responses
 * Based on Prisma models with API-specific fields
 */

import {
  Organization,
  Person,
  Lead,
  Deal,
  Pipeline,
  Stage,
  Activity,
  Email,
  FieldDefinition,
  Note,
  LeadLabel,
  LeadLabelLink,
  DealLabel,
  DealLabelLink,
  DealVisibility,
  DealPriority
} from '@prisma/client';

// Re-export enums for convenience
export type { DealVisibility, DealPriority };

// Base list response type
export interface ListResponse<T> {
  data: T[];
  total: number;
}

// Extended types with relations (as returned by API)
// Note: Using Omit to replace Decimal with number for JSON serialization
export interface OrganizationWithRelations extends Organization {
  persons?: Person[];
  deals?: (Deal & { stage?: Stage | null; pipeline?: Pipeline | null })[];
  _count?: {
    persons?: number;
    deals?: number;
    activities?: number;
    emails?: number;
  };
}

export interface PersonWithRelations extends Person {
  organization?: Organization | null;
  _count?: {
    deals?: number;
    activities?: number;
  };
}

export interface LeadLabelWithLink extends LeadLabelLink {
  label: LeadLabel;
}

export interface DealLabelWithLink extends DealLabelLink {
  label: DealLabel;
}

export interface LeadWithRelations extends Omit<Lead, 'valueAmount'> {
  valueAmount?: number | null;
  person?: Person | null;
  organization?: Organization | null;
  owner?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
  creator?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
  convertedToDeal?: {
    id: string;
    title: string;
    value?: number | null;
    status: string;
  } | null;
  labelLinks?: LeadLabelWithLink[];
}

export interface NoteWithRelations extends Note {
  author?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
}

export interface TimelineItem {
  id: string;
  type: 'activity' | 'note' | 'email';
  timestamp: string;
  data: Record<string, unknown>;
}

export interface DealWithRelations extends Omit<Deal, 'value'> {
  value?: number | null; // Override Decimal with number for JSON
  pipeline?: Pipeline;
  stage?: Stage;
  person?: Person | null;
  organization?: Organization | null;
  owner?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  creator?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
  labelLinks?: DealLabelWithLink[];
  _count?: {
    activities?: number;
    emails?: number;
    notes?: number;
    labelLinks?: number;
  };
}

export interface PipelineWithRelations extends Pipeline {
  stages?: Stage[];
  _count?: {
    deals?: number;
  };
}

export interface StageWithRelations extends Stage {
  _count?: {
    deals?: number;
  };
}

export interface ActivityWithRelations extends Activity {
  deal?: (Deal & { stage?: { name: string } | null }) | null;
  lead?: { id: string; title: string; status: string } | null;
  person?: Person | null;
  organization?: Organization | null;
  owner?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
}

export interface EmailWithRelations extends Email {
  deal?: Deal | null;
  person?: Person | null;
  organization?: Organization | null;
  user?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
}

// API response wrappers
export interface ApiResponse<T> {
  data: T;
}

export interface ApiListResponse<T> {
  data: {
    items: T[];
    total: number;
  };
}

// Special response types
export interface PipelineWithDealsResponse {
  data: {
    pipeline: PipelineWithRelations;
    stages: StageWithRelations[];
    deals: DealWithRelations[];
  };
}

export interface LeadConvertResponse {
  data: {
    deal: DealWithRelations;
    lead: LeadWithRelations;
  };
}

export interface DeleteResponse {
  data: {
    success: boolean;
  };
}
