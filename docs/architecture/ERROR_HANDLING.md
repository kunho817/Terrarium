# Error Handling Architecture

## Overview

Terrarium uses a centralized error handling system with:
- Typed error hierarchy (AppError, StorageError, ProviderError, etc.)
- Structured logging with levels
- User-friendly error messages
- Error boundaries for UI resilience

## Error Types

### Base Error Class

All errors extend `AppError` which provides:
- `severity`: 'fatal' | 'error' | 'warning' | 'info'
- `category`: 'storage' | 'network' | 'provider' | 'validation' | 'runtime' | 'unknown'
- `userMessage`: Human-readable description
- `context`: Operation details and metadata
- `toJSON()`: Serializable error representation

### Error Hierarchy

```
AppError (abstract)
├── StorageError      # Database/storage operations
├── ProviderError     # AI provider API errors
├── ValidationError   # Input validation (warning severity)
└── NetworkError      # Network/connection issues
```

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
<script>
  import ErrorBoundary from '$lib/errors/error-boundary.svelte';
</script>

<ErrorBoundary onError={(e) => logError(e)}>
  <RiskyComponent />
</ErrorBoundary>
```

## Logging

### Logger Usage

```typescript
import { logger } from '$lib/utils/logger';

// Create scoped logger
const log = logger.scope('MyComponent');

// Log with context
log.info('Operation completed', { duration: 123 });
log.error('Operation failed', { error: err.message });
```

### Log Levels

- `debug`: Development-only detailed information
- `info`: General operational events
- `warn`: Non-critical issues
- `error`: Critical failures

Log level is controlled via `VITE_LOG_LEVEL` environment variable.

## Error Handler Options

```typescript
interface ErrorHandlerOptions {
  showToast?: boolean;      // Show user notification
  logToConsole?: boolean;   // Log to console
  rethrow?: boolean;        // Re-throw after handling
}
```

## Best Practices

1. **Always wrap storage operations** with appropriate error types
2. **Use structured logging** with contextual data
3. **Provide user-friendly messages** via `userMessage` property
4. **Use error boundaries** for component-level error isolation
5. **Handle errors at appropriate levels** - don't catch too early or too late
6. **Preserve error chains** by passing originalError when wrapping
