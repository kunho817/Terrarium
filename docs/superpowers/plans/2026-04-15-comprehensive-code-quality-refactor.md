# Comprehensive Code Quality & Architecture Refactoring Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish production-grade error handling, logging, type safety, and component architecture patterns across the entire Terrarium codebase.

**Architecture:** Create centralized error handling with contextual logging, establish strict TypeScript patterns, standardize Svelte component structures with clear lifecycle management, and unify plugin system APIs.

**Tech Stack:** TypeScript strict, Svelte 5, Vitest, Tauri

---

## Executive Summary

This plan addresses 5 critical architectural areas:

1. **Error Handling & Logging** - Centralized error management with user feedback
2. **Type Safety Improvements** - Strict typing, branded types, exhaustive checks
3. **Component Architecture** - Standardized Svelte patterns with error boundaries
4. **Plugin System Standardization** - Unified provider/format/builder APIs
5. **Test Coverage Expansion** - Integration tests for critical paths

---

## File Structure Changes

### New Files (Create):

**Error Handling:**
- `src/lib/errors/error-types.ts` - Custom error hierarchy
- `src/lib/errors/error-handler.ts` - Central error processor
- `src/lib/errors/error-boundary.svelte` - Svelte error boundary component
- `src/lib/utils/logger.ts` - Structured logging utility

**Type Safety:**
- `src/lib/types/branded.ts` - Branded type utilities
- `src/lib/types/result.ts` - Result/Either type for error handling
- `src/lib/utils/type-guards.ts` - Runtime type checking utilities

**Component Architecture:**
- `src/lib/components/base/LoadingState.svelte` - Reusable loading component
- `src/lib/components/base/ErrorState.svelte` - Reusable error display
- `src/lib/components/base/AsyncContainer.svelte` - Async state wrapper

**Plugin System:**
- `src/lib/plugins/plugin-interface.ts` - Unified plugin interface definitions
- `src/lib/plugins/plugin-validator.ts` - Plugin validation utilities

**Tests:**
- `tests/integration/chat-flow.test.ts` - End-to-end chat flow tests
- `tests/integration/provider-lifecycle.test.ts` - Provider plugin tests

### Modified Files (Refactor):

**Error Handling:**
- `src/lib/core/chat/use-chat.ts` - Add structured logging
- `src/lib/core/image/generator.ts` - Error context propagation
- `src/lib/repositories/*.ts` - Consistent error wrapping

**Type Safety:**
- `src/lib/types/*.ts` - Add branded types for IDs
- `src/lib/stores/*.ts` - Strict state typing
- All `*.svelte` files - Fix implicit any issues

**Components:**
- `src/routes/*/+page.svelte` - Add error boundaries, standardize async patterns
- `src/lib/components/*.svelte` - Consistent prop typing and lifecycle

**Plugins:**
- `src/lib/plugins/providers/builtin.ts` - Standardize registration
- `src/lib/plugins/card-formats/builtin.ts` - Standardize registration
- `src/lib/plugins/prompt-builder/builtin.ts` - Standardize registration
- All provider implementations - Unified error handling

---

## Task 1: Error Types & Logger Infrastructure

**Files:**
- Create: `src/lib/errors/error-types.ts`
- Create: `src/lib/utils/logger.ts`
- Create: `src/lib/types/result.ts`
- Test: `tests/errors/error-types.test.ts`

### Step 1: Create Error Type Hierarchy

**File:** `src/lib/errors/error-types.ts`

```typescript
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
```

### Step 2: Create Logger Utility

**File:** `src/lib/utils/logger.ts`

