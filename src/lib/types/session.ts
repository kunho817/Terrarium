/**
 * Chat session type — represents a single conversation with a character.
 * A character can have multiple sessions, each with its own messages and scene state.
 */

export interface ChatSession {
  id: string;
  characterId: string;
  name: string;
  createdAt: number;
  lastMessageAt: number;
  preview: string; // first ~80 chars of last message
}
