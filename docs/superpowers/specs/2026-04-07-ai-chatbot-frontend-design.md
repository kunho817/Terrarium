# AI Chatbot Frontend — Design Spec

**Date:** 2026-04-07
**Status:** Draft
**Stack:** SvelteKit + Tauri (Rust) + SQLite

---

## 1. Overview

An open-source, desktop-based AI chatbot frontend inspired by RisuAI. The primary focus is **multi-character simulation chatbot** with narrative/descriptive style, not 1:1 messenger chat. Supports plugin-based extensibility for AI providers, card formats, agents, and user-customizable HTML/CSS themes.

### Core Principles

- **Plugin-first architecture** — every AI provider, card format, and agent is a plugin
- **Narrative simulation UI** — multi-character, descriptive storytelling as primary view
- **User-customizable themes** — HTML/CSS template system for chat view rendering
- **Desktop-first** — Tauri for lightweight, fast desktop app with local file storage

---

## 2. Architecture

```
TextChatbot/
├── src-tauri/              # Tauri backend (Rust)
│   ├── src/
│   │   ├── main.rs
│   │   ├── commands/       # Tauri commands (file I/O, window management)
│   │   └── plugins/        # Rust-side plugins (file system access)
│   └── Cargo.toml
├── src/                    # SvelteKit frontend
│   ├── lib/
│   │   ├── core/           # Core engine
│   │   │   ├── chat/       # Chat engine (message processing, streaming)
│   │   │   ├── storage/    # Local storage abstraction (SQLite via Tauri)
│   │   │   └── plugin-loader.ts  # Plugin loader & registry
│   │   ├── plugins/        # Plugin interfaces & built-in plugins
│   │   │   ├── types.ts    # Plugin type definitions
│   │   │   ├── providers/  # AI provider plugins
│   │   │   │   ├── nanogpt/    # Priority provider
│   │   │   │   ├── openai/
│   │   │   │   ├── claude/
│   │   │   │   └── local-llm/
│   │   │   └── card-formats/ # Card format plugins
│   │   │       ├── risuai/
│   │   │       ├── sillytavern/
│   │   │       └── generic-json/
│   │   ├── agents/         # Agent plugins (v2 expansion)
│   │   ├── scripting/      # Scripting engine
│   │   │   ├── lua/        # Lua runtime bridge (calls Tauri-side VM)
│   │   │   ├── blocks/     # Block editor (visual → Lua codegen)
│   │   │   ├── api.ts      # Script API type definitions
│   │   │   └── sandbox.ts  # Sandbox orchestration
│   │   ├── stores/         # Svelte stores (state management)
│   │   │   ├── chat.ts
│   │   │   ├── characters.ts
│   │   │   ├── scene.ts
│   │   │   ├── settings.ts
│   │   │   └── theme.ts
│   │   └── utils/          # Utilities
│   ├── routes/             # SvelteKit routes
│   └── app.html
├── static/
└── package.json
```

---

## 3. Plugin System

### 3.1 AI Provider Plugin

```typescript
interface ProviderPlugin {
  id: string;                          // "nanogpt", "openai", "claude"
  name: string;
  icon?: string;
  requiredConfig: ConfigField[];

  chat(messages: Message[], config: UserConfig): AsyncGenerator<string>;
  chatWithCard(messages: Message[], card: CharacterCard, config: UserConfig): AsyncGenerator<string>;
  listModels?(config: UserConfig): Promise<ModelInfo[]>;
  validateConfig(config: UserConfig): Promise<boolean>;
}
```

`chat()` returns `AsyncGenerator<string>` for real-time streaming token output to UI.

Priority order: NanoGPT → OpenAI → Claude → Local LLM (Ollama, LM Studio).

### 3.2 Card Format Plugin

```typescript
interface CardFormatPlugin {
  id: string;                          // "risuai", "sillytavern"
  name: string;
  supportedExtensions: string[];       // [".json", ".png"]

  parse(data: ArrayBuffer): CharacterCard;
  export(card: CharacterCard): ArrayBuffer;
  validate(data: ArrayBuffer): boolean;
}
```

Designed as detachable plugins — format-specific logic is fully encapsulated. New formats can be added by community contributors without touching core code.

### 3.3 Agent Plugin (v2 expansion slot)

```typescript
interface AgentPlugin {
  id: string;                           // "memory", "director", "illustrator"
  name: string;

  onBeforeSend(ctx: ChatContext): Promise<ChatContext>;
  onAfterReceive(ctx: ChatContext, response: string): Promise<string>;
  runBackground(ctx: ChatContext): Promise<void>;
}
```

