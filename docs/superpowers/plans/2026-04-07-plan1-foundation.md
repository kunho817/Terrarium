# Terrarium Foundation — Implementation Plan 1

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up SvelteKit + Tauri v2 project scaffold, define all shared TypeScript types from the design spec, and implement the plugin registry — the foundation layer that all subsequent plans build on.

**Architecture:** SvelteKit 5 frontend compiled to static HTML/JS via adapter-static, served by Tauri v2 desktop shell. All shared types defined upfront as TypeScript interfaces in `src/lib/types/`. Plugin system uses a registry pattern where plugins register by type and can be looked up by ID or file extension.

**Tech Stack:** SvelteKit 2 + Svelte 5, Tauri v2 (Rust), TypeScript 5, Vitest

---

## Prerequisites

- **Node.js** >= 20 (check with `node -v`)
- **Rust** >= 1.77 (check with `rustc --version`)
- **Cargo** (installed with Rust)
- OS: Windows 11 (this plan uses bash shell commands)

---

## Plan Decomposition — Full Roadmap

This design spec covers multiple independent subsystems. Each plan produces working, testable software on its own:

| # | Plan | What It Builds |
|---|------|----------------|
| **1** | **(this plan)** | Project scaffold, all shared types, PluginRegistry |
| 2 | Storage Layer + Stores | SQLite via Tauri, Svelte stores (chat, characters, scene, settings, theme) |
| 3 | AI Provider Plugins | NanoGPT, OpenAI, Claude, Ollama providers |
| 4 | Card Formats + Prompt Builder | RisuAI, SillyTavern, Generic JSON card import/export; prompt assembly |
| 5 | Chat Engine + Pipeline | Message processing, streaming, regex scripts, full chat pipeline |
| 6 | Lorebook + Variable Store | Keyword/regex matching, token budget, game state tracking |
| 7 | Scripting Engine + Triggers | Lua sandboxed runtime (mlua), Script API, trigger system |
| 8 | UI — Full Frontend | Layout, routing, chat view, theme system, settings, character management |

Plans are sequential — each depends on the previous one's types and infrastructure.

---

## File Structure (created by this plan)

```
TextChatbot/
├── src-tauri/                        # Tauri v2 backend (Rust)
│   ├── src/
│   │   ├── main.rs                   # Rust entry point
│   │   └── lib.rs                    # Tauri app setup
│   ├── Cargo.toml                    # Rust dependencies
│   ├── build.rs                      # Tauri build script
│   ├── tauri.conf.json               # Tauri config (window, build paths)
│   ├── capabilities/
│   │   └── default.json              # Default Tauri permissions
│   └── icons/                        # App icons (generated)
├── src/
│   ├── lib/
│   │   ├── types/
│   │   │   ├── index.ts              # Barrel export for all types
│   │   │   ├── message.ts            # Message, MessageRole, MessageType, GenerationInfo
│   │   │   ├── config.ts             # ConfigField, UserConfig, ModelInfo
│   │   │   ├── script.ts             # RegexScript, VariableStore
│   │   │   ├── trigger.ts            # Trigger, TriggerEvent, TriggerMatchOn
│   │   │   ├── lorebook.ts           # LorebookEntry, LorebookSettings, Lorebook
│   │   │   ├── scene.ts              # SceneState
│   │   │   ├── character.ts          # CharacterCard, DepthPrompt
│   │   │   └── plugin.ts             # All plugin interfaces, ChatContext
│   │   └── plugins/
│   │       └── registry.ts           # PluginRegistry class
│   ├── routes/
│   │   ├── +layout.svelte            # Root layout (SPA shell)
│   │   └── +page.svelte              # Home page (placeholder)
│   ├── app.html                      # HTML shell
│   └── app.d.ts                      # App type declarations
├── tests/
│   ├── setup.test.ts                 # Infrastructure smoke test
│   └── plugins/
│       └── registry.test.ts          # PluginRegistry unit tests
├── static/                           # Static assets (empty)
├── .gitignore
├── package.json
├── svelte.config.js
├── vite.config.ts
├── tsconfig.json
├── docs/                             # (existing)
├── .claude/                          # (existing)
└── .superpowers/                     # (existing)
```

---

### Task 1: Create SvelteKit Project

**Files:**
- Create: `package.json`
- Create: `svelte.config.js`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `src/app.html`
- Create: `src/app.d.ts`
- Create: `src/routes/+layout.svelte`
- Create: `src/routes/+page.svelte`
- Create: `static/.gitkeep`
- Create: `.gitignore`

- [ ] **Step 1: Create directory structure**

Run:
```bash
cd "D:/Project/TextChatbot"
mkdir -p src/lib/types
mkdir -p src/lib/plugins
mkdir -p src/routes
mkdir -p static
mkdir -p tests/plugins
```

Expected: All directories created. No errors.

- [ ] **Step 2: Create package.json**

