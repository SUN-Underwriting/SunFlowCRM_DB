import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  tenantId: string;
  userId: string;
  bypassRls?: boolean;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Get the current request context
 */
export function getRequestContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore();
}

/**
 * Run a function within a request context.
 * Uses AsyncLocalStorage.run() for proper async isolation —
 * the context is scoped to the callback and cannot leak to other requests.
 */
export async function runInRequestContext<T>(
  context: RequestContext,
  fn: () => Promise<T>
): Promise<T> {
  return asyncLocalStorage.run(context, fn);
}

/**
 * Execute a function with RLS bypass enabled
 * Useful for operations that need to query across tenants
 */
export async function withRlsBypass<T>(fn: () => Promise<T>): Promise<T> {
  const currentContext = getRequestContext();

  // If no context, just run the function
  if (!currentContext) {
    return fn();
  }

  // Create new context with bypass flag
  const bypassContext: RequestContext = {
    ...currentContext,
    bypassRls: true
  };

  return asyncLocalStorage.run(bypassContext, fn);
}

/**
 * Execute a function within a specific tenant context
 */
export async function withTenantContext<T>(
  context: RequestContext,
  fn: () => Promise<T>
): Promise<T> {
  return asyncLocalStorage.run(context, fn);
}
