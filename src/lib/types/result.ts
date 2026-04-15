/**
 * Result type for explicit error handling without try/catch.
 */

export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

export function ok<T>(data: T): Result<T, never> {
  return { success: true, data };
}

export function err<E>(error: E): Result<never, E> {
  return { success: false, error };
}

/**
 * Unwrap a result or throw the error.
 */
export function unwrap<T, E extends Error>(result: Result<T, E>): T {
  if (!result.success) {
    throw result.error;
  }
  return result.data;
}

/**
 * Map over a successful result.
 */
export function map<T, U, E>(
  result: Result<T, E>,
  fn: (data: T) => U
): Result<U, E> {
  if (!result.success) return result;
  return ok(fn(result.data));
}

/**
 * Chain async operations with results.
 */
export async function flatMap<T, U, E>(
  result: Result<T, E>,
  fn: (data: T) => Promise<Result<U, E>>
): Promise<Result<U, E>> {
  if (!result.success) return result;
  return await fn(result.data);
}