Write `package.json`:
```json
{
  "name": "terrarium",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json"
  },
  "devDependencies": {
    "@sveltejs/adapter-static": "^3.0.8",
    "@sveltejs/kit": "^2.16.0",
    "@sveltejs/vite-plugin-svelte": "^5.0.3",
    "@tauri-apps/cli": "^2.2.0",
    "svelte": "^5.20.0",
    "svelte-check": "^4.1.0",
    "typescript": "^5.7.0",
    "vite": "^6.1.0",
    "vitest": "^3.0.0"
  },
  "dependencies": {
    "@tauri-apps/api": "^2.2.0"
  }
}
```

- [ ] **Step 3: Install dependencies**

Run: `cd "D:/Project/TextChatbot" && npm install`

Expected: `npm` resolves and installs all packages. `node_modules/` created, `package-lock.json` generated. No peer dependency errors.

- [ ] **Step 4: Create svelte.config.js**

Write `svelte.config.js`:
```javascript
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: 'index.html',
      precompress: false,
      strict: true,
    }),
  },
};

export default config;
```

Note: `adapter-static` with `fallback: 'index.html'` makes SvelteKit produce an SPA. This is required for Tauri, which loads a single HTML file.

- [ ] **Step 5: Create vite.config.ts**

Write `vite.config.ts`:
```typescript
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
```

The `sveltekit()` plugin handles the `$lib` → `src/lib` alias. Vitest inherits this config.

- [ ] **Step 6: Create tsconfig.json**

Write `tsconfig.json`:
```json
{
  "extends": "./.svelte-kit/tsconfig.json",
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "sourceMap": true,
    "strict": true,
    "moduleResolution": "bundler"
  }
}
```

- [ ] **Step 7: Create src/app.html**

Write `src/app.html`:
```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Terrarium</title>
    %sveltekit.head%
  </head>
  <body data-sveltekit-preload-data="hover">
    <div style="display: contents">%sveltekit.body%</div>
  </body>
</html>
```

- [ ] **Step 8: Create src/app.d.ts**

Write `src/app.d.ts`:
```typescript
// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
```

- [ ] **Step 9: Create route files**

Write `src/routes/+layout.svelte`:
```svelte
<script lang="ts">
  let { children } = $props();
</script>

{@render children()}
```

Write `src/routes/+page.svelte`:
```svelte
<h1>Terrarium</h1>
<p>Foundation loaded.</p>
```

- [ ] **Step 10: Create .gitignore and static/.gitkeep**

Write `.gitignore`:
```
node_modules/
.svelte-kit/
build/
src-tauri/target/
src-tauri/Cargo.lock
*.local
.DS_Store
Thumbs.db
```

Write `static/.gitkeep` (empty file):
```

```

- [ ] **Step 11: Verify SvelteKit builds**

Run: `cd "D:/Project/TextChatbot" && npm run build`

Expected: Build succeeds. Output in `build/` directory containing `index.html` and bundled JS. No errors.

If this fails with "Cannot find module" errors, run `npx svelte-kit sync` first, then retry.

- [ ] **Step 12: Initialize git and commit**

Run:
```bash
cd "D:/Project/TextChatbot"
git init
git add package.json package-lock.json svelte.config.js vite.config.ts tsconfig.json src/ static/.gitkeep .gitignore
git commit -m "feat: initialize SvelteKit project with adapter-static"
git remote add origin https://github.com/kunho817/Terrarium.git
```

Expected: Git repo initialized. First commit created. Remote `origin` set to `https://github.com/kunho817/Terrarium.git`.

---

### Task 2: Add Tauri v2 Backend

**Files:**
- Create: `src-tauri/` (entire directory, via `tauri init`)
- Modify: `src-tauri/tauri.conf.json` (adjust window size and paths)

- [ ] **Step 1: Run Tauri init**

Run:
```bash
cd "D:/Project/TextChatbot"
npx tauri init --app-name "Terrarium" --window-title "Terrarium" --frontend-dist "../build" --dev-url "http://localhost:5173"
```

When prompted:
- **beforeDevCommand:** `npm run dev`
- **beforeBuildCommand:** `npm run build`

If `tauri init` does not support these flags non-interactively, run `npx tauri init` and enter the values at prompts:
- App name: `Terrarium`
- Window title: `Terrarium`
- Frontend dist: `../build`
- Dev URL: `http://localhost:5173`
- Before dev command: `npm run dev`
- Before build command: `npm run build`

Expected: `src-tauri/` directory created with `Cargo.toml`, `build.rs`, `tauri.conf.json`, `src/main.rs`, `src/lib.rs`, `icons/`, `capabilities/`.

- [ ] **Step 2: Adjust tauri.conf.json**

Overwrite `src-tauri/tauri.conf.json` with:

