/**
 * Application error hierarchy with contextual information.
 */

export type ErrorSeverity = 'fatal' | 'error' | 'warning' | 'info';
export type ErrorCategory = 
  | 'storage' 
  | 'network' 
  | 'provider' 
  | 'validation' 
  | 'runtime' 
  | 'unknown';

export interface ErrorContext {
  operation: string;
  component?: string;
  input?: unknown;
  timestamp: number;
  userVisible?: boolean;
}

export abstract class AppError extends Error {
  abstract readonly severity: ErrorSeverity;
  abstract readonly category: ErrorCategory;
  abstract readonly userMessage: string;
  
  readonly context: ErrorContext;
  readonly originalError?: Error;

  constructor(
    message: string,
    context: Omit<ErrorContext, 'timestamp'>,
    originalError?: Error
  ) {
    super(message);
    this.name = this.constructor.name;
    this.context = {
      ...context,
      timestamp: Date.now(),
    };
    this.originalError = originalError;
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      severity: this.severity,
      category: this.category,
      userMessage: this.userMessage,
      context: this.context,
      stack: this.stack,
      originalError: this.originalError?.message,
    };
  }
}

export class StorageError extends AppError {
  readonly severity = 'error';
  readonly category = 'storage';
  readonly userMessage: string;

  constructor(
    operation: string,
    userMessage: string = 'Failed to save data',
    originalError?: Error
  ) {
    super(
      `Storage operation failed: ${operation}`,
      { operation, component: 'storage', userVisible: true },
      originalError
    );
    this.userMessage = userMessage;
  }
}

export class ProviderError extends AppError {
  readonly severity = 'error';
  readonly category = 'provider';
  readonly userMessage: string;
  readonly providerId: string;

  constructor(
    providerId: string,
    operation: string,
    userMessage: string = 'AI provider error',
    originalError?: Error
  ) {
    super(
      `Provider ${providerId} failed: ${operation}`,
      { operation, component: 'provider', userVisible: true },
      originalError
    );
    this.providerId = providerId;
    this.userMessage = userMessage;
  }
}

export class ValidationError extends AppError {
  readonly severity = 'warning';
  readonly category = 'validation';
  readonly userMessage: string;
  readonly field?: string;

  constructor(
    field: string,
    message: string,
    userMessage?: string
  ) {
    super(
      `Validation failed for ${field}: ${message}`,
      { operation: 'validate', component: 'validation', userVisible: true }
    );
    this.field = field;
    this.userMessage = userMessage || `Invalid value for ${field}`;
  }
}

export class NetworkError extends AppError {
  readonly severity = 'error';
  readonly category = 'network';
  readonly userMessage = 'Connection failed. Please check your internet.';
  readonly endpoint?: string;

  constructor(
    operation: string,
    endpoint?: string,
    originalError?: Error
  ) {
    super(
      `Network request failed: ${operation}`,
      { operation, component: 'network', userVisible: true },
      originalError
    );
    this.endpoint = endpoint;
  }
}
