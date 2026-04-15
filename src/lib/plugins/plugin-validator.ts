/**
 * Plugin validation utilities.
 * Ensures all plugins meet the required interface before registration.
 */

import { ValidationError } from '$lib/errors/error-types';
import { logger } from '$lib/utils/logger';
import { ok, err, type Result } from '$lib/types/result';
import type {
  BasePlugin,
  PluginMetadata,
  PluginCapabilities,
  AIProvider,
  CardFormat,
  ImageProvider,
  PromptBuilder,
} from './plugin-interface';

const log = logger.scope('PluginValidator');

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate plugin metadata.
 */
export function validateMetadata(
  metadata: unknown
): Result<PluginMetadata, ValidationError> {
  if (!metadata || typeof metadata !== 'object') {
    return err(new ValidationError('metadata', 'Metadata must be an object'));
  }
  
  const m = metadata as Record<string, unknown>;
  const errors: string[] = [];
  
  // Required fields
  if (!m.id || typeof m.id !== 'string' || m.id.length === 0) {
    errors.push('Plugin ID is required and must be a non-empty string');
  }
  
  if (!m.name || typeof m.name !== 'string' || m.name.length === 0) {
    errors.push('Plugin name is required and must be a non-empty string');
  }
  
  if (!m.version || typeof m.version !== 'string') {
    errors.push('Plugin version is required and must be a string');
  } else if (!isValidSemver(m.version)) {
    errors.push('Plugin version must follow semantic versioning (e.g., "1.0.0")');
  }
  
  if (errors.length > 0) {
    return err(new ValidationError('metadata', errors.join('; ')));
  }
  
  return ok(m as PluginMetadata);
}

/**
 * Validate plugin capabilities.
 */
export function validateCapabilities(
  capabilities: unknown
): Result<PluginCapabilities, ValidationError> {
  if (!capabilities || typeof capabilities !== 'object') {
    return err(new ValidationError('capabilities', 'Capabilities must be an object'));
  }
  
  const c = capabilities as Record<string, unknown>;
  
  // Check required boolean fields
  const requiredBooleans = ['canConfigure', 'canImport', 'canExport'];
  for (const field of requiredBooleans) {
    if (typeof c[field] !== 'boolean') {
      return err(new ValidationError('capabilities', `${field} must be a boolean`));
    }
  }
  
  return ok(c as PluginCapabilities);
}

/**
 * Validate base plugin interface.
 */
export function validateBasePlugin(
  plugin: unknown
): Result<BasePlugin, ValidationError> {
  if (!plugin || typeof plugin !== 'object') {
    return err(new ValidationError('plugin', 'Plugin must be an object'));
  }
  
  const p = plugin as Record<string, unknown>;
  
  // Validate metadata
  if (!p.metadata) {
    return err(new ValidationError('metadata', 'Plugin metadata is required'));
  }
  
  const metaResult = validateMetadata(p.metadata);
  if (!metaResult.success) {
    return err(metaResult.error);
  }
  
  // Validate capabilities
  if (!p.capabilities) {
    return err(new ValidationError('capabilities', 'Plugin capabilities are required'));
  }
  
  const capResult = validateCapabilities(p.capabilities);
  if (!capResult.success) {
    return err(capResult.error);
  }
  
  // Validate required methods
  if (typeof p.initialize !== 'function') {
    return err(new ValidationError('initialize', 'Plugin must have an initialize method'));
  }
  
  if (typeof p.dispose !== 'function') {
    return err(new ValidationError('dispose', 'Plugin must have a dispose method'));
  }
  
  return ok(plugin as BasePlugin);
}

/**
 * Validate AI Provider plugin.
 */
export function validateAIProvider(
  plugin: BasePlugin
): Result<AIProvider, ValidationError> {
  const p = plugin as Record<string, unknown>;
  
  // Check for required methods
  if (typeof p.validateConfig !== 'function') {
    return err(new ValidationError('validateConfig', 'AIProvider must have validateConfig method'));
  }
  
  if (typeof p.sendMessage !== 'function') {
    return err(new ValidationError('sendMessage', 'AIProvider must have sendMessage method'));
  }
  
  // Check for required capabilities
  const caps = p.capabilities as Record<string, unknown> | undefined;
  if (!caps) {
    return err(new ValidationError('capabilities', 'AIProvider capabilities are required'));
  }
  
  const requiredCapabilities = ['supportsStreaming', 'supportsImages', 'supportsToolUse', 'supportsSystemPrompt'];
  for (const cap of requiredCapabilities) {
    if (typeof caps[cap] !== 'boolean') {
      return err(new ValidationError('capabilities', `AIProvider must declare ${cap} capability`));
    }
  }
  
  return ok(plugin as AIProvider);
}

/**
 * Validate Card Format plugin.
 */
