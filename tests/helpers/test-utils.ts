/**
 * Integration test utilities.
 */

import { vi } from 'vitest';

/**
 * Create a mock storage implementation for testing.
 */
export function mockStorage() {
  const storage = new Map<string, unknown>();
  
  return {
    get: vi.fn((key: string) => storage.get(key)),
    set: vi.fn((key: string, value: unknown) => storage.set(key, value)),
    delete: vi.fn((key: string) => storage.delete(key)),
    clear: vi.fn(() => storage.clear()),
    keys: vi.fn(() => Array.from(storage.keys())),
    values: vi.fn(() => Array.from(storage.values())),
    entries: vi.fn(() => Array.from(storage.entries())),
  };
}

/**
 * Wait for a specified duration.
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Flush all pending promises.
 */
export async function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Create a mock async iterator for testing streaming responses.
 */
export async function* createMockAsyncIterator<T>(items: T[]): AsyncGenerator<T> {
  for (const item of items) {
    yield item;
  }
}

/**
 * Collect all values from an async iterator.
 */
export async function collectAsyncIterator<T>(
  iterator: AsyncIterable<T>
): Promise<T[]> {
  const results: T[] = [];
  for await (const item of iterator) {
    results.push(item);
  }
  return results;
}

/**
 * Mock console methods during tests.
 */
export function mockConsole() {
  const originalConsole = { ...console };
  
  beforeEach(() => {
    console.log = vi.fn();
    console.error = vi.fn();
    console.warn = vi.fn();
    console.info = vi.fn();
    console.debug = vi.fn();
  });
  
  afterEach(() => {
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
    console.info = originalConsole.info;
    console.debug = originalConsole.debug;
  });
  
  return originalConsole;
}

/**
 * Create a resolvable promise for testing async operations.
 */
export function createResolvablePromise<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
} {
  let resolve: (value: T) => void;
  let reject: (error: Error) => void;
  
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  
  return { promise, resolve: resolve!, reject: reject! };
}

/**
 * Retry an async function with exponential backoff.
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; delay?: number } = {}
): Promise<T> {
  const { maxAttempts = 3, delay = 100 } = options;
  
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts) {
        await wait(delay * attempt);
      }
    }
  }
  
  throw lastError!;
}

/**
 * Assert that a promise rejects with a specific error type.
 */
export async function expectRejectsWith<T extends Error>(
  promise: Promise<unknown>,
  errorType: new (...args: unknown[]) => T
): Promise<T> {
  try {
    await promise;
    throw new Error(`Expected promise to reject with ${errorType.name}`);
  } catch (error) {
    if (error instanceof errorType) {
      return error;
    }
    throw new Error(
      `Expected ${errorType.name} but got ${(error as Error).constructor.name}: ${(error as Error).message}`
    );
  }
}