Hook-based pipeline: agents intercept messages before send and after receive. Enables Memory Agent (embedding-based retrieval), Director Agent (scene/character management), and Illustrator Agent (image generation triggers).

### 3.4 Image Provider Plugin (v2 expansion slot)

```typescript
interface ImageProviderPlugin {
  id: string;                           // "novelai", "stable-diffusion"
  name: string;

  generateImage(prompt: string, config: UserConfig): Promise<ArrayBuffer>;
  requiredConfig: ConfigField[];
}
```

### 3.5 Prompt Builder Plugin (v1 built-in)

```typescript
interface PromptBuilderPlugin {
  id: string;
  name: string;

  buildSystemPrompt(card: CharacterCard, scene: SceneState): string;
  buildContext(messages: Message[], scene: SceneState): string;
}
```

Ships as a built-in v1 feature — users can directly edit and customize prompts (RisuAI-style).

### 3.6 Plugin Registry

```typescript
class PluginRegistry {
  registerProvider(plugin: ProviderPlugin): void;
  registerCardFormat(plugin: CardFormatPlugin): void;
  registerAgent(plugin: AgentPlugin): void;
  registerImageProvider(plugin: ImageProviderPlugin): void;
  registerPromptBuilder(plugin: PromptBuilderPlugin): void;

  getProvider(id: string): ProviderPlugin;
  getCardFormat(extension: string): CardFormatPlugin;
  listProviders(): ProviderPlugin[];
  listCardFormats(): CardFormatPlugin[];
}
```

---

## 4. Chat Pipeline

```
User Input
    │
    ▼
┌─────────────────────────────────┐
│  onBeforeSend hooks             │
│  ├─ Memory Agent: inject relevant memories    │
│  ├─ Director Agent: add scene directions      │
│  └─ Prompt Builder: assemble final prompt     │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│  ProviderPlugin.chat()          │  Main AI call (NanoGPT, etc.)
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│  onAfterReceive hooks           │
│  ├─ Director: check consistency              │
│  ├─ Illustrator: trigger image generation     │
│  └─ Memory: extract & store key info          │
└─────────────────────────────────┘
    │
    ▼
UI Rendering (custom theme applied)
```

---

## 5. UI Design

### 5.1 Layout

Left sidebar (collapsible) + main chat area. RisuAI-style dark theme (Catppuccin Mocha palette).

**Sidebar:**
- New chat button
- Character list with avatars
- Chat history grouped by character/scenario
- Settings navigation (API, general, plugins)

**Main area:**
- Top bar: character info, model name, quick actions
- Scene info bar: location, time, mood (for simulation mode)
- Message area: narrative-style rendering (not messenger bubbles)
- Input area: mode selector (dialogue / narration / action / system) + text input

### 5.2 Routing

```
/                       → Chat list (home)
/chat/[id]              → Chat screen
/chat/[id]/info         → Chat/character info panel (slide-in)
/characters             → Character gallery
/characters/new         → Character create/edit
/settings               → Settings
/settings/providers     → API provider settings
/settings/plugins       → Plugin management
```

### 5.3 Custom Theme System

Users can write HTML templates + CSS to fully customize the chat view rendering.

**Template variables:**
- `{{char.name}}`, `{{char.color}}`, `{{char.avatar}}` — character data
- `{{content}}` — message content
- `{{action}}` — action/narration text
- `{{type}}` — message type ("dialogue", "narrator", "action", "system")
- `{{scene.location}}`, `{{scene.time}}`, `{{scene.mood}}` — scene state

**Rendering:** Templates are rendered inside a sandboxed environment (Shadow DOM or iframe) for security. Custom themes are stored as files and can be shared between users.

**Built-in themes:**
- Default simulation view (narrative with character portraits)
- Additional themes can be added by the community

### 5.4 Default Simulation View

The default chat view is designed for multi-character narrative simulation:
- Narrator messages: bordered block with muted styling
- Character dialogue: portrait + name (unique color) + dialogue text
- Character actions: italic text below dialogue
- User input: same format as character, with mode selector
- Scene info bar at top showing location, time, mood
- Streaming indicator for in-progress AI responses

---

## 6. Data Storage

### 6.1 File Structure (Tauri local filesystem)

