/**
 * Branded types for compile-time ID type safety.
 * Prevents mixing up different ID types (e.g., characterId vs worldId).
 */

declare const __brand: unique symbol;

type Brand<B> = { [__brand]: B };

export type Branded<T, B> = T & Brand<B>;

// ID types
export type CharacterId = Branded<string, 'CharacterId'>;
export type WorldId = Branded<string, 'WorldId'>;
export type SessionId = Branded<string, 'SessionId'>;
export type ChatId = Branded<string, 'ChatId'>;
export type PersonaId = Branded<string, 'PersonaId'>;

// Factory functions
export function makeCharacterId(id: string): CharacterId {
  return id as CharacterId;
}

export function makeWorldId(id: string): WorldId {
  return id as WorldId;
}

export function makeSessionId(id: string): SessionId {
  return id as SessionId;
}

export function makeChatId(id: string): ChatId {
  return id as ChatId;
}

export function makePersonaId(id: string): PersonaId {
  return id as PersonaId;
}