```json
{
  "productName": "Terrarium",
  "version": "0.1.0",
  "identifier": "com.terrarium.app",
  "build": {
    "frontendDist": "../build",
    "devUrl": "http://localhost:5173",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build"
  },
  "app": {
    "title": "Terrarium",
    "windows": [
      {
        "title": "Terrarium",
        "width": 1200,
        "height": 800,
        "resizable": true,
        "fullscreen": false
      }
    ],
    "security": {
      "csp": null
    }
  }
}
```

Changes from defaults:
- Window size: 1200x800 (spec Section 5.1 — desktop app, needs space for sidebar + chat)
- CSP set to null (will be tightened in later plans when theme sandboxing is implemented)

- [ ] **Step 3: Verify Rust compilation**

Run: `cd "D:/Project/TextChatbot/src-tauri" && cargo check`

Expected: Rust compilation succeeds. Dependencies downloaded from crates.io. No errors. First run downloads and compiles Tauri dependencies (may take 2-5 minutes).

- [ ] **Step 4: Commit**

Run:
```bash
cd "D:/Project/TextChatbot"
git add src-tauri/
git commit -m "feat: add Tauri v2 backend scaffold"
```

---

### Task 3: Set Up Vitest

**Files:**
- Create: `tests/setup.test.ts`

- [ ] **Step 1: Create infrastructure smoke test**

Write `tests/setup.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';

describe('Test infrastructure', () => {
  it('Vitest is working', () => {
    expect(1 + 1).toBe(2);
  });

  it('TypeScript types compile', () => {
    const greeting: string = 'hello';
    expect(greeting).toBeTypeOf('string');
  });
});
```

- [ ] **Step 2: Run tests**

Run: `cd "D:/Project/TextChatbot" && npm test`

Expected output:
```
 ✓ tests/setup.test.ts (2 tests) Xms
 Tests  2 passed (2)
```

If `$lib` alias errors appear in later tasks, add this to `vite.config.ts`:
```typescript
import { resolve } from 'path';
// Inside defineConfig:
resolve: {
  alias: {
    '$lib': resolve('./src/lib'),
  },
},
```

- [ ] **Step 3: Commit**

Run:
```bash
cd "D:/Project/TextChatbot"
git add tests/setup.test.ts
git commit -m "test: add Vitest infrastructure smoke test"
```

---

### Task 4: Define Core Types — message, config, script, trigger

**Files:**
- Create: `src/lib/types/message.ts`
- Create: `src/lib/types/config.ts`
- Create: `src/lib/types/script.ts`
- Create: `src/lib/types/trigger.ts`

These types come from spec Section 8 (Shared Types) and Section 7 (Lorebook & Scripting Engine).

- [ ] **Step 1: Create src/lib/types/message.ts**

Write `src/lib/types/message.ts`:
```typescript
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
```

- [ ] **Step 2: Create src/lib/types/config.ts**

Write `src/lib/types/config.ts`:
```typescript
/**
 * Configuration types for AI providers and app settings.
 * Spec reference: Section 3 — Plugin System
 */

export type ConfigFieldType = 'text' | 'password' | 'number' | 'select' | 'boolean';

export interface ConfigField {
  key: string;
  label: string;
  type: ConfigFieldType;
  defaultValue?: string | number | boolean;
  placeholder?: string;
  required?: boolean;
  options?: { label: string; value: string }[];
}

export interface UserConfig {
  providerId: string;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
  [key: string]: unknown;
}

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  contextLength?: number;
}
```

- [ ] **Step 3: Create src/lib/types/script.ts**

Write `src/lib/types/script.ts`:
```typescript
/**
 * Regex script and variable store types.
 * Spec reference: Section 7.3 — Variable Store, Section 7.4 — Regex Script System
 */

export type RegexStage = 'modify_input' | 'modify_output' | 'modify_request' | 'modify_display';

export interface RegexScript {
  id: string;
  name: string;
  pattern: string;
  replacement: string;
  stage: RegexStage;
  enabled: boolean;
  flag?: string;
}

export type VariableValue = string | number | boolean;

export type VariableStore = Record<string, VariableValue>;
```

- [ ] **Step 4: Create src/lib/types/trigger.ts**

Write `src/lib/types/trigger.ts`:
```typescript
/**
 * Trigger types — event-script bindings.
 * Spec reference: Section 7.2.1 — Trigger (Event-Script Binding)
 */

export type TriggerEvent =
  | 'on_message'
  | 'on_user_message'
  | 'on_ai_message'
  | 'on_chat_start'
  | 'on_chat_end'
  | 'on_character_enter'
  | 'on_character_leave'
  | 'on_scene_change'
  | 'on_variable_change'
  | 'on_timer'
  | 'on_regex_match'
  | 'on_manual';

export type TriggerMatchOn = 'user_input' | 'ai_output' | 'both';

export interface Trigger {
  id: string;
  name: string;
  enabled: boolean;

  event: TriggerEvent;

  pattern?: string;
  matchOn?: TriggerMatchOn;

  script: string;

  blockScriptId?: string;
}
```

