# Terrarium Storage Layer + Stores — Implementation Plan 2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement file-based storage using `tauri-plugin-fs` and Svelte reactive stores — the data persistence layer for characters, chats, scenes, and settings.

**Architecture:** All data stored as JSON files in the Tauri AppData directory (`characters/{id}/card.json`, `chats/{id}/messages.json`, `settings.json`). A `database.ts` module wraps `tauri-plugin-fs` with JSON helpers. Domain storage modules (characters, chats, settings) use the database module. Svelte `writable` stores provide reactive state and call storage for persistence.

**Tech Stack:** tauri-plugin-fs (Rust + npm), Vitest with vi.mock for testing, svelte/store writable

---

## Prerequisites

- Plan 1 completed (SvelteKit + Tauri + types + PluginRegistry)
- Working directory: `D:/Project/TextChatbot`

---

## File Structure (created by this plan)

```
D:/Project/TextChatbot/
├── src-tauri/
│   ├── Cargo.toml                          [MODIFY] add tauri-plugin-fs
│   ├── src/lib.rs                          [MODIFY] register fs plugin
│   └── capabilities/default.json           [MODIFY] add fs permissions
├── src/lib/
│   ├── storage/
│   │   ├── paths.ts                        [NEW] Path constants
│   │   ├── database.ts                     [NEW] JSON file I/O helpers
│   │   ├── characters.ts                   [NEW] Character CRUD
│   │   ├── chats.ts                        [NEW] Chat + Scene CRUD
│   │   └── settings.ts                     [NEW] Settings read/write
│   └── stores/
│       ├── chat.ts                         [NEW] Chat messages store
│       ├── characters.ts                   [NEW] Characters store
│       ├── scene.ts                        [NEW] Scene state store
│       ├── settings.ts                     [NEW] User settings store
│       └── theme.ts                        [NEW] Theme store
├── tests/
│   ├── __mocks__/
│   │   └── tauri-plugin-fs.ts             [NEW] Shared mock for plugin-fs
│   ├── storage/
│   │   ├── database.test.ts               [NEW] Database module tests
│   │   ├── characters.test.ts             [NEW] Character storage tests
│   │   └── chats.test.ts                  [NEW] Chat storage tests
│   └── stores/
│       └── characters-store.test.ts       [NEW] Characters store tests
```

---

### Task 1: Add tauri-plugin-fs

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/capabilities/default.json`

- [ ] **Step 1: Add Rust dependency**

In `src-tauri/Cargo.toml`, add after the existing `tauri-plugin-log = "2"` line:

```toml
tauri-plugin-fs = "2"
```

- [ ] **Step 2: Install npm package**

Run: `cd "D:/Project/TextChatbot" && npm install @tauri-apps/plugin-fs`

- [ ] **Step 3: Register plugin in lib.rs**

Replace `src-tauri/src/lib.rs` with:

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
```

- [ ] **Step 4: Add filesystem permissions**

Replace `src-tauri/capabilities/default.json` with:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "enables the default permissions",
  "windows": [
    "main"
  ],
  "permissions": [
    "core:default",
    "fs:default",
    {
      "identifier": "fs:allow-exists",
      "allow": [{ "path": "$APPDATA/**" }]
    },
    {
      "identifier": "fs:allow-read-text-file",
      "allow": [{ "path": "$APPDATA/**" }]
    },
    {
      "identifier": "fs:allow-write-text-file",
      "allow": [{ "path": "$APPDATA/**" }]
    },
    {
      "identifier": "fs:allow-read-dir",
      "allow": [{ "path": "$APPDATA/**" }]
    },
    {
      "identifier": "fs:allow-create-dir",
      "allow": [{ "path": "$APPDATA/**" }]
    },
    {
      "identifier": "fs:allow-remove",
      "allow": [{ "path": "$APPDATA/**" }]
    },
    {
      "identifier": "fs:allow-rename",
      "allow": [{ "path": "$APPDATA/**" }]
    },
    {
      "identifier": "fs:allow-copy-file",
      "allow": [{ "path": "$APPDATA/**" }]
    }
  ]
}
```

Note: If any permission identifier is incorrect for your Tauri v2 version, check `src-tauri/gen/schemas/desktop-schema.json` for the exact identifiers. The subagent should verify by running `cargo check` after making changes.

- [ ] **Step 5: Verify Rust compilation**

Run: `cd "D:/Project/TextChatbot/src-tauri" && cargo check`

Expected: Compilation succeeds with no errors.

- [ ] **Step 6: Commit**

Run:
```bash
cd "D:/Project/TextChatbot"
git add src-tauri/Cargo.toml src-tauri/src/lib.rs src-tauri/capabilities/default.json package.json package-lock.json
git commit -m "feat: add tauri-plugin-fs for file storage"
```

---

### Task 2: Storage Paths + Database Module (TDD)

**Files:**
- Create: `tests/__mocks__/tauri-plugin-fs.ts`
- Create: `src/lib/storage/paths.ts`
- Create: `src/lib/storage/database.ts`
- Create: `tests/storage/database.test.ts`

- [ ] **Step 1: Create shared mock for tauri-plugin-fs**

Write `tests/__mocks__/tauri-plugin-fs.ts`:
```typescript
import { vi } from 'vitest';

