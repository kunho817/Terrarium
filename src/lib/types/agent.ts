import type { Message } from './message';
import type { SceneState } from './scene';
import type { UserConfig } from './config';
import type { MemoryRecord, SessionSummary } from './memory';
import type { StateUpdate } from './agent-state';

export interface AgentConfig {
  id: string;
  name: string;
  enabled: boolean;
  modelSlot: 'chat' | 'memory' | 'director';
  settings: Record<string, unknown>;
}

export interface AgentContext {
  sessionId: string;
  cardId: string;
  cardType: 'character' | 'world';
  messages: Message[];
  scene: SceneState;
  turnNumber: number;
  config: UserConfig;
}

export interface AgentResult {
  injectPrompt?: string;
  updatedMemories?: MemoryRecord[];
  summaries?: SessionSummary[];
  updatedState?: StateUpdate;
}

export interface Agent {
  readonly id: string;
  readonly name: string;
  readonly priority: number;
  init(ctx: AgentContext): Promise<void>;
  onBeforeSend(ctx: AgentContext): Promise<AgentResult>;
  onAfterReceive(ctx: AgentContext, response: string): Promise<AgentResult>;
  shutdown(): Promise<void>;
}