```
~/.textchatbot/
├── data.db                    # SQLite — chat history, character metadata
├── characters/
│   └── {uuid}/
│       ├── card.json          # Character card data
│       └── avatar.png         # Avatar image
├── themes/
│   ├── default/               # Built-in default theme
│   ├── novel/                 # Built-in novel theme
│   └── {custom-theme}/        # User custom themes
│       ├── theme.html
│       └── theme.css
├── plugins/
│   └── {plugin-id}/           # Installed plugins
└── config.json                # Global config (API keys, default provider, etc.)
```

### 6.2 State Management (Svelte stores)

- `chat.ts` — current chat session state, message stream
- `characters.ts` — character list, selected character
- `scene.ts` — simulation state (location, time, mood, participating characters)
- `settings.ts` — user settings, provider configurations
- `theme.ts` — current theme, custom HTML/CSS

---

## 7. Lorebook & Trigger System

### 7.1 Lorebook (World Knowledge Base)

Context-aware knowledge entries that inject background information into prompts when keywords are detected in recent messages. Inspired by RisuAI's Lorebook with enhanced features.

```typescript
interface Lorebook {
  entries: LorebookEntry[];
  settings: LorebookSettings;
}

interface LorebookEntry {
  id: string;
  name: string;

  // Trigger conditions
  keywords: string[];                // ["magic", "elf", "ancient language"]
  secondaryKeywords?: string[];      // AND condition — both primary AND secondary must match
  regex?: string;                    // Advanced pattern matching
  caseSensitive: boolean;

  // Content
  content: string;                   // Text injected into prompt

  // Injection control
  position: "before_char" | "after_char" | "before_scenario" | "after_messages" | "author_note";
  priority: number;                  // Higher = injected first when token budget is tight
  tokenLimit?: number;               // Max tokens for this entry

  // Activation conditions
  enabled: boolean;
  scanDepth: number;                 // Search last N messages for keywords
  scope: "global" | "character" | "scenario";
  characterIds?: string[];           // Only activate for specific characters
  activationPercent?: number;        // Probability-based activation (0-100)

  // Modes (from RisuAI)
  mode: "normal" | "constant" | "selective" | "folder";
  constant: boolean;                 // Always inject regardless of keywords

  // Hierarchical (RisuAI child/folder)
  parentId?: string;
  folderName?: string;

  // v2: Embedding-based matching
  useEmbedding?: boolean;
  embeddingThreshold?: number;       // Cosine similarity threshold

  // Caching
  loreCache?: { key: string; data: string[] };
}

interface LorebookSettings {
  tokenBudget: number;               // Total lore tokens allowed per request
  scanDepth: number;                 // Default scan depth
  recursiveScanning: boolean;        // Matched entries can trigger other entries
  fullWordMatching: boolean;
}
```

**Activation flow:**
```
Scan last N messages for keywords/regex
    │
    ▼
Filter by scope, character, probability
    │
    ▼
Sort matched entries by priority
    │
    ▼
Inject into prompt at specified positions (within token budget)
```

### 7.2 Scripting Engine (Layered Architecture)

The trigger system is built on a layered scripting engine. RisuAI-style block coding and Lua scripting share the same underlying API. The block editor is a visual frontend that generates Lua code.

```
┌─────────────────────────────────────┐
│  Layer 3: Block Editor (UI)         │  Non-developers — drag & drop blocks
│  ┌─────┐ ┌─────┐ ┌─────┐           │  Generates Lua automatically
│  │ SET │ │ IF  │ │ROLL │ ...       │
│  └─────┘ └─────┘ └─────┘           │
├─────────────────────────────────────┤
│  Layer 2: Lua Script                │  Power users — write Lua directly
│  if getVar("hp") < 30 then         │  Full control over game logic
│    setVar("status", "injured")     │
│    injectLore("injury")            │
│    playEffect("screen_shake")      │
│  end                                │
├─────────────────────────────────────┤
│  Layer 1: Script API                │  Shared runtime — both layers call this
│  setVar / getVar / rollDice /       │
│  changeScene / playEffect / ...     │
├─────────────────────────────────────┤
│  Layer 0: Sandboxed Runtime         │  Tauri Rust side (mlua crate)
│  Lua VM — no filesystem/network    │  Isolated execution environment
└─────────────────────────────────────┘
```

**Why Lua:**
- Lightweight, fast, easy to sandbox (no filesystem/network access)
- `mlua` crate provides excellent Rust integration for Tauri
- RisuAI also supports Lua — compatibility with existing content
- Safe to execute untrusted scripts from imported character cards

