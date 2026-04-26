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

export type {
  PipelineStepStatus,
  PipelineSubTaskDiagnostic,
  StepDiagnostic,
  PipelineStepSnapshot,
  PipelineSnapshot,
} from './diagnostics';

// Config
export type {
  ConfigFieldType,
  ConfigField,
  UserConfig,
  ModelInfo,
  ModelSlot,
  GraphPromptTemplate,
  MemorySettings,
  AgentSettings,
  ResponseLengthTierId,
  AgentPromptOverrideSettings,
  AgentPromptPrefillSettings,
  AgentPromptGraphKey,
  AgentPromptGraphSettings,
} from './config';

export {
  RESPONSE_LENGTH_TIERS,
  DEFAULT_RESPONSE_LENGTH_TIER,
  DEFAULT_TARGET_IMAGE_COUNT,
  OUTPUT_LANGUAGE_OPTIONS,
  getResponseLengthTier,
  buildResponseLengthInstruction,
  clampTargetImageCount,
} from './chat-settings';

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
  PromptBlockToggle,
  PromptScript,
  PromptScriptStage,
  PromptScriptTarget,
  PromptScriptBlock,
  PromptScriptTargetKey,
  PromptScriptComposeMode,
  PromptPreset,
  PromptPresetSettings,
} from './prompt-preset';

// Character
export type { DepthPrompt, CharacterCard } from './character';

// World
export type { WorldCard, WorldCharacter, AlternateGreeting, WorldScenario, WorldSettings } from './world';
export { createDefaultWorldCard } from './world';

// Persona
export type { UserPersona } from './persona';

// Plugin & ChatContext
export type {
  ProviderPlugin,
  CardFormatPlugin,
  ChatContext,
  ImageProviderPlugin,
  PromptBuilderPlugin,
  ChatMetadata,
} from './plugin';

// Art Style
export type { ArtStylePreset } from './art-style';
export { DEFAULT_ART_PRESETS } from './art-style';

// Image Config
export type { ImageGenerationConfig, ImagePromptGraphKey } from './image-config';
export { DEFAULT_IMAGE_CONFIG, DEFAULT_IMAGE_JAILBREAK, DEFAULT_IMAGE_PLACEMENT_INSTRUCTIONS } from './image-config';

// Memory
export type {
  MemoryType,
  WriteMode,
  MemoryRecord,
  SessionSummary,
  ExtractionResult,
} from './memory';
export { MEMORY_WRITE_MODES, DEFAULT_EXTRACTION_PROMPT, DEFAULT_SUMMARY_PROMPT } from './memory';

export type {
  AgentPipelineContext,
  SessionAgentState,
  ExtractionSnapshot,
  TurnMaintenanceOutput,
  NarrativeState,
  CharacterSnapshot,
  EntityRecord,
  RelationRecord,
  AgentPromptSections,
  AgentPromptSectionType,
} from '../core/agents/types';

export { AgentPipeline } from '../core/agents/agent-pipeline';

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

