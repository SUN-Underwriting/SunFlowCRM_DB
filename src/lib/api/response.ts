import { NextResponse } from 'next/server';
import {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  BusinessRuleError,
  InternalError
} from '@/lib/errors/app-errors';

/**
 * Standard API response wrapper
 */
export function apiResponse<T>(data: T, status: number = 200) {
  return NextResponse.json({ data }, { status });
}

/**
 * Standard API error response
 * Context7: Typed details parameter for better type safety
 */
export function apiError(
  message: string,
  status: number = 400,
  details?: Record<string, unknown>
) {
  return NextResponse.json(
    {
      error: {
        message,
        ...(details && { details })
      }
    },
    { status }
  );
}

/**
 * Handle API errors consistently
 * Uses custom error classes for proper status codes and error formatting
 */
export function handleApiError(error: unknown) {
  console.error('[API Error]', error);

  // Handle custom application errors
  if (error instanceof ValidationError) {
    return NextResponse.json(
      {
        error: {
          message: error.message,
          ...(error.fields && { fields: error.fields })
        }
      },
      { status: error.statusCode }
    );
  }

  if (error instanceof AppError) {
    return apiError(error.message, error.statusCode);
  }

  // Handle generic errors
  if (error instanceof Error) {
    // Legacy error message parsing (for backwards compatibility)
    if (
      error.message.includes('Unauthorized') ||
      error.message.includes('Authentication required')
    ) {
      return apiError('Unauthorized', 401);
    }

    if (
      error.message.includes('Forbidden') ||
      error.message.includes('Access denied')
    ) {
      return apiError('Forbidden', 403);
    }

    if (error.message.includes('not found')) {
      return apiError(error.message, 404);
    }

    // Generic error - don't expose internal details in production
    const message =
      process.env.NODE_ENV === 'production'
        ? 'An error occurred'
        : error.message;
    return apiError(message, 400);
  }

  // Unexpected error type
  return apiError('Internal server error', 500);
}