- [ ] **Step 5: Run type checking**

Run: `cd "D:/Project/TextChatbot" && npm run check`

Expected: `svelte-check` completes with no type errors. The type files have no runtime code, so they're verified by TypeScript compilation only.

- [ ] **Step 6: Commit**

Run:
```bash
cd "D:/Project/TextChatbot"
git add src/lib/types/message.ts src/lib/types/config.ts src/lib/types/script.ts src/lib/types/trigger.ts
git commit -m "feat: add core types — message, config, script, trigger"
```

---

### Task 5: Define Domain Types — lorebook, scene, character, plugin

**Files:**
- Create: `src/lib/types/lorebook.ts`
- Create: `src/lib/types/scene.ts`
- Create: `src/lib/types/character.ts`
- Create: `src/lib/types/plugin.ts`
- Create: `src/lib/types/index.ts`

- [ ] **Step 1: Create src/lib/types/lorebook.ts**

Write `src/lib/types/lorebook.ts`:
```typescript
/**
 * Lorebook types — keyword/regex-triggered knowledge injection.
 * Spec reference: Section 7.1 — Lorebook (World Knowledge Base)
 */

export type LorebookPosition =
  | 'before_char'
  | 'after_char'
  | 'before_scenario'
  | 'after_messages'
  | 'author_note';

export type LorebookMode = 'normal' | 'constant' | 'selective' | 'folder';

export type LorebookScope = 'global' | 'character' | 'scenario';

export interface LorebookEntry {
  id: string;
  name: string;

  keywords: string[];
  secondaryKeywords?: string[];
  regex?: string;
  caseSensitive: boolean;

  content: string;

  position: LorebookPosition;
  priority: number;
  tokenLimit?: number;

  enabled: boolean;
  scanDepth: number;
  scope: LorebookScope;
  characterIds?: string[];
  activationPercent?: number;

  mode: LorebookMode;
  constant: boolean;

  parentId?: string;
  folderName?: string;

  useEmbedding?: boolean;
  embeddingThreshold?: number;

  loreCache?: { key: string; data: string[] };
}

export interface LorebookSettings {
  tokenBudget: number;
  scanDepth: number;
  recursiveScanning: boolean;
  fullWordMatching: boolean;
}

export interface Lorebook {
  entries: LorebookEntry[];
  settings: LorebookSettings;
}
```

- [ ] **Step 2: Create src/lib/types/scene.ts**

Write `src/lib/types/scene.ts`:
```typescript
/**
 * Scene state types for simulation mode.
 * Spec reference: Section 8 — Shared Types > SceneState
 */

import type { VariableStore } from './script';

export interface SceneState {
  location: string;
  time: string;
  mood: string;
  participatingCharacters: string[];
  variables: VariableStore;
}
```

- [ ] **Step 3: Create src/lib/types/character.ts**

Write `src/lib/types/character.ts`:
```typescript
/**
 * Character card types — the core data model for AI characters.
 * Spec reference: Section 8 — Shared Types > CharacterCard
 */

import type { LorebookEntry, LorebookSettings } from './lorebook';
import type { Trigger } from './trigger';
import type { RegexScript, VariableStore } from './script';

export interface DepthPrompt {
  depth: number;
  prompt: string;
}

export interface CharacterCard {
  // Basic info
  name: string;
  description: string;
  personality: string;
  scenario: string;
  firstMessage: string;
  alternateGreetings: string[];
  exampleMessages: string;
  avatar?: ArrayBuffer;

  // Prompt fields (user-editable)
  systemPrompt: string;
  postHistoryInstructions: string;
  depthPrompt?: DepthPrompt;

  // Creator metadata
  creator: string;
  characterVersion: string;
  tags: string[];
  creatorNotes: string;
  license?: string;

  // Lorebook
  lorebook: LorebookEntry[];
  loreSettings: LorebookSettings;

  // Custom scripts
  regexScripts: RegexScript[];
  triggers: Trigger[];

  // UI customization
  backgroundHTML?: string;
  backgroundCSS?: string;
  customTheme?: string;

  // Virtual script (sandboxed scripting)
  virtualScript?: string;

  // Variable state
  scriptState: VariableStore;

  // Additional assets
  emotionImages: [string, string][];
  additionalAssets: [string, string, string][];

  // Format extension data (preserved during import/export for lossless roundtrip)
  metadata: Record<string, unknown>;
}
```

- [ ] **Step 4: Create src/lib/types/plugin.ts**

