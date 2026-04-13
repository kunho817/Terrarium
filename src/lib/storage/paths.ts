/**
 * File path constants for the Terrarium data directory.
 * All paths are relative to Tauri's AppData directory.
 */

export const PATHS = {
  // Characters
  characters: 'characters',
  characterDir: (id: string) => `characters/${id}`,
  characterCard: (id: string) => `characters/${id}/card.json`,

  // Chats (session-aware)
  chats: 'chats',
  chatDir: (id: string) => `chats/${id}`, // legacy, kept for migration
  chatMessages: (id: string) => `chats/${id}/messages.json`, // legacy
  chatScene: (id: string) => `chats/${id}/scene.json`, // legacy
  characterChatDir: (characterId: string) => `chats/${characterId}`,
  sessionsIndex: (characterId: string) => `chats/${characterId}/sessions.json`,
  sessionDir: (characterId: string, sessionId: string) => `chats/${characterId}/${sessionId}`,
  sessionMessages: (characterId: string, sessionId: string) =>
    `chats/${characterId}/${sessionId}/messages.json`,
  sessionScene: (characterId: string, sessionId: string) =>
    `chats/${characterId}/${sessionId}/scene.json`,

  // Settings
  settings: 'settings.json',

  // Themes
  themes: 'themes',
  themeDir: (name: string) => `themes/${name}`,

  // Personas
  personas: 'personas',
  personaDir: (id: string) => `personas/${id}`,
  personaFile: (id: string) => `personas/${id}/persona.json`,

  // Worlds
  worlds: 'worlds',
  worldDir: (id: string) => `worlds/${id}`,
  worldFile: (id: string) => `worlds/${id}/world.json`,
} as const;
