/**
 * Unified plugin interface definitions.
 * Standardizes how all plugins (providers, card formats, prompt builders, image providers)
 * are structured and validated.
 */

import type { Result } from '$lib/types/result';
import type { CharacterCard } from '$lib/types';

// ============================================================================
// Base Plugin Interface
// ============================================================================

export interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  license?: string;
}

export interface PluginCapabilities {
  readonly canConfigure: boolean;
  readonly canImport: boolean;
  readonly canExport: boolean;
}

export interface BasePlugin {
  readonly metadata: PluginMetadata;
  readonly capabilities: PluginCapabilities;
  
  /**
   * Initialize the plugin. Called once when the plugin is registered.
   */
  initialize(): Promise<Result<void, Error>>;
  
  /**
   * Clean up resources. Called when the plugin is unregistered.
   */
  dispose(): Promise<void>;
}

// ============================================================================
// AI Provider Plugin
// ============================================================================

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  [key: string]: unknown;
}

export interface AIProviderCapabilities extends PluginCapabilities {
  readonly supportsStreaming: boolean;
  readonly supportsImages: boolean;
  readonly supportsToolUse: boolean;
  readonly supportsSystemPrompt: boolean;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface StreamResponse {
  text: string;
  isComplete: boolean;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface AIProvider extends BasePlugin {
  readonly capabilities: AIProviderCapabilities;
  
  /**
   * Validate provider configuration.
   */
  validateConfig(config: ProviderConfig): Result<void, Error>;
  
  /**
   * Send a message and get a streaming response.
   */
  sendMessage(
    messages: Message[],
    config: ProviderConfig
  ): Promise<Result<AsyncGenerator<StreamResponse>, Error>>;
  
  /**
   * List available models for this provider.
   */
  listModels?(config: ProviderConfig): Promise<Result<string[], Error>>;
}

// ============================================================================
// Card Format Plugin
// ============================================================================

export interface CardFormatCapabilities extends PluginCapabilities {
  readonly supportsImport: boolean;
  readonly supportsExport: boolean;
  readonly supportsMultipleCards: boolean;
}

export interface ImportResult {
  cards: CharacterCard[];
  warnings?: string[];
}

export interface CardFormat extends BasePlugin {
  readonly capabilities: CardFormatCapabilities;
  
  /**
   * Check if data can be imported by this format.
   */
  detectFormat(data: unknown): boolean;
  
  /**
   * Import data into CharacterCard format.
   */
  import(data: unknown): Result<ImportResult, Error>;
  
  /**
   * Export a card to this format.
   */
  export(card: CharacterCard): Result<string, Error>;
  
  /**
   * Get file extensions supported by this format.
   */
  getFileExtensions(): string[];
}

// ============================================================================
// Image Provider Plugin
// ============================================================================

export interface ImageProviderCapabilities extends PluginCapabilities {
  readonly supportsNegativePrompt: boolean;
  readonly supportsImg2Img: boolean;
  readonly supportsControlNet: boolean;
  readonly supportedSizes: Array<{ width: number; height: number }>;
}

export interface ImageGenerationConfig {
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  steps?: number;
  cfgScale?: number;
  seed?: number;
  [key: string]: unknown;
}

export interface ImageGenerationResult {
  dataUrl: string;
  prompt: string;
  metadata?: {
    model?: string;
    seed?: number;
    steps?: number;
    cfgScale?: number;
  };
}

export interface ImageProvider extends BasePlugin {
  readonly capabilities: ImageProviderCapabilities;
  
  /**
   * Validate image generation configuration.
   */
  validateConfig(config: ImageGenerationConfig): Result<void, Error>;
  
  /**
   * Generate an image.
   */
  generateImage(
    config: ImageGenerationConfig
  ): Promise<Result<ImageGenerationResult, Error>>;
  
  /**
   * Generate multiple images in batch.
   */
  generateBatch?(
    configs: ImageGenerationConfig[]
  ): Promise<Result<ImageGenerationResult[], Error>>;
}

// ============================================================================
// Prompt Builder Plugin
// ============================================================================

export interface PromptContext {
  card: CharacterCard;
  messages: Message[];
  scene?: {
    location?: string;
    time?: string;
    mood?: string;
  };
  persona?: {
    name?: string;
    description?: string;
  };
  variables?: Record<string, string | number | boolean>;
}

export interface PromptBuilder extends BasePlugin {
  /**
   * Build a prompt from template and context.
   */
  buildPrompt(
    template: string,
    context: PromptContext
  ): Result<string, Error>;
  
  /**
   * Get available template variables.
   */
  getTemplateVariables(): string[];
}

// ============================================================================
// Plugin Type Helpers
// ============================================================================

export type PluginType = 'provider' | 'cardFormat' | 'imageProvider' | 'promptBuilder';

export interface TypedPlugin {
  type: PluginType;
  plugin: BasePlugin;
}

/**
 * Type guard for AIProvider.
 */
export function isAIProvider(plugin: BasePlugin): plugin is AIProvider {
  return 'sendMessage' in plugin && typeof (plugin as AIProvider).sendMessage === 'function';
}

/**
 * Type guard for CardFormat.
 */
export function isCardFormat(plugin: BasePlugin): plugin is CardFormat {
  return 'detectFormat' in plugin && typeof (plugin as CardFormat).detectFormat === 'function';
}

/**
 * Type guard for ImageProvider.
 */
export function isImageProvider(plugin: BasePlugin): plugin is ImageProvider {
  return 'generateImage' in plugin && typeof (plugin as ImageProvider).generateImage === 'function';
}

/**
 * Type guard for PromptBuilder.
 */
export function isPromptBuilder(plugin: BasePlugin): plugin is PromptBuilder {
  return 'buildPrompt' in plugin && typeof (plugin as PromptBuilder).buildPrompt === 'function';
}