Write `src/lib/types/plugin.ts`:
```typescript
/**
 * Plugin interfaces and ChatContext.
 * Spec reference: Section 3 — Plugin System, Section 8 — ChatContext
 */

import type { Message } from './message';
import type { CharacterCard } from './character';
import type { SceneState } from './scene';
import type { LorebookEntry } from './lorebook';
import type { UserConfig, ConfigField, ModelInfo } from './config';

// === Provider Plugin (AI Backend) ===
// Spec reference: Section 3.1

export interface ProviderPlugin {
  id: string;
  name: string;
  icon?: string;
  requiredConfig: ConfigField[];

  chat(messages: Message[], config: UserConfig): AsyncGenerator<string>;
  chatWithCard(
    messages: Message[],
    card: CharacterCard,
    config: UserConfig
  ): AsyncGenerator<string>;
  listModels?(config: UserConfig): Promise<ModelInfo[]>;
  validateConfig(config: UserConfig): Promise<boolean>;
}

// === Card Format Plugin ===
// Spec reference: Section 3.2

export interface CardFormatPlugin {
  id: string;
  name: string;
  supportedExtensions: string[];

  parse(data: ArrayBuffer): CharacterCard;
  export(card: CharacterCard): ArrayBuffer;
  validate(data: ArrayBuffer): boolean;
}

// === Chat Context ===
// Spec reference: Section 8 — ChatContext

export interface ChatContext {
  messages: Message[];
  card: CharacterCard;
  scene: SceneState;
  config: UserConfig;
  additionalPrompt?: string;
  lorebookMatches: LorebookEntry[];
}

// === Agent Plugin (v2 expansion) ===
// Spec reference: Section 3.3

export interface AgentPlugin {
  id: string;
  name: string;

  onBeforeSend(ctx: ChatContext): Promise<ChatContext>;
  onAfterReceive(ctx: ChatContext, response: string): Promise<string>;
  runBackground(ctx: ChatContext): Promise<void>;
}

// === Image Provider Plugin (v2 expansion) ===
// Spec reference: Section 3.4

export interface ImageProviderPlugin {
  id: string;
  name: string;
  generateImage(prompt: string, config: UserConfig): Promise<ArrayBuffer>;
  requiredConfig: ConfigField[];
}

// === Prompt Builder Plugin (v1 built-in) ===
// Spec reference: Section 3.5

export interface PromptBuilderPlugin {
  id: string;
  name: string;

  buildSystemPrompt(card: CharacterCard, scene: SceneState): string;
  buildContext(messages: Message[], scene: SceneState): string;
}
```

- [ ] **Step 5: Create barrel export src/lib/types/index.ts**

Write `src/lib/types/index.ts`:
```typescript
/**
 * Barrel export for all shared types.
 * Usage: import type { Message, CharacterCard } from '$lib/types';
 */

// Message
export type {
  MessageRole,
  MessageType,
  GenerationInfo,
  Message,
} from './message';

// Config
export type {
  ConfigFieldType,
  ConfigField,
  UserConfig,
  ModelInfo,
} from './config';

// Script
export type {
  RegexStage,
  RegexScript,
  VariableValue,
  VariableStore,
} from './script';

// Trigger
export type {
  TriggerEvent,
  TriggerMatchOn,
  Trigger,
} from './trigger';

// Lorebook
export type {
  LorebookPosition,
  LorebookMode,
  LorebookScope,
  LorebookEntry,
  LorebookSettings,
  Lorebook,
} from './lorebook';

// Scene
export type { SceneState } from './scene';

// Character
export type { DepthPrompt, CharacterCard } from './character';

// Plugin & ChatContext
export type {
  ProviderPlugin,
  CardFormatPlugin,
  ChatContext,
  AgentPlugin,
  ImageProviderPlugin,
  PromptBuilderPlugin,
} from './plugin';
```

- [ ] **Step 6: Run type checking**

Run: `cd "D:/Project/TextChatbot" && npm run check`

Expected: No type errors. All cross-file imports resolve correctly (character.ts imports from lorebook.ts, trigger.ts, script.ts; plugin.ts imports from message.ts, character.ts, scene.ts, lorebook.ts, config.ts).

- [ ] **Step 7: Commit**

Run:
```bash
cd "D:/Project/TextChatbot"
git add src/lib/types/lorebook.ts src/lib/types/scene.ts src/lib/types/character.ts src/lib/types/plugin.ts src/lib/types/index.ts
git commit -m "feat: add domain types — lorebook, scene, character, plugin interfaces"
```

---

### Task 6: Implement PluginRegistry (TDD)

**Files:**
- Create: `tests/plugins/registry.test.ts`
- Create: `src/lib/plugins/registry.ts`

- [ ] **Step 1: Write the failing tests**

