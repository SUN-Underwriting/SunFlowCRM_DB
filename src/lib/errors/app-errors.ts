/**
 * Custom Application Error Classes
 * Based on Next.js and API best practices from Context7
 */

/**
 * Base application error class
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 400 - Validation Error
 * Used when input validation fails
 */
export class ValidationError extends AppError {
  public readonly fields?: Record<string, string[]>;

  constructor(message: string, fields?: Record<string, string[]>) {
    super(message, 400);
    this.fields = fields;
  }
}

/**
 * 401 - Unauthorized Error
 * Used when authentication is required but not provided
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401);
  }
}

/**
 * 403 - Forbidden Error
 * Used when user is authenticated but doesn't have permission
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, 403);
  }
}

/**
 * 404 - Not Found Error
 * Used when requested resource doesn't exist
 */
export class NotFoundError extends AppError {
  public readonly resource?: string;

  constructor(message: string = 'Resource not found', resource?: string) {
    super(message, 404);
    this.resource = resource;
  }
}

/**
 * 409 - Conflict Error
 * Used when operation conflicts with current state (e.g., duplicate)
 */
export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict') {
    super(message, 409);
  }
}

/**
 * 422 - Unprocessable Entity
 * Used for business logic validation failures
 */
export class BusinessRuleError extends AppError {
  constructor(message: string) {
    super(message, 422);
  }
}

/**
 * 500 - Internal Server Error
 * Used for unexpected server errors
 */
export class InternalError extends AppError {
  constructor(message: string = 'Internal server error') {
    super(message, 500, false);
  }
}

/**
 * Tenant-specific errors
 */
export class TenantAccessError extends ForbiddenError {
  constructor(message: string = 'Tenant access denied') {
    super(message);
  }
}

export class TenantContextMissingError extends UnauthorizedError {
  constructor(message: string = 'Tenant context missing in session') {
    super(message);
  }
}
