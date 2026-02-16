/**
 * API Input Validation Utilities
 *
 * Best Practice (from Context7):
 * "Validate all user inputs using libraries like Zod before executing database operations"
 * "Never expose the raw Prisma Client in HTTP controllers or API routes"
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ValidationError } from '@/lib/errors/app-errors';

/**
 * Validates request body against a Zod schema
 * Throws ValidationError with structured field errors if invalid
 *
 * Best Practice (Context7 - Next.js):
 * "Use safeParse() and return field-specific errors for better client UX"
 */
export async function validateRequestBody<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>
): Promise<T> {
  try {
    const body = await request.json();
    return schema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Return structured field errors for client
      throw new ValidationError(
        'Validation failed',
        error.flatten().fieldErrors
      );
    }
    throw new ValidationError('Invalid request body');
  }
}

/**
 * Validates that required query parameters exist
 */
export function validateQueryParam(
  searchParams: URLSearchParams,
  paramName: string,
  required: boolean = true
): string | null {
  const value = searchParams.get(paramName);

  if (required && !value) {
    throw new ValidationError(`Missing required query parameter: ${paramName}`);
  }

  return value;
}

/**
 * Validates enum value from query parameter
 */
export function validateEnumParam<T extends string>(
  searchParams: URLSearchParams,
  paramName: string,
  validValues: readonly T[],
  required: boolean = true
): T | null {
  const value = searchParams.get(paramName);

  if (!value) {
    if (required) {
      throw new ValidationError(
        `Missing required query parameter: ${paramName}`
      );
    }
    return null;
  }

  if (!validValues.includes(value as T)) {
    throw new ValidationError(
      `Invalid ${paramName}: must be one of ${validValues.join(', ')}`
    );
  }

  return value as T;
}

/**
 * Common validation schemas for CRM entities
 *
 * Best Practice (Context7 - Zod v4):
 * Using top-level format validators (z.cuid(), z.email()) instead of deprecated
 * method forms (z.string().cuid(), z.string().email()) for better tree-shaking
 */