```typescript
/**
 * Structured logging utility with levels and contexts.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  timestamp: number;
  source?: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const CURRENT_LOG_LEVEL: LogLevel = 
  (import.meta.env.VITE_LOG_LEVEL as LogLevel) || 
  (import.meta.env.DEV ? 'debug' : 'warn');

class Logger {
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[CURRENT_LOG_LEVEL];
  }

  private format(entry: LogEntry): string {
    const time = new Date(entry.timestamp).toISOString();
    const context = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
    return `[${time}] [${entry.level.toUpperCase()}]${entry.source ? ` [${entry.source}]` : ''} ${entry.message}${context}`;
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>, source?: string) {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      message,
      context,
      timestamp: Date.now(),
      source,
    };

    const formatted = this.format(entry);

    switch (level) {
      case 'debug':
        console.debug(formatted);
        break;
      case 'info':
        console.info(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'error':
        console.error(formatted);
        break;
    }
  }

  debug(message: string, context?: Record<string, unknown>, source?: string) {
    this.log('debug', message, context, source);
  }

  info(message: string, context?: Record<string, unknown>, source?: string) {
    this.log('info', message, context, source);
  }

  warn(message: string, context?: Record<string, unknown>, source?: string) {
    this.log('warn', message, context, source);
  }

  error(message: string, context?: Record<string, unknown>, source?: string) {
    this.log('error', message, context, source);
  }

  /**
   * Create a scoped logger with default context.
   */
  scope(source: string, defaultContext?: Record<string, unknown>) {
    return {
      debug: (msg: string, ctx?: Record<string, unknown>) => 
        this.debug(msg, { ...defaultContext, ...ctx }, source),
      info: (msg: string, ctx?: Record<string, unknown>) => 
        this.info(msg, { ...defaultContext, ...ctx }, source),
      warn: (msg: string, ctx?: Record<string, unknown>) => 
        this.warn(msg, { ...defaultContext, ...ctx }, source),
      error: (msg: string, ctx?: Record<string, unknown>) => 
        this.error(msg, { ...defaultContext, ...ctx }, source),
    };
  }
}

export const logger = new Logger();
```

### Step 3: Create Result Type

**File:** `src/lib/types/result.ts`

```typescript
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
```

### Step 4: Write Tests

**File:** `tests/errors/error-types.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { StorageError, ProviderError, ValidationError, NetworkError } from '$lib/errors/error-types';

describe('Error Types', () => {
  it('StorageError has correct properties', () => {
    const error = new StorageError('saveCharacter', 'Failed to save character');
    
    expect(error.category).toBe('storage');
    expect(error.severity).toBe('error');
    expect(error.userMessage).toBe('Failed to save character');
    expect(error.context.operation).toBe('saveCharacter');
    expect(error.context.userVisible).toBe(true);
  });

  it('ProviderError includes providerId', () => {
    const error = new ProviderError('openai', 'sendMessage', 'API error');
    
    expect(error.providerId).toBe('openai');
    expect(error.category).toBe('provider');
    expect(error.userMessage).toBe('API error');
  });

  it('ValidationError has lower severity', () => {
    const error = new ValidationError('name', 'empty', 'Name is required');
    
    expect(error.severity).toBe('warning');
    expect(error.field).toBe('name');
  });

  it('errors can be serialized to JSON', () => {
    const original = new Error('original');
    const error = new StorageError('test', 'message', original);
    
    const json = error.toJSON();
    expect(json.name).toBe('StorageError');
    expect(json.severity).toBe('error');
    expect(json.originalError).toBe('original');
  });
});
```

### Step 5: Commit

```bash
git add src/lib/errors/ src/lib/utils/logger.ts src/lib/types/result.ts tests/errors/
git commit -m "feat: add error types and structured logger infrastructure"
```

---

## Task 2: Branded Types for ID Safety

**Files:**
- Create: `src/lib/types/branded.ts`
- Modify: `src/lib/types/index.ts`
- Modify: All ID usages in stores and components
- Test: `tests/types/branded.test.ts`

### Step 1: Create Branded Type Utilities

**File:** `src/lib/types/branded.ts`

