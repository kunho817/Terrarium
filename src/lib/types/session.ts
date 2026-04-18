import type { CharacterId, SessionId, PersonaId } from './branded';

/**
 * Chat session type — represents a single conversation with a character.
 * A character can have multiple sessions, each with its own messages and scene state.
 */

export interface ChatSession {
  id: SessionId;
  characterId: CharacterId;
  name: string;
  createdAt: number;
  lastMessageAt: number;
  preview: string;
  personaId?: PersonaId;
  cardType?: 'character' | 'world';
  pinnedAt?: number;
}