#### 7.2.1 Trigger (Event-Script Binding)

Triggers bind events to Lua scripts. When an event fires, the associated script executes in the sandboxed runtime.

```typescript
interface Trigger {
  id: string;
  name: string;
  enabled: boolean;

  // Event matching
  event: "on_message"               // Any message (user or AI)
        | "on_user_message"          // User sends a message
        | "on_ai_message"            // AI generates a message
        | "on_chat_start"            // Chat session begins
        | "on_chat_end"              // Chat session ends
        | "on_character_enter"       // Character joins scene
        | "on_character_leave"       // Character leaves scene
        | "on_scene_change"          // Scene location/time/mood changes
        | "on_variable_change"       // A variable is modified
        | "on_timer"                 // Periodic timer tick
        | "on_regex_match"           // Regex pattern found in text
        | "on_manual";               // Triggered by user action (button, command)

  // Optional regex filter (only for on_message / on_regex_match)
  pattern?: string;                   // Regex pattern to match in message text
  matchOn?: "user_input" | "ai_output" | "both";

  // Script to execute
  script: string;                     // Lua code

  // Or: reference to a block-generated script
  blockScriptId?: string;             // ID of a script created via block editor
}
```

#### 7.2.2 Script API (Exposed to Lua)

The sandboxed Lua environment exposes these functions. Block coding and hand-written Lua both use the same API.

```lua
-- === Variable Store ===
setVar(key: string, value: string|number|boolean)
getVar(key: string): string|number|boolean
hasVar(key: string): boolean
deleteVar(key: string)
listVars(): table                    -- Returns all variables as key-value table

-- === Scene Control ===
setLocation(location: string)
setTime(time: string)
setMood(mood: string)
getLocation(): string
getTime(): string
getMood(): string

-- === Character Control ===
addCharacter(characterId: string)
removeCharacter(characterId: string)
getActiveCharacters(): table         -- Returns array of character IDs
getCharacterName(characterId: string): string
getCharacterField(characterId: string, field: string): string

-- === Lorebook ===
injectLore(loreName: string)         -- Force-inject a lore entry by name
disableLore(loreName: string)        -- Temporarily disable a lore entry
enableLore(loreName: string)         -- Re-enable a lore entry

-- === Message Manipulation ===
sendMessage(text: string, type: string)  -- "system", "narrator", "dialogue"
modifyMessage(messageIndex: number, newText: string)
blockMessage()                       -- Prevent current message from being sent
appendText(text: string)             -- Append text to current AI response

-- === Prompt Control ===
injectPrompt(text: string, position: string)  -- Add text to prompt at position
setAuthorNote(text: string)          -- Set/change author's note

-- === Dice & Random ===
rollDice(sides: number): number      -- Roll an N-sided die
rollDice(count: number, sides: number): table  -- Roll multiple dice
randomChance(percent: number): boolean  -- True with given probability
pickRandom(table): any               -- Pick random element from array

-- === UI Effects ===
playEffect(effectName: string, config?: table)  -- "screen_shake", "glow", "flash"
playSound(soundUrl: string)
changeTheme(themeId: string)
showToast(message: string)           -- Show a temporary notification
showModal(html: string)              -- Show a modal dialog

-- === LLM Calls ===
llmCall(prompt: string): string      -- Synchronous LLM call, returns response
llmCallAsync(prompt: string): thread  -- Async LLM call (Lua coroutine)

-- === Image Generation ===
generateImage(prompt: string, config?: table): string  -- Returns image URL/path

-- === Utility ===
log(message: string)                 -- Debug log
sleep(ms: number)                    -- Wait (in async context)
getTime(): number                    -- Unix timestamp
formatDate(timestamp: number, format: string): string

-- === String Manipulation ===
matchRegex(text: string, pattern: string): table|nil
replaceRegex(text: string, pattern: string, replacement: string): string
```

#### 7.2.3 Block Editor (Visual Scripting)

The block editor is a visual programming interface where users drag and drop blocks to create scripts. It generates Lua code automatically.

**Block categories:**