```typescript
/**
 * Branded types for compile-time ID type safety.
 * Prevents mixing up different ID types (e.g., characterId vs worldId).
 */

declare const __brand: unique symbol;

type Brand<B> = { [__brand]: B };

export type Branded<T, B> = T & Brand<B>;

// ID types
export type CharacterId = Branded<string, 'CharacterId'>;
export type WorldId = Branded<string, 'WorldId'>;
export type SessionId = Branded<string, 'SessionId'>;
export type ChatId = Branded<string, 'ChatId'>;
export type PersonaId = Branded<string, 'PersonaId'>;

// Factory functions
export function makeCharacterId(id: string): CharacterId {
  return id as CharacterId;
}

export function makeWorldId(id: string): WorldId {
  return id as WorldId;
}

export function makeSessionId(id: string): SessionId {
  return id as SessionId;
}

export function makeChatId(id: string): ChatId {
  return id as ChatId;
}

export function makePersonaId(id: string): PersonaId {
  return id as PersonaId;
}
```

### Step 2: Update Type Exports

Add to `src/lib/types/index.ts`:

```typescript
export type {
  CharacterId,
  WorldId,
  SessionId,
  ChatId,
  PersonaId,
  makeCharacterId,
  makeWorldId,
  makeSessionId,
  makeChatId,
  makePersonaId,
} from './branded';
```

### Step 3: Commit

```bash
git add src/lib/types/branded.ts src/lib/types/index.ts
git commit -m "feat: add branded types for ID type safety"
```

---

## Task 3: Error Handler & Boundary Components

**Files:**
- Create: `src/lib/errors/error-handler.ts`
- Create: `src/lib/components/base/ErrorState.svelte`
- Create: `src/lib/components/base/AsyncContainer.svelte`
- Test: `tests/errors/error-handler.test.ts`

### Step 1: Create Error Handler

**File:** `src/lib/errors/error-handler.ts`

```typescript
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
```

### Step 2: Create ErrorState Component

**File:** `src/lib/components/base/ErrorState.svelte`

```svelte
<script lang="ts">
  interface Props {
    title?: string;
    message: string;
    onRetry?: () => void;
    canDismiss?: boolean;
    onDismiss?: () => void;
  }

  let { 
    title = 'Error', 
    message, 
    onRetry,
    canDismiss = false,
    onDismiss
  }: Props = $props();
</script>

<div class="flex flex-col items-center justify-center p-6 text-center" role="alert">
  <div class="w-12 h-12 rounded-full bg-red/20 flex items-center justify-center mb-3">
    <span class="text-red text-xl">!</span>
  </div>
  
  <h3 class="text-sm font-semibold text-text mb-1">{title}</h3>
  <p class="text-xs text-subtext0 mb-4 max-w-xs">{message}</p>
  
  <div class="flex gap-2">
    {#if onRetry}
      <button
        onclick={onRetry}
        class="px-3 py-1.5 rounded text-xs font-medium bg-mauve text-crust hover:bg-lavender transition-colors"
      >
        Retry
      </button>
    {/if}
    
    {#if canDismiss && onDismiss}
      <button
        onclick={onDismiss}
        class="px-3 py-1.5 rounded text-xs font-medium bg-surface0 text-text hover:bg-surface1 transition-colors"
      >
        Dismiss
      </button>
    {/if}
  </div>
</div>
```

### Step 3: Create AsyncContainer Component

**File:** `src/lib/components/base/AsyncContainer.svelte`