Write `tests/plugins/registry.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { PluginRegistry } from '$lib/plugins/registry';
import type {
  ProviderPlugin,
  CardFormatPlugin,
  AgentPlugin,
  ImageProviderPlugin,
  PromptBuilderPlugin,
  ChatContext,
} from '$lib/types/plugin';
import type { CharacterCard } from '$lib/types/character';

function createMockProvider(overrides?: Partial<ProviderPlugin>): ProviderPlugin {
  return {
    id: 'test-provider',
    name: 'Test Provider',
    requiredConfig: [],
    async *chat() {
      yield 'test';
    },
    async *chatWithCard() {
      yield 'test';
    },
    async validateConfig() {
      return true;
    },
    ...overrides,
  };
}

function createMockCardFormat(overrides?: Partial<CardFormatPlugin>): CardFormatPlugin {
  return {
    id: 'test-format',
    name: 'Test Format',
    supportedExtensions: ['.json'],
    parse() {
      return {} as CharacterCard;
    },
    export() {
      return new ArrayBuffer(0);
    },
    validate() {
      return true;
    },
    ...overrides,
  };
}

function createMockAgent(overrides?: Partial<AgentPlugin>): AgentPlugin {
  return {
    id: 'test-agent',
    name: 'Test Agent',
    async onBeforeSend(ctx: ChatContext) {
      return ctx;
    },
    async onAfterReceive(_ctx: ChatContext, response: string) {
      return response;
    },
    async runBackground() {},
    ...overrides,
  };
}

function createMockImageProvider(overrides?: Partial<ImageProviderPlugin>): ImageProviderPlugin {
  return {
    id: 'test-image-provider',
    name: 'Test Image Provider',
    requiredConfig: [],
    async generateImage() {
      return new ArrayBuffer(0);
    },
    ...overrides,
  };
}

describe('PluginRegistry', () => {
  // === ProviderPlugin ===
  describe('providers', () => {
    it('registers and retrieves a provider by id', () => {
      const registry = new PluginRegistry();
      const provider = createMockProvider();
      registry.registerProvider(provider);
      expect(registry.getProvider('test-provider')).toBe(provider);
    });

    it('throws when registering a duplicate provider', () => {
      const registry = new PluginRegistry();
      registry.registerProvider(createMockProvider());
      expect(() => registry.registerProvider(createMockProvider())).toThrow(
        'already registered'
      );
    });

    it('throws when retrieving a non-existent provider', () => {
      const registry = new PluginRegistry();
      expect(() => registry.getProvider('nonexistent')).toThrow('not found');
    });

    it('lists all registered providers', () => {
      const registry = new PluginRegistry();
      const p1 = createMockProvider({ id: 'p1', name: 'P1' });
      const p2 = createMockProvider({ id: 'p2', name: 'P2' });
      registry.registerProvider(p1);
      registry.registerProvider(p2);
      const list = registry.listProviders();
      expect(list).toHaveLength(2);
      expect(list).toContain(p1);
      expect(list).toContain(p2);
    });
  });

  // === CardFormatPlugin ===
  describe('card formats', () => {
    it('registers and retrieves by id', () => {
      const registry = new PluginRegistry();
      const format = createMockCardFormat();
      registry.registerCardFormat(format);
      expect(registry.getCardFormat('test-format')).toBe(format);
    });

    it('retrieves by file extension', () => {
      const registry = new PluginRegistry();
      const format = createMockCardFormat({
        supportedExtensions: ['.json', '.png'],
      });
      registry.registerCardFormat(format);
      expect(registry.getCardFormat('.json')).toBe(format);
      expect(registry.getCardFormat('.png')).toBe(format);
    });

    it('throws when registering a duplicate card format', () => {
      const registry = new PluginRegistry();
      registry.registerCardFormat(createMockCardFormat());
      expect(() => registry.registerCardFormat(createMockCardFormat())).toThrow(
        'already registered'
      );
    });

    it('throws when retrieving a non-existent card format', () => {
      const registry = new PluginRegistry();
      expect(() => registry.getCardFormat('.xml')).toThrow('not found');
    });

    it('lists all registered card formats', () => {
      const registry = new PluginRegistry();
      const f1 = createMockCardFormat({ id: 'f1', name: 'F1' });
      const f2 = createMockCardFormat({
        id: 'f2',
        name: 'F2',
        supportedExtensions: ['.png'],
      });
      registry.registerCardFormat(f1);
      registry.registerCardFormat(f2);
      expect(registry.listCardFormats()).toHaveLength(2);
    });
  });

  // === AgentPlugin ===
  describe('agents', () => {
    it('registers and retrieves an agent', () => {
      const registry = new PluginRegistry();
      const agent = createMockAgent();
      registry.registerAgent(agent);
      expect(registry.getAgent('test-agent')).toBe(agent);
    });

    it('throws when registering a duplicate agent', () => {
      const registry = new PluginRegistry();
      registry.registerAgent(createMockAgent());
      expect(() => registry.registerAgent(createMockAgent())).toThrow(
        'already registered'
      );
    });

    it('lists all registered agents', () => {
      const registry = new PluginRegistry();
      const a1 = createMockAgent({ id: 'a1', name: 'A1' });
      const a2 = createMockAgent({ id: 'a2', name: 'A2' });
      registry.registerAgent(a1);
      registry.registerAgent(a2);
      expect(registry.listAgents()).toHaveLength(2);
    });
  });

  // === ImageProviderPlugin ===
  describe('image providers', () => {
    it('registers and retrieves an image provider', () => {
      const registry = new PluginRegistry();
      const img = createMockImageProvider();
      registry.registerImageProvider(img);
      expect(registry.getImageProvider('test-image-provider')).toBe(img);
    });

    it('lists all registered image providers', () => {
      const registry = new PluginRegistry();
      registry.registerImageProvider(createMockImageProvider());
      expect(registry.listImageProviders()).toHaveLength(1);
    });
  });

  // === PromptBuilderPlugin ===
  describe('prompt builders', () => {
    it('registers and retrieves a prompt builder', () => {
      const registry = new PluginRegistry();
      const builder = {
        id: 'default-builder',
        name: 'Default Builder',
        buildSystemPrompt: () => '',
        buildContext: () => '',
      };
      registry.registerPromptBuilder(builder);
      expect(registry.getPromptBuilder('default-builder')).toBe(builder);
    });

    it('lists all registered prompt builders', () => {
      const registry = new PluginRegistry();
      const b = {
        id: 'b1',
        name: 'B1',
        buildSystemPrompt: () => '',
        buildContext: () => '',
      };
      registry.registerPromptBuilder(b);
      expect(registry.listPromptBuilders()).toHaveLength(1);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "D:/Project/TextChatbot" && npm test`

