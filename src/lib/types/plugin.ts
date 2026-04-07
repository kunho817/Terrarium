/**
 * Plugin interfaces and ChatContext.
 * Spec reference: Section 3 — Plugin System, Section 8 — ChatContext
 */

import type { Message } from './message';
import type { CharacterCard } from './character';
import type { SceneState } from './scene';
import type { LorebookEntry } from './lorebook';
import type { UserConfig, ConfigField, ModelInfo } from './config';

// === Provider Plugin (AI Backend) ===
// Spec reference: Section 3.1

export interface ProviderPlugin {
  id: string;
  name: string;
  icon?: string;
  requiredConfig: ConfigField[];

  chat(messages: Message[], config: UserConfig): AsyncGenerator<string>;
  chatWithCard(
    messages: Message[],
    card: CharacterCard,
    config: UserConfig
  ): AsyncGenerator<string>;
  listModels?(config: UserConfig): Promise<ModelInfo[]>;
  validateConfig(config: UserConfig): Promise<boolean>;
}

// === Card Format Plugin ===
// Spec reference: Section 3.2

export interface CardFormatPlugin {
  id: string;
  name: string;
  supportedExtensions: string[];

  parse(data: ArrayBuffer): CharacterCard;
  export(card: CharacterCard): ArrayBuffer;
  validate(data: ArrayBuffer): boolean;
}

// === Chat Context ===
// Spec reference: Section 8 — ChatContext

export interface ChatContext {
  messages: Message[];
  card: CharacterCard;
  scene: SceneState;
  config: UserConfig;
  additionalPrompt?: string;
  lorebookMatches: LorebookEntry[];
}

// === Agent Plugin (v2 expansion) ===
// Spec reference: Section 3.3

export interface AgentPlugin {
  id: string;
  name: string;

  onBeforeSend(ctx: ChatContext): Promise<ChatContext>;
  onAfterReceive(ctx: ChatContext, response: string): Promise<string>;
  runBackground(ctx: ChatContext): Promise<void>;
}

// === Image Provider Plugin (v2 expansion) ===
// Spec reference: Section 3.4

export interface ImageProviderPlugin {
  id: string;
  name: string;
  generateImage(prompt: string, config: UserConfig): Promise<ArrayBuffer>;
  requiredConfig: ConfigField[];
}

// === Prompt Builder Plugin (v1 built-in) ===
// Spec reference: Section 3.5

export interface PromptBuilderPlugin {
  id: string;
  name: string;

  buildSystemPrompt(card: CharacterCard, scene: SceneState): string;
  buildContext(messages: Message[], scene: SceneState): string;
}