```svelte
<script lang="ts">
  import ErrorState from './ErrorState.svelte';
  
  type AsyncState<T> = 
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'success'; data: T }
    | { status: 'error'; error: string };

  interface Props<T> {
    state: AsyncState<T>;
    loadingMessage?: string;
    errorTitle?: string;
    onRetry?: () => void;
    children: import('svelte').Snippet<[T]>;
  }

  let { 
    state, 
    loadingMessage = 'Loading...',
    errorTitle = 'Failed to load',
    onRetry,
    children
  }: Props<unknown> = $props();
</script>

{#if state.status === 'idle'}
  <div class="flex items-center justify-center p-6 text-subtext0 text-sm">
    Waiting...
  </div>
{:else if state.status === 'loading'}
  <div class="flex flex-col items-center justify-center p-6">
    <div class="w-6 h-6 border-2 border-surface0 border-t-mauve rounded-full animate-spin mb-2"></div>
    <span class="text-xs text-subtext0">{loadingMessage}</span>
  </div>
{:else if state.status === 'error'}
  <ErrorState
    title={errorTitle}
    message={state.error}
    onRetry={onRetry}
  />
{:else if state.status === 'success'}
  {@render children(state.data)}
{/if}
```

### Step 4: Commit

```bash
git add src/lib/errors/error-handler.ts src/lib/components/base/
git commit -m "feat: add error handler and reusable async UI components"
```

---

## Task 4: Repository Error Handling Integration

**Files:**
- Modify: `src/lib/repositories/settings-repo.ts`
- Modify: `src/lib/repositories/characters-repo.ts`
- Modify: `src/lib/repositories/worlds-repo.ts`
- Modify: `src/lib/repositories/chat-repo.ts`
- Modify: `src/lib/repositories/scene-repo.ts`
- Test: `tests/repositories/error-handling.test.ts`

### Step 1: Update Settings Repository

**File:** `src/lib/repositories/settings-repo.ts`

```typescript
import { StorageError } from '$lib/errors/error-types';
import { handleError } from '$lib/errors/error-handler';

export const settingsRepo = {
  async load(): Promise<void> {
    try {
      settingsStore.set({ isLoading: true });
      const settings = await settingsStorage.loadSettings();
      // ... migrations
      settingsStore.set(settings);
    } catch (error) {
      handleError(
        new StorageError('loadSettings', 'Failed to load settings', error as Error),
        'settingsRepo.load'
      );
      throw error; // Re-throw for component handling
    }
  },

  async save(): Promise<void> {
    try {
      const state = get(settingsStore);
      await settingsStorage.saveSettings(state);
    } catch (error) {
      handleError(
        new StorageError('saveSettings', 'Failed to save settings', error as Error),
        'settingsRepo.save'
      );
      throw error;
    }
  },
};
```

### Step 2: Update Characters Repository

**File:** `src/lib/repositories/characters-repo.ts`

```typescript
import { StorageError, ValidationError } from '$lib/errors/error-types';
import { logger } from '$lib/utils/logger';

const log = logger.scope('CharactersRepo');

export const charactersRepo = {
  async loadList(): Promise<void> {
    charactersStore.update((s) => ({ ...s, isLoading: true }));
    log.debug('Loading character list');
    
    try {
      const list = await characterStorage.listCharacters();
      charactersStore.setCharacters(list);
      log.info('Character list loaded', { count: list.length });
    } catch (error) {
      charactersStore.update((s) => ({ ...s, isLoading: false }));
      throw new StorageError(
        'listCharacters',
        'Failed to load characters',
        error as Error
      );
    }
  },

  async selectCharacter(id: string): Promise<void> {
    if (!id) {
      throw new ValidationError('id', 'Character ID is required');
    }
    
    charactersStore.update((s) => ({ ...s, isLoading: true }));
    log.debug('Selecting character', { id });
    
    try {
      const card = await characterStorage.loadCharacter(id);
      charactersStore.selectCharacterState(id, card);
      log.info('Character selected', { id, name: card.name });
    } catch (error) {
      charactersStore.update((s) => ({ ...s, isLoading: false }));
      throw new StorageError(
        'loadCharacter',
        `Failed to load character`,
        error as Error
      );
    }
  },

  async deleteCharacter(id: string): Promise<void> {
    try {
      await characterStorage.deleteCharacter(id);
      charactersStore.removeCharacter(id);
      log.info('Character deleted', { id });
    } catch (error) {
      throw new StorageError(
        'deleteCharacter',
        'Failed to delete character',
        error as Error
      );
    }
  },
};
```