| Category | Blocks | Generated Lua |
|----------|--------|---------------|
| **Logic** | IF/ELSE, AND/OR, NOT, LOOP | `if/else`, `and/or`, `not`, `for/while` |
| **Variables** | SET, GET, DELETE, HAS | `setVar()`, `getVar()`, etc. |
| **Scene** | Set Location, Set Time, Set Mood | `setLocation()`, `setTime()`, `setMood()` |
| **Characters** | Add/Remove Character, Get Name | `addCharacter()`, `removeCharacter()` |
| **Lorebook** | Inject Lore, Disable Lore | `injectLore()`, `disableLore()` |
| **Messages** | Send System, Modify, Block | `sendMessage()`, `modifyMessage()` |
| **Prompt** | Inject Prompt, Set Author Note | `injectPrompt()`, `setAuthorNote()` |
| **Dice** | Roll Dice, Random Chance | `rollDice()`, `randomChance()` |
| **Effects** | Play Effect, Play Sound | `playEffect()`, `playSound()` |
| **Theme** | Change Theme, Show Toast | `changeTheme()`, `showToast()` |
| **AI** | LLM Call, Generate Image | `llmCall()`, `generateImage()` |

**Example — Block editor generates this Lua:**
```lua
-- Block: "When user message matches '\[(데미지|공격).*\d+\]'"
-- Generated Lua:
local damage = matchRegex(getMessage(), "%d+")
local hp = getVar("player.hp")
hp = hp - tonumber(damage)
setVar("player.hp", hp)

if hp < 30 then
  setVar("status", "injured")
  injectLore("injury_effects")
  playEffect("screen_shake", { color = "#ff0000", duration = 500 })
  sendMessage("⚠️ 부상! HP가 " .. tostring(hp) .. "로 떨어졌습니다.", "system")
end
```

#### 7.2.4 Sandboxed Runtime

The Lua VM runs on the Tauri Rust side via the `mlua` crate:

- **No filesystem access** — scripts cannot read/write files
- **No network access** — scripts cannot make HTTP requests
- **No OS commands** — scripts cannot execute shell commands
- **Limited CPU/memory** — scripts have execution time and memory limits
- **API-only access** — scripts can only call the exposed Script API functions

This makes it safe to execute scripts from imported character cards without security risks.

### 7.3 Variable Store (Game State)

Persistent key-value store for tracking game state, character stats, and scenario progress across the chat session.

```typescript
interface VariableStore {
  [key: string]: string | number | boolean;
  // Examples:
  // "player.hp": 100,
  // "player.gold": 50,
  // "location.current": "dark_forest",
  // "quest.main": "find_artifact",
  // "board.position": 5,
  // "npc.alice.affection": 75,
  // "flags.met_king": true
}
```

Variables are accessible in:
- **Trigger conditions** — `player.hp < 30` → activate "injury" lore entry
- **Lorebook entries** — `quest.main === "find_artifact"` → inject artifact lore
- **Prompt templates** — `{{var.player.hp}}` substituted in prompts
- **Custom scripts** — read/write via script API

### 7.4 Regex Script System (RisuAI Compatibility)

RisuAI-style regex scripts that transform text at different pipeline stages:

```typescript
interface RegexScript {
  id: string;
  name: string;
  pattern: string;                   // Regex pattern (in)
  replacement: string;               // Replacement string (out)
  stage: "modify_input"             // Transform user input before sending
         | "modify_output"           // Transform AI output before display
         | "modify_request"          // Transform the request payload
         | "modify_display";         // Transform only for display (not stored)
  enabled: boolean;
  flag?: string;                     // Regex flags (g, i, m, s)
}
```

---

## 8. Shared Types

```typescript
// === Character Card ===
interface CharacterCard {
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
  postHistoryInstructions: string;   // Author's note
  depthPrompt?: { depth: number; prompt: string };

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
  scriptState: Record<string, string | number | boolean>;

  // Additional assets
  emotionImages: [string, string][];
  additionalAssets: [string, string, string][];

  // Format extension data (preserved during import/export)
  metadata: Record<string, unknown>;
}

// === Messages ===
interface Message {
  role: "user" | "assistant" | "system" | "narrator";
  characterId?: string;               // Which character spoke
  content: string;
  action?: string;                    // Action/narration text
  type: "dialogue" | "narrator" | "action" | "system";
  timestamp: number;
  generationInfo?: {
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
  };
}

// === Scene State ===
interface SceneState {
  location: string;
  time: string;
  mood: string;
  participatingCharacters: string[];
  variables: VariableStore;           // Game state variables
}

// === Chat Context ===
interface ChatContext {
  messages: Message[];
  card: CharacterCard;
  scene: SceneState;
  config: UserConfig;
  additionalPrompt?: string;
  lorebookMatches: LorebookEntry[];   // Currently active lore entries
}
```

