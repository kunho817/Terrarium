/**
 * Message types for the chat system.
 * Spec reference: Section 8 — Shared Types > Messages
 */

import type { PipelineSnapshot } from './diagnostics';

export type MessageRole = 'user' | 'assistant' | 'system' | 'narrator';

export type MessageType = 'dialogue' | 'narrator' | 'action' | 'system';

export interface GenerationInfo {
  providerId?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  durationMs?: number;
  firstTokenLatencyMs?: number;
  streamError?: string;
  pipeline?: PipelineSnapshot | null;
}

export interface ContentSegment {
  type: 'text' | 'image';
  text?: string;
  dataUrl?: string;
  prompt?: string;
  id?: string;
}

export interface IllustrationPlan {
  afterParagraph: number;
  prompt: string;
}

export interface Message {
  role: MessageRole;
  characterId?: string;
  content: string;
  action?: string;
  type: MessageType;
  timestamp: number;
  generationInfo?: GenerationInfo;
  segments?: ContentSegment[];
  revision?: number;
  isFirstMessage?: boolean;
}