### Step 3: Commit

```bash
git add src/lib/repositories/
git commit -m "refactor: add structured error handling to all repositories"
```

---

## Task 5: Plugin System Standardization

**Files:**
- Create: `src/lib/plugins/plugin-interface.ts`
- Create: `src/lib/plugins/plugin-validator.ts`
- Modify: All builtin.ts registration files
- Test: `tests/plugins/plugin-interface.test.ts`

### Step 1: Create Plugin Interfaces

**File:** `src/lib/plugins/plugin-interface.ts`

```typescript
/**
 * Unified plugin interface definitions.
 */

import type { Result } from '$lib/types/result';

export interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
}

export interface PluginCapabilities {
  readonly canConfigure: boolean;
  readonly canImport: boolean;
  readonly canExport: boolean;
}

export abstract class BasePlugin {
  abstract readonly metadata: PluginMetadata;
  abstract readonly capabilities: PluginCapabilities;
  
  abstract initialize(): Promise<Result<void, Error>>;
  abstract dispose(): Promise<void>;
}

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

export interface AIProvider extends BasePlugin {
  readonly capabilities: PluginCapabilities & {
    readonly supportsStreaming: boolean;
    readonly supportsImages: boolean;
  };
  
  validateConfig(config: ProviderConfig): Result<void, Error>;
  sendMessage(
    messages: unknown[],
    config: ProviderConfig
  ): Promise<Result<AsyncGenerator<string>, Error>>;
}

export interface CardFormat extends BasePlugin {
  readonly capabilities: PluginCapabilities & {
    readonly supportsImport: boolean;
    readonly supportsExport: boolean;
  };
  
  detectFormat(data: unknown): boolean;
  import(data: unknown): Result<unknown, Error>;
  export(card: unknown): Result<string, Error>;
}

export interface ImageProvider extends BasePlugin {
  readonly capabilities: PluginCapabilities & {
    readonly supportsNegativePrompt: boolean;
    readonly supportsImg2Img: boolean;
  };
  
  generateImage(
    prompt: string,
    config: unknown
  ): Promise<Result<{ dataUrl: string }, Error>>;
}

export interface PromptBuilder extends BasePlugin {
  buildPrompt(
    context: unknown,
    template: string
  ): Result<string, Error>;
}
```

### Step 2: Create Plugin Validator

**File:** `src/lib/plugins/plugin-validator.ts`

```typescript
/**
 * Plugin validation utilities.
 */

import type { BasePlugin, PluginMetadata } from './plugin-interface';
import { ValidationError } from '$lib/errors/error-types';
import { ok, err, type Result } from '$lib/types/result';

export function validatePluginMetadata(
  metadata: unknown
): Result<PluginMetadata, ValidationError> {
  if (!metadata || typeof metadata !== 'object') {
    return err(new ValidationError('metadata', 'Metadata must be an object'));
  }
  
  const m = metadata as Record<string, unknown>;
  
  if (!m.id || typeof m.id !== 'string') {
    return err(new ValidationError('id', 'Plugin ID is required'));
  }
  
  if (!m.name || typeof m.name !== 'string') {
    return err(new ValidationError('name', 'Plugin name is required'));
  }
  
  if (!m.version || typeof m.version !== 'string') {
    return err(new ValidationError('version', 'Plugin version is required'));
  }
  
  return ok(m as PluginMetadata);
}

export function validatePlugin(plugin: unknown): Result<BasePlugin, ValidationError> {
  if (!plugin || typeof plugin !== 'object') {
    return err(new ValidationError('plugin', 'Plugin must be an object'));
  }
  
  const p = plugin as BasePlugin;
  
  // Check required properties
  if (!p.metadata) {
    return err(new ValidationError('metadata', 'Plugin metadata is required'));
  }
  
  const metaResult = validatePluginMetadata(p.metadata);
  if (!metaResult.success) {
    return err(metaResult.error);
  }
  
  if (!p.capabilities || typeof p.capabilities !== 'object') {
    return err(new ValidationError('capabilities', 'Plugin capabilities are required'));
  }
  
  if (typeof p.initialize !== 'function') {
    return err(new ValidationError('initialize', 'Plugin must have initialize method'));
  }
  
  if (typeof p.dispose !== 'function') {
    return err(new ValidationError('dispose', 'Plugin must have dispose method'));
  }
  
  return ok(p);
}
```

