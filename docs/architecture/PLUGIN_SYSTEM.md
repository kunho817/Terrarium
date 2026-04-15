# Plugin System Architecture

## Overview

Terrarium uses a unified plugin system supporting four plugin types:
- **AI Provider**: LLM/API integrations (OpenAI, Claude, etc.)
- **Card Format**: Character card import/export formats (SillyTavern, RisuAI, etc.)
- **Image Provider**: Image generation services (NovelAI, ComfyUI, etc.)
- **Prompt Builder**: Template systems for prompt construction

All plugins implement a common lifecycle with standardized validation.

## Plugin Interface

### Base Plugin

Every plugin must implement:

```typescript
interface BasePlugin {
  readonly metadata: PluginMetadata;
  readonly capabilities: PluginCapabilities;
  
  initialize(): Promise<Result<void, Error>>;
  dispose(): Promise<void>;
}
```

### Metadata

```typescript
interface PluginMetadata {
  id: string;           // Unique identifier
  name: string;         // Display name
  version: string;      // Semantic version
  description?: string;
  author?: string;
  license?: string;
}
```

## Plugin Types

### AI Provider

For integrating LLM APIs:

```typescript
interface AIProvider extends BasePlugin {
  readonly capabilities: AIProviderCapabilities;
  
  validateConfig(config: ProviderConfig): Result<void, Error>;
  sendMessage(messages: Message[], config: ProviderConfig): 
    Promise<Result<AsyncGenerator<StreamResponse>, Error>>;
  listModels?(config: ProviderConfig): Promise<Result<string[], Error>>;
}
```

**Capabilities:**
- `supportsStreaming`: Real-time response streaming
- `supportsImages`: Vision/multimodal support
- `supportsToolUse`: Function calling
- `supportsSystemPrompt`: System message support

### Card Format

For character card import/export:

```typescript
interface CardFormat extends BasePlugin {
  readonly capabilities: CardFormatCapabilities;
  
  detectFormat(data: unknown): boolean;
  import(data: unknown): Result<ImportResult, Error>;
  export(card: CharacterCard): Result<string, Error>;
  getFileExtensions(): string[];
}
```

### Image Provider

For image generation:

```typescript
interface ImageProvider extends BasePlugin {
  readonly capabilities: ImageProviderCapabilities;
  
  validateConfig(config: ImageGenerationConfig): Result<void, Error>;
  generateImage(config: ImageGenerationConfig): 
    Promise<Result<ImageGenerationResult, Error>>;
}
```

### Prompt Builder

For custom prompt templating:

```typescript
interface PromptBuilder extends BasePlugin {
  buildPrompt(template: string, context: PromptContext): Result<string, Error>;
  getTemplateVariables(): string[];
}
```

## Validation

### Plugin Validator

Use `plugin-validator.ts` to validate plugins:

```typescript
import { validatePlugin, validatePluginMetadata } from '$lib/plugins/plugin-validator';

// Validate a complete plugin
const result = validatePlugin(myPlugin, 'provider');
if (!result.success) {
  console.error('Invalid plugin:', result.error.message);
}

// Validate just metadata
const metaResult = validatePluginMetadata(metadata);
```

### Validation Rules

- **ID**: Required, non-empty string
- **Name**: Required, non-empty string  
- **Version**: Required, valid semantic version
- **Capabilities**: Required object
- **Initialize/Dispose**: Required methods

## Type Guards

Check plugin types at runtime:

```typescript
import { isAIProvider, isCardFormat, isImageProvider, isPromptBuilder } from '$lib/plugins/plugin-interface';

if (isAIProvider(plugin)) {
  // plugin is AIProvider, can call sendMessage()
  const result = await plugin.sendMessage(messages, config);
}
```

## Error Handling

Plugins use the `Result<T, Error>` type for explicit error handling:

```typescript
import { ok, err } from '$lib/types/result';

function validateConfig(config: ProviderConfig): Result<void, Error> {
  if (!config.apiKey) {
    return err(new ValidationError('apiKey', 'API key is required'));
  }
  return ok(undefined);
}
```

## Result Type

The Result type forces explicit error handling:

```typescript
type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

// Usage
const result = await plugin.initialize();
if (result.success) {
  // Use result.data
} else {
  // Handle result.error
}
```

## Best Practices

1. **Always validate** plugins before registration
2. **Use type guards** for runtime type checking
3. **Return Results** instead of throwing for expected errors
4. **Implement dispose** to clean up resources
5. **Version consistently** using semantic versioning
6. **Document capabilities** clearly for users