export function validateCardFormat(
  plugin: BasePlugin
): Result<CardFormat, ValidationError> {
  const p = plugin as Record<string, unknown>;
  
  // Check for required methods
  if (typeof p.detectFormat !== 'function') {
    return err(new ValidationError('detectFormat', 'CardFormat must have detectFormat method'));
  }
  
  if (typeof p.import !== 'function') {
    return err(new ValidationError('import', 'CardFormat must have import method'));
  }
  
  if (typeof p.export !== 'function') {
    return err(new ValidationError('export', 'CardFormat must have export method'));
  }
  
  if (typeof p.getFileExtensions !== 'function') {
    return err(new ValidationError('getFileExtensions', 'CardFormat must have getFileExtensions method'));
  }
  
  // Check capabilities
  const caps = p.capabilities as Record<string, unknown> | undefined;
  if (!caps) {
    return err(new ValidationError('capabilities', 'CardFormat capabilities are required'));
  }
  
  if (typeof caps.supportsImport !== 'boolean') {
    return err(new ValidationError('capabilities', 'CardFormat must declare supportsImport'));
  }
  
  if (typeof caps.supportsExport !== 'boolean') {
    return err(new ValidationError('capabilities', 'CardFormat must declare supportsExport'));
  }
  
  return ok(plugin as CardFormat);
}

/**
 * Validate Image Provider plugin.
 */
export function validateImageProvider(
  plugin: BasePlugin
): Result<ImageProvider, ValidationError> {
  const p = plugin as Record<string, unknown>;
  
  // Check for required methods
  if (typeof p.validateConfig !== 'function') {
    return err(new ValidationError('validateConfig', 'ImageProvider must have validateConfig method'));
  }
  
  if (typeof p.generateImage !== 'function') {
    return err(new ValidationError('generateImage', 'ImageProvider must have generateImage method'));
  }
  
  // Check capabilities
  const caps = p.capabilities as Record<string, unknown> | undefined;
  if (!caps) {
    return err(new ValidationError('capabilities', 'ImageProvider capabilities are required'));
  }
  
  const requiredCapabilities = ['supportsNegativePrompt', 'supportsImg2Img', 'supportsControlNet'];
  for (const cap of requiredCapabilities) {
    if (typeof caps[cap] !== 'boolean') {
      return err(new ValidationError('capabilities', `ImageProvider must declare ${cap} capability`));
    }
  }
  
  if (!Array.isArray(caps.supportedSizes)) {
    return err(new ValidationError('capabilities', 'ImageProvider must declare supportedSizes array'));
  }
  
  return ok(plugin as ImageProvider);
}

/**
 * Validate Prompt Builder plugin.
 */
export function validatePromptBuilder(
  plugin: BasePlugin
): Result<PromptBuilder, ValidationError> {
  const p = plugin as Record<string, unknown>;
  
  // Check for required methods
  if (typeof p.buildPrompt !== 'function') {
    return err(new ValidationError('buildPrompt', 'PromptBuilder must have buildPrompt method'));
  }
  
  if (typeof p.getTemplateVariables !== 'function') {
    return err(new ValidationError('getTemplateVariables', 'PromptBuilder must have getTemplateVariables method'));
  }
  
  return ok(plugin as PromptBuilder);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a string is valid semantic version.
 */
function isValidSemver(version: string): boolean {
  const semverRegex = /^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9.]+))?(?:\+([a-zA-Z0-9.]+))?$/;
  return semverRegex.test(version);
}

// ============================================================================
// Composite Validation
// ============================================================================

/**
 * Validate any plugin and return specific type.
 */
export async function validatePlugin<T extends BasePlugin>(
  plugin: unknown,
  type: 'provider' | 'cardFormat' | 'imageProvider' | 'promptBuilder'
): Promise<Result<T, ValidationError>> {
  log.debug('Validating plugin', { type });
  
  // First validate as base plugin
  const baseResult = validateBasePlugin(plugin);
  if (!baseResult.success) {
    log.warn('Base plugin validation failed', { error: baseResult.error.message });
    return err(baseResult.error);
  }
  
  const basePlugin = baseResult.data;
  
  // Then validate specific type
  let specificResult: Result<BasePlugin, ValidationError>;
  
  switch (type) {
    case 'provider':
      specificResult = validateAIProvider(basePlugin);
      break;
    case 'cardFormat':
      specificResult = validateCardFormat(basePlugin);
      break;
    case 'imageProvider':
      specificResult = validateImageProvider(basePlugin);
      break;
    case 'promptBuilder':
      specificResult = validatePromptBuilder(basePlugin);
      break;
    default:
      return err(new ValidationError('type', `Unknown plugin type: ${type}`));
  }
  
  if (!specificResult.success) {
    log.warn(`${type} validation failed`, { error: specificResult.error.message });
    return err(specificResult.error);
  }
  
  log.info('Plugin validated successfully', { 
    type, 
    id: basePlugin.metadata.id,
    name: basePlugin.metadata.name 
  });
  
  return ok(specificResult.data as T);
}

/**
 * Batch validate multiple plugins.
 */
export async function validatePlugins<T extends BasePlugin>(
  plugins: Array<{ plugin: unknown; type: 'provider' | 'cardFormat' | 'imageProvider' | 'promptBuilder' }>
): Promise<{
  valid: Array<{ plugin: T; type: string }>;
  invalid: Array<{ plugin: unknown; type: string; error: ValidationError }>;
}> {
  const valid: Array<{ plugin: T; type: string }> = [];
  const invalid: Array<{ plugin: unknown; type: string; error: ValidationError }> = [];
  
  for (const { plugin, type } of plugins) {
    const result = await validatePlugin<T>(plugin, type);
    
    if (result.success) {
      valid.push({ plugin: result.data, type });
    } else {
      invalid.push({ plugin, type, error: result.error });
    }
  }
  
  log.info('Batch validation complete', { 
    total: plugins.length, 
    valid: valid.length, 
    invalid: invalid.length 
  });
  
  return { valid, invalid };
}
