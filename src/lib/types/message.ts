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

export interface GeneratedImage {
  id: string;
  path: string;
  prompt: string;
  tagIndex: number;
  charId: string;
  sessionId: string;
  timestamp: number;
}

export interface Message {
  role: MessageRole;
  characterId?: string;
  content: string;
  action?: string;
  type: MessageType;
  timestamp: number;
  generationInfo?: GenerationInfo;
  image?: {
    filename: string;
    prompt: string;
  };
  images?: GeneratedImage[];
}
