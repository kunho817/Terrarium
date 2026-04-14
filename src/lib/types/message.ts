/**
 * Message types for the chat system.
 * Spec reference: Section 8 — Shared Types > Messages
 */

export type MessageRole = 'user' | 'assistant' | 'system' | 'narrator';

export type MessageType = 'dialogue' | 'narrator' | 'action' | 'system';

export interface GenerationInfo {
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  durationMs?: number;
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
