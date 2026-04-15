/**
 * Centralized error handling with user feedback and logging.
 */

import type { AppError } from './error-types';
import { logger } from '$lib/utils/logger';
import { settingsStore } from '$lib/stores/settings';
import { get } from 'svelte/store';

export interface ErrorHandlerOptions {
  showToast?: boolean;
  logToConsole?: boolean;
  rethrow?: boolean;
}

const defaultOptions: ErrorHandlerOptions = {
  showToast: true,
  logToConsole: true,
  rethrow: false,
};

/**
 * Handle an application error with appropriate logging and user feedback.
 */
export function handleError(
  error: unknown,
  context: string,
  options: ErrorHandlerOptions = {}
): void {
  const opts = { ...defaultOptions, ...options };
  
  // Normalize to AppError if possible
  const appError = normalizeError(error, context);
  
  // Log the error
  if (opts.logToConsole) {
    const log = logger.scope('ErrorHandler');
    if (appError.severity === 'error' || appError.severity === 'fatal') {
      log.error(appError.message, appError.toJSON());
    } else {
      log.warn(appError.message, appError.toJSON());
    }
  }
  
  // Show user feedback if enabled and error is user-visible
  if (opts.showToast && appError.context.userVisible) {
    showErrorNotification(appError.userMessage);
  }
  
  // Rethrow if requested
  if (opts.rethrow) {
    throw appError;
  }
}

/**
 * Wrap an async function with error handling.
 */
export function withErrorHandling<T, Args extends unknown[]>(
  fn: (...args: Args) => Promise<T>,
  context: string,
  options?: ErrorHandlerOptions
): (...args: Args) => Promise<T | undefined> {
  return async (...args: Args) => {
    try {
      return await fn(...args);
    } catch (error) {
      handleError(error, context, options);
      return undefined;
    }
  };
}

function normalizeError(error: unknown, context: string): AppError {
  if (error instanceof Error && 'category' in error) {
    return error as AppError;
  }
  
  // Convert generic errors
  const message = error instanceof Error ? error.message : String(error);
  
  return {
    name: 'UnknownError',
    message,
    severity: 'error',
    category: 'unknown',
    userMessage: 'An unexpected error occurred',
    context: {
      operation: context,
      timestamp: Date.now(),
      userVisible: true,
    },
    toJSON: () => ({
      name: 'UnknownError',
      message,
      severity: 'error',
      category: 'unknown',
    }),
  } as AppError;
}

function showErrorNotification(message: string): void {
  // In a real app, this would integrate with a toast/notification system
  // For now, we'll use the browser's alert in development
  const settings = get(settingsStore);
  if (settings.developerMode) {
    console.warn('[User Error]', message);
  }
}