### Step 3: Commit

```bash
git add src/lib/plugins/plugin-interface.ts src/lib/plugins/plugin-validator.ts
git commit -m "feat: add unified plugin interface and validation"
```

---

## Task 6: Integration Tests

**Files:**
- Create: `tests/integration/chat-flow.test.ts`
- Create: `tests/integration/character-lifecycle.test.ts`
- Create: `tests/helpers/test-utils.ts`

### Step 1: Create Test Utilities

**File:** `tests/helpers/test-utils.ts`

```typescript
/**
 * Integration test utilities.
 */

import { vi } from 'vitest';

export function mockStorage() {
  const storage = new Map<string, unknown>();
  
  return {
    get: vi.fn((key: string) => storage.get(key)),
    set: vi.fn((key: string, value: unknown) => storage.set(key, value)),
    delete: vi.fn((key: string) => storage.delete(key)),
    clear: vi.fn(() => storage.clear()),
    keys: vi.fn(() => Array.from(storage.keys())),
  };
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
```

### Step 2: Create Chat Flow Integration Test

**File:** `tests/integration/chat-flow.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { charactersRepo } from '$lib/repositories/characters-repo';
import { chatRepo } from '$lib/repositories/chat-repo';
import { charactersStore } from '$lib/stores/characters';
import { chatStore } from '$lib/stores/chat';
import { sendMessage } from '$lib/core/chat/use-chat';

vi.mock('$lib/storage/characters');
vi.mock('$lib/storage/chats');
vi.mock('$lib/core/bootstrap');

describe('Chat Flow Integration', () => {
  beforeEach(() => {
    charactersStore.reset();
    chatStore.clear();
    vi.clearAllMocks();
  });

  it('should load character and start chat session', async () => {
    const mockCharacter = {
      id: 'char-1',
      name: 'Test Character',
      firstMessage: 'Hello!',
    };
    
    // Setup mocks
    const { loadCharacter } = await import('$lib/storage/characters');
    vi.mocked(loadCharacter).mockResolvedValue(mockCharacter);
    
    // Load character
    await charactersRepo.selectCharacter('char-1');
    expect(get(charactersStore).currentId).toBe('char-1');
    
    // Start chat
    const { createSession } = await import('$lib/storage/chats');
    vi.mocked(createSession).mockResolvedValue({
      id: 'session-1',
      name: 'Chat',
      lastMessageAt: Date.now(),
    });
    
    await chatRepo.loadChat('char-1');
    expect(get(chatStore).chatId).toBe('char-1');
    expect(get(chatStore).sessionId).toBe('session-1');
  });

  it('should handle errors gracefully', async () => {
    const { loadCharacter } = await import('$lib/storage/characters');
    vi.mocked(loadCharacter).mockRejectedValue(new Error('Not found'));
    
    await expect(charactersRepo.selectCharacter('invalid-id')).rejects.toThrow();
    expect(get(charactersStore).isLoading).toBe(false);
  });
});
```

### Step 3: Commit

```bash
git add tests/integration/ tests/helpers/
git commit -m "test: add integration tests for critical user flows"
```

---

## Task 7: Component Error Boundaries

**Files:**
- Create: `src/lib/errors/error-boundary.svelte`
- Create: `src/routes/+error.svelte`
- Modify: `src/routes/+layout.svelte`

