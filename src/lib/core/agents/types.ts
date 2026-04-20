import type { Message } from '$lib/types/message';
import type { SceneState } from '$lib/types/scene';
import type { UserConfig } from '$lib/types/config';
import type { SessionId, CharacterId } from '$lib/types/branded';

export interface CharacterSnapshot {
  name: string;
  emotion: string;
  location: string;
  inventory: string[];
  health: string;
  notes: string;
}

export interface ExtractionSnapshot {
  turnNumber: number;
  timestamp: number;
  scene: {
    location: string;
    characters: string[];
    atmosphere: string;
    timeOfDay: string;
    environmentalNotes: string;
  };
  characters: Record<string, CharacterSnapshot>;
  events: string[];
  newFacts: string[];
  changed: string[];
}

export interface WorldExtractionFields {
  worldRules: string[];
  entities: EntityRecord[];
  relations: RelationRecord[];
}

export interface EntityRecord {
  id: string;
  name: string;
  type: 'character' | 'location' | 'faction' | 'item' | 'other';
  description: string;
  attributes: Record<string, string>;
  lastUpdated: number;
}

export interface RelationRecord {
  subjectId: string;
  objectId: string;
  relationType: string;
  description: string;
  lastUpdated: number;
}

export interface WorldFactRecord {
  id: string;
  content: string;
  category: string;
  importance: number;
  source: string;
  createdAt: number;
}

export interface TurnSnapshot {
  turnNumber: number;
  extractionSummary: string;
  events: string[];
  timestamp: number;
}

export interface NarrativeState {
  currentArc: string;
  activeTensions: string[];
  recentDecisions: string[];
  nextBeats: string[];
  turnNumber: number;
}

export interface TurnMaintenanceOutput {
  narrativeBrief: string;
  correction: {
    shouldCorrect: boolean;
    reasons: string[];
    correctedEntities?: Partial<EntityRecord>[];
    correctedRelations?: Partial<RelationRecord>[];
  };
  storyAuthor: {
    currentArc: string;
    narrativeGoal: string;
    activeTensions: string[];
    nextBeats: string[];
    guardrails: string[];
    focusCharacters: string[];
    recentDecisions: string[];
  };
  director: {
    sceneMandate: string;
    requiredOutcomes: string[];
    forbiddenMoves: string[];
    emphasis: string[];
    targetPacing: 'slow' | 'normal' | 'fast';
    pressureLevel: 'low' | 'medium' | 'high';
    focusCharacters: string[];
  };
}

export interface SessionAgentState {
  sessionId: string;
  lastExtraction: ExtractionSnapshot | null;
  lastTurnMaintenance: TurnMaintenanceOutput | null;
  entities: Record<string, EntityRecord>;
  relations: RelationRecord[];
  worldFacts: WorldFactRecord[];
  turnHistory: TurnSnapshot[];
  narrativeState: NarrativeState;
}

export interface AgentPipelineContext {
  sessionId: SessionId;
  cardId: CharacterId;
  cardType: 'character' | 'world';
  messages: Message[];
  scene: SceneState;
  turnNumber: number;
  config: UserConfig;
}

export type PipelineStepStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

export interface PipelineProgressCallback {
  (step: string, status: PipelineStepStatus): void;
}