Expected: FAIL — `Cannot find module '$lib/plugins/registry'` or similar import error. This confirms the tests are wired correctly and we just need the implementation.

- [ ] **Step 3: Implement PluginRegistry**

Write `src/lib/plugins/registry.ts`:
```typescript
/**
 * Plugin registry — central hub for registering and retrieving plugins.
 * Spec reference: Section 3.6 — Plugin Registry
 */

import type {
  ProviderPlugin,
  CardFormatPlugin,
  AgentPlugin,
  ImageProviderPlugin,
  PromptBuilderPlugin,
} from '$lib/types/plugin';

export class PluginRegistry {
  private providers = new Map<string, ProviderPlugin>();
  private cardFormatsById = new Map<string, CardFormatPlugin>();
  private cardFormatsByExtension = new Map<string, CardFormatPlugin>();
  private agents = new Map<string, AgentPlugin>();
  private imageProviders = new Map<string, ImageProviderPlugin>();
  private promptBuilders = new Map<string, PromptBuilderPlugin>();

  // === Provider ===

  registerProvider(plugin: ProviderPlugin): void {
    if (this.providers.has(plugin.id)) {
      throw new Error(`Provider plugin "${plugin.id}" is already registered`);
    }
    this.providers.set(plugin.id, plugin);
  }

  getProvider(id: string): ProviderPlugin {
    const plugin = this.providers.get(id);
    if (!plugin) {
      throw new Error(`Provider plugin "${id}" not found`);
    }
    return plugin;
  }

  listProviders(): ProviderPlugin[] {
    return Array.from(this.providers.values());
  }

  // === Card Format ===

  registerCardFormat(plugin: CardFormatPlugin): void {
    if (this.cardFormatsById.has(plugin.id)) {
      throw new Error(`Card format plugin "${plugin.id}" is already registered`);
    }
    this.cardFormatsById.set(plugin.id, plugin);
    for (const ext of plugin.supportedExtensions) {
      this.cardFormatsByExtension.set(ext, plugin);
    }
  }

  getCardFormat(idOrExtension: string): CardFormatPlugin {
    const byId = this.cardFormatsById.get(idOrExtension);
    if (byId) return byId;

    const byExt = this.cardFormatsByExtension.get(idOrExtension);
    if (byExt) return byExt;

    throw new Error(`Card format plugin "${idOrExtension}" not found`);
  }

  listCardFormats(): CardFormatPlugin[] {
    return Array.from(this.cardFormatsById.values());
  }

  // === Agent ===

  registerAgent(plugin: AgentPlugin): void {
    if (this.agents.has(plugin.id)) {
      throw new Error(`Agent plugin "${plugin.id}" is already registered`);
    }
    this.agents.set(plugin.id, plugin);
  }

  getAgent(id: string): AgentPlugin {
    const plugin = this.agents.get(id);
    if (!plugin) {
      throw new Error(`Agent plugin "${id}" not found`);
    }
    return plugin;
  }

  listAgents(): AgentPlugin[] {
    return Array.from(this.agents.values());
  }

  // === Image Provider ===

  registerImageProvider(plugin: ImageProviderPlugin): void {
    if (this.imageProviders.has(plugin.id)) {
      throw new Error(`Image provider plugin "${plugin.id}" is already registered`);
    }
    this.imageProviders.set(plugin.id, plugin);
  }

  getImageProvider(id: string): ImageProviderPlugin {
    const plugin = this.imageProviders.get(id);
    if (!plugin) {
      throw new Error(`Image provider plugin "${id}" not found`);
    }
    return plugin;
  }

  listImageProviders(): ImageProviderPlugin[] {
    return Array.from(this.imageProviders.values());
  }

  // === Prompt Builder ===

  registerPromptBuilder(plugin: PromptBuilderPlugin): void {
    if (this.promptBuilders.has(plugin.id)) {
      throw new Error(`Prompt builder plugin "${plugin.id}" is already registered`);
    }
    this.promptBuilders.set(plugin.id, plugin);
  }

  getPromptBuilder(id: string): PromptBuilderPlugin {
    const plugin = this.promptBuilders.get(id);
    if (!plugin) {
      throw new Error(`Prompt builder plugin "${id}" not found`);
    }
    return plugin;
  }

  listPromptBuilders(): PromptBuilderPlugin[] {
    return Array.from(this.promptBuilders.values());
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "D:/Project/TextChatbot" && npm test`