export const CommonSchemas = {
  // CUID validation - Zod v4 top-level API
  id: z.cuid({ message: 'Invalid ID format' }),

  // Query param validation helpers
  limitParam: z.coerce.number().int().min(1).max(1000).default(50),
  skipParam: z.coerce.number().int().min(0).default(0),

  // Email validation - Zod v4 top-level API
  email: z.email({ message: 'Invalid email address' }),

  // Pagination
  pagination: z.object({
    skip: z.number().int().min(0).optional(),
    take: z.number().int().min(1).max(1000).optional()
  }),

  // Deal schemas
  createDeal: z.object({
    title: z.string().min(1, 'Title is required').max(200),
    pipelineId: z.cuid(),
    stageId: z.cuid(),
    value: z.number().min(0).optional(),
    currency: z.string().min(3).max(3).optional(),
    expectedCloseDate: z.coerce.date().optional(),
    personId: z.cuid().optional(),
    orgId: z.cuid().optional(),
    customData: z.record(z.string(), z.unknown()).optional()
  }),

  updateDeal: z.object({
    title: z.string().min(1).max(200).optional(),
    pipelineId: z.cuid().optional(),
    stageId: z.cuid().optional(),
    value: z.number().min(0).optional(),
    currency: z.string().min(3).max(3).optional(),
    expectedCloseDate: z.coerce.date().optional(),
    personId: z.cuid().optional(),
    orgId: z.cuid().optional(),
    customData: z.record(z.string(), z.unknown()).optional()
  }),

  moveDeal: z.object({
    stageId: z.cuid()
  }),

  // Lead schemas
  createLead: z.object({
    title: z.string().min(1, 'Title is required').max(200),
    source: z.string().max(100).optional(),
    personId: z.cuid().optional(),
    orgId: z.cuid().optional()
  }),

  updateLead: z.object({
    title: z.string().min(1).max(200).optional(),
    source: z.string().max(100).optional(),
    status: z.enum(['NEW', 'IN_PROGRESS', 'CONVERTED', 'ARCHIVED']).optional(),
    personId: z.cuid().optional(),
    orgId: z.cuid().optional()
  }),

  convertLead: z.object({
    pipelineId: z.cuid(),
    stageId: z.cuid(),
    dealTitle: z.string().max(200).optional(),
    dealValue: z.number().min(0).optional(),
    currency: z.string().length(3).optional(),
    expectedCloseDate: z.coerce.date().optional(),
    createPerson: z
      .object({
        firstName: z.string().min(1).max(100),
        lastName: z.string().min(1).max(100),
        email: z.email().optional(),
        phone: z.string().max(50).optional(),
        jobTitle: z.string().max(100).optional()
      })
      .optional(),
    createOrganization: z
      .object({
        name: z.string().min(1).max(200),
        industry: z.string().max(100).optional(),
        website: z.url().optional()
      })
      .optional()
  }),

  // Person schemas
  createPerson: z.object({
    firstName: z.string().min(1, 'First name is required').max(100),
    lastName: z.string().min(1, 'Last name is required').max(100),
    email: z.email().optional(),
    phone: z.string().max(50).optional(),
    jobTitle: z.string().max(100).optional(),
    orgId: z.cuid().optional(),
    customData: z.record(z.string(), z.unknown()).optional()
  }),

  updatePerson: z.object({
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
    email: z.email().optional(),
    phone: z.string().max(50).optional(),
    jobTitle: z.string().max(100).optional(),
    orgId: z.cuid().optional(),
    customData: z.record(z.string(), z.unknown()).optional()
  }),

  // Organization schemas
  createOrganization: z.object({
    name: z.string().min(1, 'Name is required').max(200),
    industry: z.string().max(100).optional(),
    size: z.string().max(50).optional(),
    website: z.url().optional().or(z.literal('')),
    phone: z.string().max(50).optional(),
    address: z.string().optional(),
    customData: z.record(z.string(), z.unknown()).optional()
  }),

  updateOrganization: z.object({
    name: z.string().min(1).max(200).optional(),
    industry: z.string().max(100).optional(),
    size: z.string().max(50).optional(),
    website: z.url().optional().or(z.literal('')),
    phone: z.string().max(50).optional(),
    address: z.string().optional(),
    customData: z.record(z.string(), z.unknown()).optional()
  }),

  // Pipeline schemas
  createPipeline: z.object({
    name: z.string().min(1, 'Name is required').max(100),
    isDefault: z.boolean().optional()
  }),

  updatePipeline: z.object({
    name: z.string().min(1).max(100).optional(),
    isDefault: z.boolean().optional()
  }),

  // Stage schemas
  createStage: z.object({
    pipelineId: z.cuid(),
    name: z.string().min(1, 'Name is required').max(100),
    probability: z.number().min(0).max(100),
    sortOrder: z.number().int().min(0).optional(),
    isRotten: z.boolean().optional(),
    rottenDays: z.number().int().min(1).optional()
  }),

  updateStage: z.object({
    name: z.string().min(1).max(100).optional(),
    probability: z.number().min(0).max(100).optional(),
    sortOrder: z.number().int().min(0).optional(),
    isRotten: z.boolean().optional(),
    rottenDays: z.number().int().min(1).optional()
  }),

  // Activity schemas
  createActivity: z.object({
    type: z.enum(['CALL', 'MEETING', 'TASK', 'EMAIL']),
    subject: z.string().min(1, 'Subject is required').max(200),
    dueAt: z.coerce.date().optional(),
    dealId: z.cuid().optional(),
    personId: z.cuid().optional(),
    orgId: z.cuid().optional(),
    note: z.string().optional()
  }),

  updateActivity: z.object({
    type: z.enum(['CALL', 'MEETING', 'TASK', 'EMAIL']).optional(),
    subject: z.string().min(1).max(200).optional(),
    dueAt: z.coerce.date().optional(),
    done: z.boolean().optional(),
    completedAt: z.coerce.date().optional(),
    dealId: z.cuid().optional(),
    personId: z.cuid().optional(),
    orgId: z.cuid().optional(),
    note: z.string().optional()
  }),

  // Email schemas
  createEmail: z.object({
    direction: z.enum(['INCOMING', 'OUTGOING']),
    subject: z.string().max(500),
    from: z.email(),
    to: z.string(), // Email service expects comma-separated string
    cc: z.string().optional(),
    bcc: z.string().optional(),
    bodyPreview: z.string().optional(),
    dealId: z.cuid().optional(),
    personId: z.cuid().optional(),
    orgId: z.cuid().optional()
  }),

  // Field Definition schemas
  createFieldDefinition: z.object({
    entityType: z.enum(['DEAL', 'PERSON', 'ORGANIZATION']),
    key: z
      .string()
      .min(1)
      .max(50)
      .regex(/^[a-zA-Z0-9_]+$/, 'Key must be alphanumeric with underscores'),
    label: z.string().min(1).max(100),
    fieldType: z.enum(['TEXT', 'NUMBER', 'DATE', 'SELECT', 'MULTI_SELECT']),
    options: z.array(z.string()).optional(),
    sortOrder: z.number().int().min(0).optional()
  }),

  updateFieldDefinition: z.object({
    label: z.string().min(1).max(100).optional(),
    fieldType: z
      .enum(['TEXT', 'NUMBER', 'DATE', 'SELECT', 'MULTI_SELECT'])
      .optional(),
    options: z.array(z.string()).optional(),
    sortOrder: z.number().int().min(0).optional()
  })
};

/**
 * Safely parse pagination parameters from query string.
 * Returns validated skip and take values with defaults.
 */
export function parsePagination(
  searchParams: URLSearchParams,
  defaults = { skip: 0, take: 50 }
) {
  const skipRaw = searchParams.get('skip');
  const takeRaw = searchParams.get('take');

  const skip = skipRaw ? parseInt(skipRaw, 10) : defaults.skip;
  const take = takeRaw ? parseInt(takeRaw, 10) : defaults.take;

  return {
    skip: isNaN(skip) || skip < 0 ? defaults.skip : skip,
    take: isNaN(take) || take < 1 ? defaults.take : Math.min(take, 1000)
  };
}

/**
 * Security: Sanitize string inputs to prevent injection attacks
 * This is a basic implementation - consider using a library like DOMPurify for production
 */
export function sanitizeString(
  input: string | undefined | null
): string | undefined {
  if (!input) return undefined;

  // Remove null bytes and control characters
  return input.replace(/[\x00-\x1F\x7F]/g, '').trim();
}
