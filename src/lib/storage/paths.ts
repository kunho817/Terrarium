/**
 * File path constants for the Terrarium data directory.
 * All paths are relative to Tauri's AppData directory.
 */

export const PATHS = {
  // Characters
  characters: 'characters',
  characterDir: (id: string) => `characters/${id}`,
  characterCard: (id: string) => `characters/${id}/card.json`,

  // Chats
  chats: 'chats',
  chatDir: (id: string) => `chats/${id}`,
  chatMessages: (id: string) => `chats/${id}/messages.json`,
  chatScene: (id: string) => `chats/${id}/scene.json`,

  // Settings
  settings: 'settings.json',

  // Themes
  themes: 'themes',
  themeDir: (name: string) => `themes/${name}`,
} as const;