Expected output:
```
 ✓ tests/plugins/registry.test.ts (14 tests) Xms
 ✓ tests/setup.test.ts (2 tests) Xms
 Tests  16 passed (16)
```

All 14 registry tests + 2 infrastructure tests pass.

- [ ] **Step 5: Commit**

Run:
```bash
cd "D:/Project/TextChatbot"
git add src/lib/plugins/registry.ts tests/plugins/registry.test.ts
git commit -m "feat: implement PluginRegistry with full test coverage"
```

---

### Task 7: Final Verification

- [ ] **Step 1: Run full type check**

Run: `cd "D:/Project/TextChatbot" && npm run check`

Expected: `svelte-check` passes with 0 errors, 0 warnings.

- [ ] **Step 2: Run all tests**

Run: `cd "D:/Project/TextChatbot" && npm test`

Expected: 16 tests pass (14 registry + 2 infrastructure).

- [ ] **Step 3: Run SvelteKit build**

Run: `cd "D:/Project/TextChatbot" && npm run build`

Expected: Build succeeds. `build/index.html` and bundled JS exist.

- [ ] **Step 4: Verify Tauri dev starts (optional, slow)**

Run: `cd "D:/Project/TextChatbot" && npx tauri dev`

Expected: Desktop window opens showing "Terrarium — Foundation loaded." page. First run compiles Rust dependencies (may take 3-5 minutes). Close the window to exit.

If this step works, you have a fully functional SvelteKit + Tauri desktop app.

---

## Self-Review Checklist

**1. Spec coverage:**

| Spec Section | Covered in Task | Notes |
|---|---|---|
| Section 2 — Architecture (project structure) | Task 1 | Directory layout matches spec |
| Section 3.1 — ProviderPlugin | Task 5 | Interface defined in plugin.ts |
| Section 3.2 — CardFormatPlugin | Task 5 | Interface defined in plugin.ts |
| Section 3.3 — AgentPlugin | Task 5 | Interface defined in plugin.ts (v2 slot) |
| Section 3.4 — ImageProviderPlugin | Task 5 | Interface defined in plugin.ts (v2 slot) |
| Section 3.5 — PromptBuilderPlugin | Task 5 | Interface defined in plugin.ts |
| Section 3.6 — PluginRegistry | Task 6 | Full implementation with tests |
| Section 7.1 — LorebookEntry, LorebookSettings | Task 5 | All fields from spec |
| Section 7.2.1 — Trigger | Task 4 | All events and fields |
| Section 7.3 — VariableStore | Task 4 | Key-value store type |
| Section 7.4 — RegexScript | Task 4 | All stages defined |
| Section 8 — Message | Task 4 | All fields including GenerationInfo |
| Section 8 — CharacterCard | Task 5 | All 21 fields from spec |
| Section 8 — SceneState | Task 5 | With VariableStore |
| Section 8 — ChatContext | Task 5 | With lorebookMatches |

**2. Placeholder scan:**
- No TBD, TODO, or "implement later" found.
- All steps contain exact file content.
- All steps contain exact commands with expected output descriptions.

**3. Type consistency:**
- `ProviderPlugin.chat()` returns `AsyncGenerator<string>` — matches spec Section 3.1.
- `CardFormatPlugin.parse()` returns `CharacterCard` — matches spec Section 3.2.
- `ChatContext.lorebookMatches` is `LorebookEntry[]` — matches spec Section 8.
- `PluginRegistry.getCardFormat()` supports both ID and extension lookup — spec Section 3.6 says `extension` parameter, this plan supports both.
- `CharacterCard.metadata` is `Record<string, unknown>` — matches spec Section 8 for lossless roundtrip.
- All barrel exports in `index.ts` match the actual type names in each file.
