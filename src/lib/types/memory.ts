export const MEMORY_TYPES = [
  'event',
  'trait',
  'relationship',
  'location',
  'state',
  'world_fact',
  'personal_event',
  'general',
] as const;

export type MemoryType = (typeof MEMORY_TYPES)[number];

export type WriteMode = 'append' | 'overwrite';

export const MEMORY_WRITE_MODES: Record<MemoryType, WriteMode> = {
  event: 'append',
  trait: 'overwrite',
  relationship: 'overwrite',
  location: 'overwrite',
  state: 'overwrite',
  world_fact: 'overwrite',
  personal_event: 'append',
  general: 'append',
};

import type { SessionId } from './branded';

export interface MemoryRecord {
  id: string;
  sessionId: SessionId;
  type: MemoryType;
  content: string;
  importance: number;
  sourceMessageIds: string[];
  turnNumber: number;
  createdAt: number;
  embedding: number[];
}

export interface SessionSummary {
  id: string;
  sessionId: SessionId;
  startTurn: number;
  endTurn: number;
  summary: string;
  createdAt: number;
}

export interface ExtractionResult {
  facts: Array<{
    content: string;
    type: MemoryType;
    importance: number;
  }>;
}

export const DEFAULT_EXTRACTION_PROMPT = `You are a memory extraction system. Analyze the following conversation and extract important facts that should be remembered for future reference.

For each fact, provide:
- content: A concise statement of the fact
- type: One of "event" (things that happened), "trait" (character qualities), "relationship" (how characters relate), "location" (place knowledge), "state" (current situation), "world_fact" (permanent world knowledge), "personal_event" (events involving the user), "general" (anything else)
- importance: A number from 0 to 1 indicating how important this fact is to remember (1 = critical, 0 = trivial)

Focus on facts that would be important for continuity in a long roleplay session: character details, plot events, relationship changes, world knowledge, and current states.

Output as JSON:
{"facts": [{"content": "...", "type": "event", "importance": 0.8}, ...]}`;

export const DEFAULT_SUMMARY_PROMPT = `You are a narrative summarizer. Summarize the following conversation segment, preserving key events, character developments, relationship changes, and important plot details. Write in a concise narrative style that captures the essence of what happened. Focus on information that would be needed for story continuity.`;