### Step 1: Create Error Boundary Component

**File:** `src/lib/errors/error-boundary.svelte`

```svelte
<script lang="ts">
  import ErrorState from '$lib/components/base/ErrorState.svelte';
  import { handleError } from './error-handler';

  interface Props {
    children: import('svelte').Snippet;
    fallback?: import('svelte').Snippet<[Error]>;
    onError?: (error: Error) => void;
  }

  let { children, fallback, onError }: Props = $props();

  let error: Error | null = $state(null);

  export function captureError(e: Error) {
    error = e;
    handleError(e, 'ErrorBoundary');
    onError?.(e);
  }

  function reset() {
    error = null;
  }
</script>

{#if error}
  {#if fallback}
    {@render fallback(error)}
  {:else}
    <ErrorState
      title="Something went wrong"
      message={error.message}
      onRetry={reset}
    />
  {/if}
{:else}
  {@render children()}
{/if}
```

### Step 2: Create Global Error Page

**File:** `src/routes/+error.svelte`

```svelte
<script lang="ts">
  import { page } from '$app/stores';
  import ErrorState from '$lib/components/base/ErrorState.svelte';
</script>

<div class="flex-1 flex items-center justify-center">
  <ErrorState
    title="Page Error"
    message={$page.error?.message || 'An unexpected error occurred'}
    onRetry={() => window.location.reload()}
  />
</div>
```

### Step 3: Commit

```bash
git add src/lib/errors/error-boundary.svelte src/routes/+error.svelte
git commit -m "feat: add error boundaries for graceful error recovery"
```

---

## Task 8: Final Verification & Documentation

**Files:**
- Create: `docs/architecture/ERROR_HANDLING.md`
- Create: `docs/architecture/PLUGIN_SYSTEM.md`
- Run all tests

### Step 1: Create Error Handling Documentation

**File:** `docs/architecture/ERROR_HANDLING.md`

```markdown
# Error Handling Architecture

## Overview

Terrarium uses a centralized error handling system with:
- Typed error hierarchy (AppError, StorageError, ProviderError, etc.)
- Structured logging with levels
- User-friendly error messages
- Error boundaries for UI resilience

## Usage

### In Repositories

```typescript
import { StorageError } from '$lib/errors/error-types';

async function loadData(): Promise<void> {
  try {
    const data = await storage.load();
    store.set(data);
  } catch (error) {
    throw new StorageError('loadData', 'Failed to load', error);
  }
}
```

### In Components

```svelte
<script>
  import { handleError } from '$lib/errors/error-handler';
  
  async function handleClick() {
    try {
      await repo.save();
    } catch (error) {
      handleError(error, 'ComponentName.handleClick', { showToast: true });
    }
  }
</script>
```

### Error Boundaries

Wrap components that might throw:

```svelte
<ErrorBoundary onError={(e) => logError(e)}>
  <RiskyComponent />
</ErrorBoundary>
```
```

### Step 2: Run Full Test Suite

```bash
npm test -- --run
```

### Step 3: Final Commit

```bash
git add docs/architecture/
git commit -m "docs: add error handling and plugin system documentation"
```

---

## Completion Checklist

- [ ] Error types and logger infrastructure
- [ ] Branded types for ID safety
- [ ] Error handler and UI components
- [ ] Repository error handling integration
- [ ] Plugin system standardization
- [ ] Integration tests
- [ ] Component error boundaries
- [ ] Documentation
- [ ] All tests passing

---

## Summary

This comprehensive refactoring establishes:

1. **Robust Error Handling** - Typed errors, contextual logging, user feedback
2. **Type Safety** - Branded types prevent ID mixing, strict null checks
3. **Architecture Patterns** - Standardized async handling, error boundaries
4. **Plugin System** - Unified interfaces, validation, lifecycle management
5. **Testing** - Integration tests for critical flows

**Estimated Impact:** 20+ files created/modified, 50+ new tests, production-ready error handling.