export const readTextFile = vi.fn();
export const writeTextFile = vi.fn();
export const readDir = vi.fn();
export const createDir = vi.fn();
export const exists = vi.fn();
export const remove = vi.fn();
export const rename = vi.fn();
export const copyFile = vi.fn();

export const BaseDirectory = {
  AppData: 1,
};
```

- [ ] **Step 2: Create storage paths module**

Write `src/lib/storage/paths.ts`:
```typescript
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
```

- [ ] **Step 3: Write failing tests for database module**

Write `tests/storage/database.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@tauri-apps/plugin-fs', () => import('../__mocks__/tauri-plugin-fs'));

import { readTextFile, writeTextFile, createDir, readDir, exists, remove } from '@tauri-apps/plugin-fs';
import { readJson, writeJson, ensureDir, listDirs, removePath, existsPath } from '$lib/storage/database';

describe('database', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('readJson', () => {
    it('parses JSON from file', async () => {
      const data = { name: 'test', value: 42 };
      vi.mocked(readTextFile).mockResolvedValue(JSON.stringify(data));

      const result = await readJson<{ name: string; value: number }>('test.json');

      expect(readTextFile).toHaveBeenCalledWith('test.json', { baseDir: 1 });
      expect(result).toEqual(data);
    });
  });

  describe('writeJson', () => {
    it('writes formatted JSON to file', async () => {
      vi.mocked(writeTextFile).mockResolvedValue(undefined);

      await writeJson('test.json', { name: 'test' });

      expect(writeTextFile).toHaveBeenCalledWith(
        'test.json',
        JSON.stringify({ name: 'test' }, null, 2),
        { baseDir: 1 }
      );
    });
  });

  describe('ensureDir', () => {
    it('creates directory if it does not exist', async () => {
      vi.mocked(exists).mockResolvedValue(false);
      vi.mocked(createDir).mockResolvedValue(undefined);

      await ensureDir('characters/abc');

      expect(createDir).toHaveBeenCalledWith(
        'characters/abc',
        { baseDir: 1, recursive: true }
      );
    });

    it('skips creation if directory already exists', async () => {
      vi.mocked(exists).mockResolvedValue(true);

      await ensureDir('characters/abc');

      expect(createDir).not.toHaveBeenCalled();
    });
  });

  describe('listDirs', () => {
    it('returns subdirectory names', async () => {
      vi.mocked(exists).mockResolvedValue(true);
      vi.mocked(readDir).mockResolvedValue([
        { name: 'char-1', isDirectory: true, isFile: false } as any,
        { name: 'char-2', isDirectory: true, isFile: false } as any,
        { name: 'file.txt', isDirectory: false, isFile: true } as any,
      ]);

      const result = await listDirs('characters');

      expect(result).toEqual(['char-1', 'char-2']);
    });

    it('returns empty array if directory does not exist', async () => {
      vi.mocked(exists).mockResolvedValue(false);

      const result = await listDirs('characters');

      expect(result).toEqual([]);
    });
  });

  describe('removePath', () => {
    it('removes path if it exists', async () => {
      vi.mocked(exists).mockResolvedValue(true);
      vi.mocked(remove).mockResolvedValue(undefined);

      await removePath('characters/old-char');

      expect(remove).toHaveBeenCalledWith(
        'characters/old-char',
        { baseDir: 1, recursive: true }
      );
    });

    it('does nothing if path does not exist', async () => {
      vi.mocked(exists).mockResolvedValue(false);

      await removePath('characters/nonexistent');

      expect(remove).not.toHaveBeenCalled();
    });
  });

  describe('existsPath', () => {
    it('returns true when path exists', async () => {
      vi.mocked(exists).mockResolvedValue(true);
      expect(await existsPath('settings.json')).toBe(true);
    });

    it('returns false when path does not exist', async () => {
      vi.mocked(exists).mockResolvedValue(false);
      expect(await existsPath('nonexistent.json')).toBe(false);
    });
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd "D:/Project/TextChatbot" && npm test`

Expected: FAIL — module `$lib/storage/database` does not exist.

- [ ] **Step 5: Implement database module**

Write `src/lib/storage/database.ts`:
```typescript
/**
 * Low-level file I/O helpers wrapping @tauri-apps/plugin-fs.
 * All operations use BaseDirectory.AppData as the root.
 */

import {
  readTextFile,
  writeTextFile,
  createDir,
  readDir,
  exists,
  remove,
  BaseDirectory,
} from '@tauri-apps/plugin-fs';

const BASE = { baseDir: BaseDirectory.AppData };

export async function readJson<T>(path: string): Promise<T> {
  const content = await readTextFile(path, BASE);
  return JSON.parse(content);
}

export async function writeJson(path: string, data: unknown): Promise<void> {
  await writeTextFile(path, JSON.stringify(data, null, 2), BASE);
}

export async function ensureDir(path: string): Promise<void> {
  if (!(await exists(path, BASE))) {
    await createDir(path, { ...BASE, recursive: true });
  }
}

export async function listDirs(path: string): Promise<string[]> {
  if (!(await exists(path, BASE))) {
    return [];
  }
  const entries = await readDir(path, BASE);
  return entries.filter((e) => e.isDirectory).map((e) => e.name);
}

export async function removePath(path: string): Promise<void> {
  if (await exists(path, BASE)) {
    await remove(path, { ...BASE, recursive: true });
  }
}

export async function existsPath(path: string): Promise<boolean> {
  return exists(path, BASE);
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd "D:/Project/TextChatbot" && npm test`

Expected: All database tests pass.

- [ ] **Step 7: Commit**

Run:
```bash
cd "D:/Project/TextChatbot"
git add src/lib/storage/paths.ts src/lib/storage/database.ts tests/__mocks__/tauri-plugin-fs.ts tests/storage/database.test.ts
git commit -m "feat: add storage paths and database module with tests"
```

---

### Task 3: Character Storage (TDD)

**Files:**
- Create: `src/lib/storage/characters.ts`
- Create: `tests/storage/characters.test.ts`

- [ ] **Step 1: Write failing tests**

Write `tests/storage/characters.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database module (one level above plugin-fs)
vi.mock('$lib/storage/database', () => ({
  readJson: vi.fn(),
  writeJson: vi.fn(),
  ensureDir: vi.fn(),
  listDirs: vi.fn(),
  removePath: vi.fn(),
  existsPath: vi.fn(),
}));

import { readJson, writeJson, ensureDir, listDirs, removePath } from '$lib/storage/database';
import {
  listCharacters,
  loadCharacter,
  saveCharacter,
  deleteCharacter,
  createCharacter,
} from '$lib/storage/characters';
import type { CharacterCard } from '$lib/types';

const mockCard: CharacterCard = {
  name: 'Test Character',
  description: 'A test character',
  personality: 'Friendly',
  scenario: 'Testing',
  firstMessage: 'Hello!',
  alternateGreetings: [],
  exampleMessages: '',
  systemPrompt: '',
  postHistoryInstructions: '',
  creator: 'test',
  characterVersion: '1.0',
  tags: [],
  creatorNotes: '',
  lorebook: [],
  loreSettings: { tokenBudget: 2048, scanDepth: 5, recursiveScanning: false, fullWordMatching: false },
  regexScripts: [],
  triggers: [],
  scriptState: {},
  emotionImages: [],
  additionalAssets: [],
  metadata: {},
};

describe('character storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listCharacters', () => {
    it('returns list of character ids and names', async () => {
      vi.mocked(listDirs).mockResolvedValue(['char-1', 'char-2']);
      vi.mocked(readJson)
        .mockResolvedValueOnce({ ...mockCard, name: 'Alice' })
        .mockResolvedValueOnce({ ...mockCard, name: 'Bob' });

      const result = await listCharacters();

      expect(result).toEqual([
        { id: 'char-1', name: 'Alice' },
        { id: 'char-2', name: 'Bob' },
      ]);
    });

    it('skips characters with invalid card data', async () => {
      vi.mocked(listDirs).mockResolvedValue(['good', 'bad']);
      vi.mocked(readJson)
        .mockResolvedValueOnce({ ...mockCard, name: 'Good' })
        .mockRejectedValueOnce(new Error('parse error'));

      const result = await listCharacters();

      expect(result).toEqual([{ id: 'good', name: 'Good' }]);
    });

    it('returns empty array when no characters exist', async () => {
      vi.mocked(listDirs).mockResolvedValue([]);

      const result = await listCharacters();

      expect(result).toEqual([]);
    });
  });

  describe('loadCharacter', () => {
    it('loads a character card by id', async () => {
      vi.mocked(readJson).mockResolvedValue(mockCard);

      const result = await loadCharacter('char-1');

      expect(readJson).toHaveBeenCalledWith('characters/char-1/card.json');
      expect(result).toEqual(mockCard);
    });
  });

  describe('saveCharacter', () => {
    it('creates directory and writes card', async () => {
      vi.mocked(ensureDir).mockResolvedValue(undefined);
      vi.mocked(writeJson).mockResolvedValue(undefined);

      await saveCharacter('char-1', mockCard);

      expect(ensureDir).toHaveBeenCalledWith('characters/char-1');
      expect(writeJson).toHaveBeenCalledWith('characters/char-1/card.json', mockCard);
    });
  });

  describe('deleteCharacter', () => {
    it('removes the character directory', async () => {
      vi.mocked(removePath).mockResolvedValue(undefined);

      await deleteCharacter('char-1');

      expect(removePath).toHaveBeenCalledWith('characters/char-1');
    });
  });

  describe('createCharacter', () => {
    it('generates an id and saves the card', async () => {
      vi.mocked(ensureDir).mockResolvedValue(undefined);
      vi.mocked(writeJson).mockResolvedValue(undefined);

      const id = await createCharacter(mockCard);

      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');
      expect(ensureDir).toHaveBeenCalled();
      expect(writeJson).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "D:/Project/TextChatbot" && npm test`

Expected: FAIL — module `$lib/storage/characters` does not exist.

- [ ] **Step 3: Implement character storage**

Write `src/lib/storage/characters.ts`:
```typescript
/**
 * Character card CRUD operations.
 * Character data stored as JSON in characters/{id}/card.json
 */

import type { CharacterCard } from '$lib/types';
import { readJson, writeJson, ensureDir, listDirs, removePath } from './database';
import { PATHS } from './paths';

export async function listCharacters(): Promise<{ id: string; name: string }[]> {
  const dirs = await listDirs(PATHS.characters);
  const characters: { id: string; name: string }[] = [];

  for (const id of dirs) {
    try {
      const card = await readJson<CharacterCard>(PATHS.characterCard(id));
      characters.push({ id, name: card.name });
    } catch {
      // Skip directories with invalid/corrupt card data
    }
  }

  return characters;
}

export async function loadCharacter(id: string): Promise<CharacterCard> {
  return readJson<CharacterCard>(PATHS.characterCard(id));
}

export async function saveCharacter(id: string, card: CharacterCard): Promise<void> {
  await ensureDir(PATHS.characterDir(id));
  await writeJson(PATHS.characterCard(id), card);
}

export async function deleteCharacter(id: string): Promise<void> {
  await removePath(PATHS.characterDir(id));
}

export async function createCharacter(card: CharacterCard): Promise<string> {
  const id = crypto.randomUUID();
  await saveCharacter(id, card);
  return id;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "D:/Project/TextChatbot" && npm test`

Expected: All character storage tests pass.

- [ ] **Step 5: Commit**

Run:
```bash
cd "D:/Project/TextChatbot"
git add src/lib/storage/characters.ts tests/storage/characters.test.ts
git commit -m "feat: add character storage with CRUD operations and tests"
```

---

### Task 4: Chat + Settings Storage (TDD)

**Files:**
- Create: `src/lib/storage/chats.ts`
- Create: `src/lib/storage/settings.ts`
- Create: `tests/storage/chats.test.ts`

- [ ] **Step 1: Write failing tests for chat storage**

Write `tests/storage/chats.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/storage/database', () => ({
  readJson: vi.fn(),
  writeJson: vi.fn(),
  ensureDir: vi.fn(),
  listDirs: vi.fn(),
  removePath: vi.fn(),
  existsPath: vi.fn(),
}));

import { readJson, writeJson, ensureDir, listDirs, removePath, existsPath } from '$lib/storage/database';
import {
  listChats,
  loadMessages,
  saveMessages,
  deleteChat,
  loadScene,
  saveScene,
} from '$lib/storage/chats';
import type { Message, SceneState } from '$lib/types';

const mockMessages: Message[] = [
  { role: 'user', content: 'Hello', type: 'dialogue', timestamp: 1000 },
  { role: 'assistant', content: 'Hi there!', type: 'dialogue', timestamp: 2000, characterId: 'char-1' },
];

const mockScene: SceneState = {
  location: 'Forest',
  time: 'Night',
  mood: 'Mysterious',
  participatingCharacters: ['char-1'],
  variables: { health: 100 },
};

describe('chat storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listChats', () => {
    it('returns chat ids', async () => {
      vi.mocked(listDirs).mockResolvedValue(['chat-1', 'chat-2']);
      const result = await listChats();
      expect(result).toEqual(['chat-1', 'chat-2']);
    });

    it('returns empty array when no chats exist', async () => {
      vi.mocked(listDirs).mockResolvedValue([]);
      const result = await listChats();
      expect(result).toEqual([]);
    });
  });

  describe('loadMessages', () => {
    it('loads messages for a chat', async () => {
      vi.mocked(readJson).mockResolvedValue(mockMessages);
      const result = await loadMessages('chat-1');
      expect(readJson).toHaveBeenCalledWith('chats/chat-1/messages.json');
      expect(result).toEqual(mockMessages);
    });
  });

  describe('saveMessages', () => {
    it('creates directory and saves messages', async () => {
      vi.mocked(ensureDir).mockResolvedValue(undefined);
      vi.mocked(writeJson).mockResolvedValue(undefined);

      await saveMessages('chat-1', mockMessages);

      expect(ensureDir).toHaveBeenCalledWith('chats/chat-1');
      expect(writeJson).toHaveBeenCalledWith('chats/chat-1/messages.json', mockMessages);
    });
  });

  describe('deleteChat', () => {
    it('removes the chat directory', async () => {
      vi.mocked(removePath).mockResolvedValue(undefined);
      await deleteChat('chat-1');
      expect(removePath).toHaveBeenCalledWith('chats/chat-1');
    });
  });

  describe('loadScene', () => {
    it('loads scene when it exists', async () => {
      vi.mocked(existsPath).mockResolvedValue(true);
      vi.mocked(readJson).mockResolvedValue(mockScene);

      const result = await loadScene('chat-1');

      expect(result).toEqual(mockScene);
    });

    it('returns null when scene does not exist', async () => {
      vi.mocked(existsPath).mockResolvedValue(false);
      const result = await loadScene('chat-1');
      expect(result).toBeNull();
    });
  });

  describe('saveScene', () => {
    it('saves scene state', async () => {
      vi.mocked(ensureDir).mockResolvedValue(undefined);
      vi.mocked(writeJson).mockResolvedValue(undefined);

      await saveScene('chat-1', mockScene);

      expect(writeJson).toHaveBeenCalledWith('chats/chat-1/scene.json', mockScene);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "D:/Project/TextChatbot" && npm test`

Expected: FAIL — module `$lib/storage/chats` does not exist.

- [ ] **Step 3: Implement chat storage**

Write `src/lib/storage/chats.ts`:
```typescript
/**
 * Chat message and scene state CRUD operations.
 * Messages stored in chats/{id}/messages.json
 * Scene stored in chats/{id}/scene.json
 */

import type { Message, SceneState } from '$lib/types';
import { readJson, writeJson, ensureDir, listDirs, removePath, existsPath } from './database';
import { PATHS } from './paths';

export async function listChats(): Promise<string[]> {
  return listDirs(PATHS.chats);
}

export async function loadMessages(chatId: string): Promise<Message[]> {
  return readJson<Message[]>(PATHS.chatMessages(chatId));
}

export async function saveMessages(chatId: string, messages: Message[]): Promise<void> {
  await ensureDir(PATHS.chatDir(chatId));
  await writeJson(PATHS.chatMessages(chatId), messages);
}

export async function deleteChat(chatId: string): Promise<void> {
  await removePath(PATHS.chatDir(chatId));
}

export async function loadScene(chatId: string): Promise<SceneState | null> {
  if (!(await existsPath(PATHS.chatScene(chatId)))) {
    return null;
  }
  return readJson<SceneState>(PATHS.chatScene(chatId));
}

export async function saveScene(chatId: string, scene: SceneState): Promise<void> {
  await ensureDir(PATHS.chatDir(chatId));
  await writeJson(PATHS.chatScene(chatId), scene);
}
```

- [ ] **Step 4: Implement settings storage**

Write `src/lib/storage/settings.ts`:
```typescript
/**
 * Global settings read/write.
 * Settings stored in settings.json at the AppData root.
 */

import { readJson, writeJson, existsPath } from './database';
import { PATHS } from './paths';

export interface AppSettings {
  defaultProvider: string;
  theme: string;
  providers: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
}

const DEFAULT_SETTINGS: AppSettings = {
  defaultProvider: '',
  theme: 'default',
  providers: {},
};

export async function loadSettings(): Promise<AppSettings> {
  if (!(await existsPath(PATHS.settings))) {
    return { ...DEFAULT_SETTINGS };
  }
  return readJson<AppSettings>(PATHS.settings);
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await writeJson(PATHS.settings, settings);
}
```

- [ ] **Step 5: Run all tests**

Run: `cd "D:/Project/TextChatbot" && npm test`

Expected: All storage tests pass (database + characters + chats).

- [ ] **Step 6: Commit**

Run:
```bash
cd "D:/Project/TextChatbot"
git add src/lib/storage/chats.ts src/lib/storage/settings.ts tests/storage/chats.test.ts
git commit -m "feat: add chat and settings storage with tests"
```

---

### Task 5: Svelte Stores (TDD)

**Files:**
- Create: `src/lib/stores/chat.ts`
- Create: `src/lib/stores/characters.ts`
- Create: `src/lib/stores/scene.ts`
- Create: `src/lib/stores/settings.ts`
- Create: `src/lib/stores/theme.ts`
- Create: `tests/stores/characters-store.test.ts`

- [ ] **Step 1: Create chat store**

Write `src/lib/stores/chat.ts`:
```typescript
/**
 * Chat store — reactive state for current chat session.
 */

import { writable, get } from 'svelte/store';
import type { Message } from '$lib/types';
import * as chatStorage from '$lib/storage/chats';

interface ChatState {
  chatId: string | null;
  messages: Message[];
  isLoading: boolean;
}

function createChatStore() {
  const { subscribe, set, update } = writable<ChatState>({
    chatId: null,
    messages: [],
    isLoading: false,
  });

  return {
    subscribe,

    async loadChat(chatId: string) {
      update((s) => ({ ...s, isLoading: true }));
      try {
        const messages = await chatStorage.loadMessages(chatId);
        set({ chatId, messages, isLoading: false });
      } catch {
        set({ chatId: null, messages: [], isLoading: false });
      }
    },

    addMessage(message: Message) {
      update((s) => ({ ...s, messages: [...s.messages, message] }));
    },

    async save() {
      const state = get({ subscribe });
      if (state.chatId) {
        await chatStorage.saveMessages(state.chatId, state.messages);
      }
    },

    clear() {
      set({ chatId: null, messages: [], isLoading: false });
    },
  };
}

export const chatStore = createChatStore();
```

- [ ] **Step 2: Create characters store**

Write `src/lib/stores/characters.ts`:
```typescript
/**
 * Characters store — reactive state for character list and selection.
 */

import { writable, get } from 'svelte/store';
import type { CharacterCard } from '$lib/types';
import * as characterStorage from '$lib/storage/characters';

interface CharactersState {
  list: { id: string; name: string }[];
  currentId: string | null;
  current: CharacterCard | null;
  isLoading: boolean;
}

function createCharactersStore() {
  const { subscribe, set, update } = writable<CharactersState>({
    list: [],
    currentId: null,
    current: null,
    isLoading: false,
  });

  return {
    subscribe,

    async loadList() {
      update((s) => ({ ...s, isLoading: true }));
      try {
        const list = await characterStorage.listCharacters();
        update((s) => ({ ...s, list, isLoading: false }));
      } catch {
        update((s) => ({ ...s, isLoading: false }));
      }
    },

    async selectCharacter(id: string) {
      update((s) => ({ ...s, isLoading: true }));
      try {
        const card = await characterStorage.loadCharacter(id);
        update((s) => ({ ...s, currentId: id, current: card, isLoading: false }));
      } catch {
        update((s) => ({ ...s, isLoading: false }));
      }
    },

    async saveCurrent() {
      const state = get({ subscribe });
      if (state.currentId && state.current) {
        await characterStorage.saveCharacter(state.currentId, state.current);
      }
    },

    async deleteCharacter(id: string) {
      await characterStorage.deleteCharacter(id);
      update((s) => ({
        ...s,
        list: s.list.filter((c) => c.id !== id),
        currentId: s.currentId === id ? null : s.currentId,
        current: s.currentId === id ? null : s.current,
      }));
    },

    clearSelection() {
      update((s) => ({ ...s, currentId: null, current: null }));
    },
  };
}

export const charactersStore = createCharactersStore();
```

- [ ] **Step 3: Create scene store**

Write `src/lib/stores/scene.ts`:
```typescript
/**
 * Scene store — reactive state for simulation scene.
 */

import { writable, get } from 'svelte/store';
import type { SceneState, VariableValue } from '$lib/types';
import * as chatStorage from '$lib/storage/chats';

const DEFAULT_SCENE: SceneState = {
  location: '',
  time: '',
  mood: '',
  participatingCharacters: [],
  variables: {},
};

function createSceneStore() {
  const { subscribe, set, update } = writable<SceneState>({ ...DEFAULT_SCENE });

  let currentChatId: string | null = null;

  return {
    subscribe,

    async loadScene(chatId: string) {
      currentChatId = chatId;
      const scene = await chatStorage.loadScene(chatId);
      set(scene ?? { ...DEFAULT_SCENE });
    },

    updateScene(partial: Partial<SceneState>) {
      update((s) => ({ ...s, ...partial }));
    },

    setVariable(key: string, value: VariableValue) {
      update((s) => ({ ...s, variables: { ...s.variables, [key]: value } }));
    },

    async save() {
      if (currentChatId) {
        const state = get({ subscribe });
        await chatStorage.saveScene(currentChatId, state);
      }
    },

    reset() {
      currentChatId = null;
      set({ ...DEFAULT_SCENE });
    },
  };
}

export const sceneStore = createSceneStore();
```

- [ ] **Step 4: Create settings store**

Write `src/lib/stores/settings.ts`:
```typescript
/**
 * Settings store — reactive state for app settings.
 */

import { writable, get } from 'svelte/store';
import type { AppSettings } from '$lib/storage/settings';
import * as settingsStorage from '$lib/storage/settings';

function createSettingsStore() {
  const { subscribe, set, update } = writable<AppSettings>({
    defaultProvider: '',
    theme: 'default',
    providers: {},
  });

  return {
    subscribe,

    async load() {
      const settings = await settingsStorage.loadSettings();
      set(settings);
    },

    update(partial: Partial<AppSettings>) {
      update((s) => ({ ...s, ...partial }));
    },

    async save() {
      const state = get({ subscribe });
      await settingsStorage.saveSettings(state);
    },
  };
}

export const settingsStore = createSettingsStore();
```

- [ ] **Step 5: Create theme store**

Write `src/lib/stores/theme.ts`:
```typescript
/**
 * Theme store — tracks current theme name.
 */

import { derived } from 'svelte/store';
import { settingsStore } from './settings';

export const currentTheme = derived(settingsStore, ($settings) => $settings.theme);
```

- [ ] **Step 6: Write tests for characters store**

Write `tests/stores/characters-store.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

vi.mock('$lib/storage/characters', () => ({
  listCharacters: vi.fn(),
  loadCharacter: vi.fn(),
  saveCharacter: vi.fn(),
  deleteCharacter: vi.fn(),
  createCharacter: vi.fn(),
}));

import { listCharacters, loadCharacter, deleteCharacter } from '$lib/storage/characters';
import { charactersStore } from '$lib/stores/characters';
import type { CharacterCard } from '$lib/types';

const mockCard: CharacterCard = {
  name: 'Test',
  description: '',
  personality: '',
  scenario: '',
  firstMessage: '',
  alternateGreetings: [],
  exampleMessages: '',
  systemPrompt: '',
  postHistoryInstructions: '',
  creator: '',
  characterVersion: '1.0',
  tags: [],
  creatorNotes: '',
  lorebook: [],
  loreSettings: { tokenBudget: 2048, scanDepth: 5, recursiveScanning: false, fullWordMatching: false },
  regexScripts: [],
  triggers: [],
  scriptState: {},
  emotionImages: [],
  additionalAssets: [],
  metadata: {},
};

describe('charactersStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads character list', async () => {
    vi.mocked(listCharacters).mockResolvedValue([
      { id: 'a', name: 'Alice' },
      { id: 'b', name: 'Bob' },
    ]);

    await charactersStore.loadList();

    const state = get(charactersStore);
    expect(state.list).toEqual([
      { id: 'a', name: 'Alice' },
      { id: 'b', name: 'Bob' },
    ]);
    expect(state.isLoading).toBe(false);
  });

  it('selects a character', async () => {
    vi.mocked(loadCharacter).mockResolvedValue(mockCard);

    await charactersStore.selectCharacter('char-1');

    const state = get(charactersStore);
    expect(state.currentId).toBe('char-1');
    expect(state.current).toEqual(mockCard);
  });

  it('deletes a character and removes from list', async () => {
    vi.mocked(listCharacters).mockResolvedValue([
      { id: 'a', name: 'Alice' },
      { id: 'b', name: 'Bob' },
    ]);
    vi.mocked(deleteCharacter).mockResolvedValue(undefined);

    await charactersStore.loadList();
    await charactersStore.deleteCharacter('a');

    const state = get(charactersStore);
    expect(state.list).toEqual([{ id: 'b', name: 'Bob' }]);
  });

  it('clears selection', async () => {
    vi.mocked(loadCharacter).mockResolvedValue(mockCard);
    await charactersStore.selectCharacter('char-1');

    charactersStore.clearSelection();

    const state = get(charactersStore);
    expect(state.currentId).toBeNull();
    expect(state.current).toBeNull();
  });
});
```

- [ ] **Step 7: Run all tests**

Run: `cd "D:/Project/TextChatbot" && npm test`

Expected: All tests pass (database + characters storage + chats storage + characters store).

- [ ] **Step 8: Run type check**

Run: `cd "D:/Project/TextChatbot" && npm run check`

Expected: 0 errors.

- [ ] **Step 9: Commit**

Run:
```bash
cd "D:/Project/TextChatbot"
git add src/lib/stores/ tests/stores/
git commit -m "feat: add Svelte stores for chat, characters, scene, settings, theme"
```

---

### Task 6: Final Verification

- [ ] **Step 1: Run type check**

Run: `cd "D:/Project/TextChatbot" && npm run check`

Expected: 0 errors, 0 warnings.

- [ ] **Step 2: Run all tests**

Run: `cd "D:/Project/TextChatbot" && npm test`

Expected: All tests pass.

- [ ] **Step 3: Run SvelteKit build**

Run: `cd "D:/Project/TextChatbot" && npm run build`

Expected: Build succeeds.

- [ ] **Step 4: Verify Tauri builds with new plugin**

Run: `cd "D:/Project/TextChatbot/src-tauri" && cargo check`

Expected: Rust compilation succeeds with `tauri-plugin-fs` registered.

---

## Self-Review Checklist

**1. Spec coverage:**

| Spec Section | Covered in Task | Notes |
|---|---|---|
| Section 6.1 — File storage structure | Task 2 (paths.ts) | characters/, chats/, settings.json, themes/ |
| Section 6.1 — characters/{uuid}/card.json | Task 3 | Full CRUD |
| Section 6.1 — chats with messages + scene | Task 4 | Messages + SceneState |
| Section 6.1 — config.json | Task 4 | settings.json |
| Section 6.2 — chat.ts store | Task 5 | Current chat, messages, save/load |
| Section 6.2 — characters.ts store | Task 5 | List, select, save, delete |
| Section 6.2 — scene.ts store | Task 5 | SceneState with variables |
| Section 6.2 — settings.ts store | Task 5 | App settings persistence |
| Section 6.2 — theme.ts store | Task 5 | Derived from settings |

**2. Placeholder scan:** No TBD, TODO, or incomplete steps found. All steps contain exact code and commands.

**3. Type consistency:**
- `CharacterCard` type matches Plan 1's `character.ts` definition
- `Message` type matches Plan 1's `message.ts` definition
- `SceneState` type matches Plan 1's `scene.ts` definition
- `VariableValue` type matches Plan 1's `script.ts` definition
- Storage functions use consistent path patterns from `paths.ts`
- Database mock uses `baseDir: 1` matching `BaseDirectory.AppData`