The `metadata: Record<string, unknown>` field preserves format-specific data (e.g., RisuAI `extentions`, SillyTavern fields) without loss during import/export cycles.

---

## 9. RisuAI Card Compatibility

### 9.1 Import Mapping

The RisuAI card format plugin maps RisuAI's `character` interface to our `CharacterCard`:

| RisuAI Field | Our Field | Notes |
|---|---|---|
| `name` | `name` | Direct |
| `desc` | `description` | Direct |
| `personality` | `personality` | Direct |
| `scenario` | `scenario` | Direct |
| `firstMessage` | `firstMessage` | Direct |
| `alternateGreetings` | `alternateGreetings` | Direct |
| `exampleMessage` | `exampleMessages` | Direct |
| `systemPrompt` | `systemPrompt` | Direct |
| `postHistoryInstructions` | `postHistoryInstructions` | Author's note |
| `creatorNotes` | `creatorNotes` | Direct |
| `globalLore` | `lorebook` | Lorebook entries mapped |
| `customscript` | `regexScripts` | Regex scripts mapped |
| `triggerscript` | `triggers` | Trigger scripts mapped |
| `backgroundHTML` | `backgroundHTML` | UI customization |
| `backgroundCSS` | `backgroundCSS` | UI customization |
| `virtualscript` | `virtualScript` | Sandboxed script |
| `scriptstate` | `scriptState` | Variable state |
| `emotionImages` | `emotionImages` | Direct |
| `additionalAssets` | `additionalAssets` | Direct |
| `bias` | `metadata.bias` | Preserved in metadata |
| `depth_prompt` | `depthPrompt` | Direct |
| `tags` | `tags` | Direct |
| `creator` | `creator` | Direct |
| `characterVersion` | `characterVersion` | Direct |
| `sdData` / `newGenData` | `metadata.sdData` | Preserved, not natively used |
| `extentions` | `metadata.risuExtensions` | All RisuAI extensions preserved |

### 9.2 Lorebook Mapping

| RisuAI `loreBook` | Our `LorebookEntry` |
|---|---|
| `key` (comma-separated) | `keywords` (split by comma) |
| `secondkey` | `secondaryKeywords` |
| `insertorder` | `priority` |
| `comment` | `name` |
| `content` | `content` |
| `mode` | `mode` (direct: normal/constant/selective/folder) |
| `alwaysActive` | `constant` |
| `selective` | requires both `keywords` AND `secondaryKeywords` |
| `extententions.risu_case_sensitive` | `caseSensitive` |
| `activationPercent` | `activationPercent` |
| `useRegex` | `regex` enabled flag |
| `folder` | `folderName` |

### 9.3 Lossless Roundtrip

The RisuAI card format plugin guarantees **lossless roundtrip**: importing a RisuAI card and exporting it back produces the original card with all fields intact. Unknown/proprietary fields are stored in `metadata` and re-injected on export.

---

## 10. Expansion Roadmap

| Feature | Plugin Type | Target Version |
|---------|------------|----------------|
| User-editable prompts | PromptBuilderPlugin | v1 (built-in) |
| NanoGPT provider | ProviderPlugin | v1 (built-in) |
| OpenAI / Claude / Local LLM | ProviderPlugin | v1 (built-in) |
| RisuAI card format (lossless roundtrip) | CardFormatPlugin | v1 (built-in) |
| SillyTavern card format | CardFormatPlugin | v1 (built-in) |
| Custom HTML/CSS themes | Theme system | v1 (built-in) |
| Lorebook (keyword/regex + recursive scanning) | Core engine | v1 (built-in) |
| Trigger system (event → Lua script binding) | Core engine | v1 (built-in) |
| Lua sandboxed runtime (mlua crate) | Tauri Rust side | v1 (built-in) |
| Variable store (game state tracking) | Core engine | v1 (built-in) |
| Regex scripts (input/output transform) | Core engine | v1 (built-in) |
| Block editor (visual scripting → Lua) | UI feature | v2 |
| Embedding-based memory | AgentPlugin | v2 |
| Director agent (scene/character management) | AgentPlugin | v2 |
| Image generation (NovelAI, etc.) | ImageProviderPlugin | v2 |
| Lorebook embedding-based matching | Lorebook enhancement | v2 |
| Community plugin marketplace | Plugin registry | v3 |
