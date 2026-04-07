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
}

export interface Message {
  role: MessageRole;
  characterId?: string;
  content: string;
  action?: string;
  type: MessageType;
  timestamp: number;
  generationInfo?: GenerationInfo;
}
