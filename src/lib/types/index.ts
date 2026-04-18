/**
 * Barrel export for all shared types.
 * Usage: import type { Message, CharacterCard } from '$lib/types';
 */

// Message
export type {
  MessageRole,
  MessageType,
  GenerationInfo,
  ContentSegment,
  IllustrationPlan,
  Message,
} from './message';

// Config
export type {
  ConfigFieldType,
  ConfigField,
  UserConfig,
  ModelInfo,
  ModelSlot,
  MemorySettings,
} from './config';

// Script
export type {
  RegexStage,
  RegexScript,
  VariableValue,
  VariableStore,
} from './script';

// Trigger
export type {
  TriggerEvent,
  TriggerMatchOn,
  Trigger,
} from './trigger';

// Lorebook
export type {
  LorebookPosition,
  LorebookMode,
  LorebookScope,
  LorebookEntry,
  LorebookSettings,
  Lorebook,
} from './lorebook';

// Scene
export type { SceneState } from './scene';

// Session
export type { ChatSession, SessionsFile } from './session';

// Prompt Preset
export type {
  PromptItemType,
  PromptItemRole,
  PromptItem,
  PromptPreset,
  PromptPresetSettings,
} from './prompt-preset';

// Character
export type { DepthPrompt, CharacterCard } from './character';

// World
export type { WorldCard, WorldCharacter } from './world';
export { createDefaultWorldCard } from './world';

// Persona
export type { UserPersona } from './persona';

// Plugin & ChatContext
export type {
  ProviderPlugin,
  CardFormatPlugin,
  ChatContext,
  AgentPlugin,
  ImageProviderPlugin,
  PromptBuilderPlugin,
  ChatMetadata,
} from './plugin';

// Art Style
export type { ArtStylePreset } from './art-style';
export { DEFAULT_ART_PRESETS } from './art-style';

// Image Config
export type { ImageGenerationConfig } from './image-config';
export { DEFAULT_IMAGE_CONFIG } from './image-config';

// Memory
export type {
  MemoryType,
  WriteMode,
  MemoryRecord,
  SessionSummary,
  ExtractionResult,
} from './memory';
export { MEMORY_WRITE_MODES, DEFAULT_EXTRACTION_PROMPT, DEFAULT_SUMMARY_PROMPT } from './memory';

// Agent
export type {
  AgentConfig,
  AgentContext,
  AgentResult,
  ProgressCallback,
  Agent,
} from './agent';

// Branded Types
export type {
  CharacterId,
  WorldId,
  SessionId,
  ChatId,
  PersonaId,
} from './branded';
export {
  makeCharacterId,
  makeWorldId,
  makeSessionId,
  makeChatId,
  makePersonaId,
} from './branded';

// Blocks
export type {
  BlockType,
  BlockDefinition,
  BlockInstance,
  BlockConfig,
  Connection,
  BlockGraph,
  Port,
  PortType,
  InputPort,
  OutputPort,
} from './blocks';

// Block Execution
export type {
  ExecutionContext,
  PromptFragment,
  PortValue,
  BlockExecutionResult,
  BlockExecutor,
  ExecutionError,
} from './block-execution';

// Scratch Blocks
export type {
  ScratchBlock,
  ScratchScript,
  SlotType,
  SlotDefinition,
  BlockDefinition as ScratchBlockDefinition,
  BlockType as ScratchBlockType,
  BlockConfig as ScratchBlockConfig,
} from './scratch-blocks';
export { createBlock, createScript } from './scratch-blocks';
