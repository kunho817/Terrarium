---
name: terrarium-analyze
description: Use when working on the Terrarium project and needing to scope task impact, identify affected files, or dispatch context-aware subagents — provides architecture map, domain classification, and subagent prompt templates
---

# Terrarium Analyze

## Overview

**Stop exploring from scratch.** This skill contains a frozen architecture map of the Terrarium project. Use it to classify tasks, scope impact, and dispatch context-aware subagents — all without re-reading the codebase every session.

Announce: "Using terrarium-analyze to scope task impact."

## When to Use

- Starting a new task on the Terrarium project and need to identify affected files
- About to dispatch subagents and need to provide Terrarium context
- Scoping a feature request or bug fix to understand blast radius

## When NOT to Use

- Working on a different project
- The task is trivial (single-file fix with obvious scope)

## Architecture Map

Frozen snapshot of the project structure. Update manually when significant structural changes occur (new top-level dirs, new plugin types, new stores).

```
src/lib/
├── types/              # Shared TypeScript types
│   ├── index.ts            # Re-exports
│   ├── character.ts        # Character, CharacterCard
│   ├── message.ts          # Message, MessageRole
│   ├── session.ts          # ChatSession
│   ├── scene.ts            # Scene
│   ├── lorebook.ts         # LorebookEntry, Lorebook
│   ├── persona.ts          # Persona
│   ├── prompt-preset.ts    # PromptPreset, PromptItem
│   ├── script.ts           # Script, ScriptBlock
│   ├── trigger.ts          # Trigger, TriggerAction
│   ├── plugin.ts           # Plugin interfaces
│   ├── config.ts           # AppSettings
│   ├── image-config.ts     # ImageGenConfig
│   └── art-style.ts        # ArtStyle
│
├── core/
│   ├── agents/              # Agent pipeline (LIBRA-inspired)
│   │   ├── agent-pipeline.ts   # Pipeline orchestrator (before/after generation)
│   │   ├── agent-llm.ts        # Shared LLM call utility
│   │   ├── extraction.ts       # Memory extraction phase
│   │   ├── turn-maintenance.ts # Turn maintenance phase
│   │   ├── section-world.ts    # Section World Composer (world mode)
│   │   ├── injection.ts        # Injection formatting utilities
│   │   ├── prompts.ts          # Centralized prompt registry
│   │   ├── types.ts            # Pipeline type definitions
│   │   └── index.ts            # Re-exports
│   │
│   ├── chat/               # Chat engine (SPQA pattern)
│   │   ├── engine.ts           # ChatEngine — main orchestrator
│   │   ├── pipeline.ts         # Prompt pipeline (assembly chain)
│   │   ├── prompt-assembler.ts # Resolves preset items → final prompt
│   │   ├── template-engine.ts # {{var}} resolution
│   │   ├── lorebook.ts        # Lorebook matching & injection
│   │   ├── regex.ts           # Regex scripting
│   │   ├── use-chat.ts        # Reactive bridge: engine ↔ UI
│   │   └── use-chat-illustration.ts # Post-streaming image generation
│   │
│   ├── image/              # Image generation core
│   │   └── generator.ts       # ImageGenerator orchestrator
│   │
│   ├── image-gen/          # Image gen constants/helpers
│   │   └── novelai-constants.ts  # NovelAI-specific values
│   │
│   ├── presets/            # Default preset definitions
│   │   └── defaults.ts        # Built-in prompt presets
│   │
│   ├── scripting/          # Lua scripting engine
│   │   ├── api.ts              # Script API surface
│   │   ├── bridge.ts           # Lua ↔ JS bridge
│   │   └── mutations.ts        # State mutation ops
│   │
│   ├── bootstrap.ts            # App initialization & wiring
│   ├── events.ts               # Event bus
│   ├── triggers.ts             # Trigger evaluation engine
│   └── variables.ts            # Global variable store
│
├── plugins/
│   ├── providers/          # AI provider implementations
│   │   ├── builtin.ts          # Provider registry & base
│   │   ├── claude.ts           # Anthropic Claude
│   │   ├── openai-compatible.ts # OpenAI-compatible (OAI, DeepSeek, etc.)
│   │   └── sse.ts              # SSE stream parser
│   │
│   ├── card-formats/       # Character card parsers
│   │   ├── builtin.ts          # Card format registry
│   │   ├── risuai.ts           # RisuAI format
│   │   ├── sillytavern.ts      # SillyTavern (V2) format
│   │   └── generic-json.ts     # Generic JSON
│   │
│   ├── image-providers/    # Image gen backends
│   │   ├── builtin.ts          # Image provider registry
│   │   ├── novelai.ts          # NovelAI
│   │   └── comfyui.ts          # ComfyUI
│   │
│   └── prompt-builder/     # Prompt builder plugins
│       ├── builtin.ts          # Builder registry
│       └── default.ts          # Default builder
│
├── storage/               # Persistence layer
│   ├── database.ts            # IndexedDB wrapper
│   ├── characters.ts          # Character CRUD
│   ├── chats.ts               # Chat session CRUD
│   ├── personas.ts            # Persona CRUD
│   ├── settings.ts            # Settings read/write
│   ├── session-agent-state.ts # Agent session state persistence
│   ├── memories.ts            # Vector memory storage
│   └── paths.ts               # Storage path helpers
│
├── stores/                # Svelte reactive stores
│   ├── characters.ts          # Character store
│   ├── chat.ts                # Chat state store
│   ├── scene.ts               # Scene store
│   ├── settings.ts            # Settings store
│   ├── agent-progress.ts      # Agent pipeline progress tracking
│   └── theme.ts               # Theme store
│
├── components/
│   ├── TopBar.svelte              # App top bar
│   ├── Sidebar.svelte             # Navigation sidebar
│   ├── SceneInfoBar.svelte        # Scene context bar
│   ├── MessageList.svelte         # Chat message list
│   ├── MessageItem.svelte         # Single chat message
│   ├── InputArea.svelte           # Chat input area
│   ├── CharacterCardDisplay.svelte # Character card preview
│   ├── ImageModal.svelte          # Full-size image viewer
│   ├── GenerationInfoBadge.svelte # Image gen status badge
│   ├── GenerationInfoPanel.svelte # Image gen details panel
│   └── editors/               # Svelte editor components
│       ├── CharacterEditor.svelte
│       ├── LorebookEditor.svelte
│       ├── LorebookEntryForm.svelte
│       ├── PresetList.svelte
│       ├── PromptItemEditor.svelte
│       ├── RegexEditor.svelte
│       ├── ThemeRenderer.svelte
│       ├── TriggerEditor.svelte
│       ├── TriggerForm.svelte
│       └── VariableViewer.svelte

src/routes/                    # SvelteKit pages
├── +page.svelte               # Home
├── characters/                # Character list, new, edit
├── chat/[id]/                 # Chat view (+ info subpage)
└── settings/                  # Settings pages
    ├── image-generation/
    ├── personas/
    ├── prompt-builder/
    ├── providers/
    └── theme-editor/

src-tauri/src/                 # Rust backend
├── main.rs
├── lib.rs                     # Tauri commands
└── scripting.rs               # Lua scripting (Rust side)

tests/                         # Vitest test files (mirror src/ structure)
├── core/agents/            # agent-pipeline, extraction, turn-maintenance, section-world, injection, prompts, types
├── core/chat/                 # engine, lorebook, pipeline, prompt-assembler, regex, template-engine
├── core/image-gen/            # novelai-constants
├── core/image/                # generator
├── core/presets/              # defaults
├── core/scripting/            # bridge, mutations
├── core/                      # events, triggers, variables
├── plugins/card-formats/      # builtin, generic-json, risuai, sillytavern
├── plugins/image-providers/   # comfyui, novelai
├── plugins/prompt-builder/    # builtin, default
├── plugins/providers/         # builtin, claude, openai-compatible, sse
├── plugins/                   # registry
├── storage/                   # characters, chats, database, personas, session-agent-state
└── stores/                    # characters-store, chat
```

## When to Update

Update the architecture map when:
- A new top-level directory is added under `src/lib/`
- A new plugin type is added
- A new storage file or store is created
- The test directory structure changes significantly

Do NOT update for:
- New files within existing directories
- New components within existing editor groups
- Minor refactors

Review cadence: Check after every 5th plan completion, or when `git log` shows structural changes.

## Domain Classification

| Domain | Core path(s) | UI path(s) | Storage | Tests |
|--------|-------------|------------|---------|-------|
| Chat engine | `core/chat/engine.ts`, `core/chat/pipeline.ts`, `core/chat/use-chat.ts` | `routes/chat/` | `storage/chats.ts` | `tests/core/chat/` |
| Agent Pipeline | `core/agents/agent-pipeline.ts`, `core/agents/extraction.ts`, `core/agents/turn-maintenance.ts`, `core/agents/section-world.ts`, `core/agents/injection.ts` | `components/AgentPipelineIndicator.svelte`, `routes/settings/agents/+page.svelte` | `storage/session-agent-state.ts` | `tests/core/agents/` |
| Prompt/Preset | `core/chat/prompt-assembler.ts`, `core/chat/template-engine.ts` | `components/editors/PromptItemEditor.svelte`, `components/editors/PresetList.svelte` | `storage/settings.ts` | `tests/core/chat/prompt-assembler.test.ts`, `tests/core/chat/template-engine.test.ts` |
| Lorebook | `core/chat/lorebook.ts` | `components/editors/LorebookEditor.svelte` | — | `tests/core/chat/lorebook.test.ts` |
| Regex | `core/chat/regex.ts` | `components/editors/RegexEditor.svelte` | — | `tests/core/chat/regex.test.ts` |
| Plugins | `plugins/*/builtin.ts` | `settings/*/` | — | `tests/plugins/registry.test.ts` |
| Providers (AI) | `plugins/providers/` | `routes/settings/providers/` | `storage/settings.ts` | `tests/plugins/providers/` |
| Image gen | `core/image/generator.ts`, `core/image-gen/`, `plugins/image-providers/` | `components/ImageModal.svelte`, `components/GenerationInfoBadge.svelte`, `components/GenerationInfoPanel.svelte`, `routes/settings/image-generation/` | `storage/settings.ts` | `tests/core/image/`, `tests/plugins/image-providers/` |
| Cards | `plugins/card-formats/` | `components/editors/CharacterEditor.svelte` | `storage/characters.ts` | `tests/plugins/card-formats/` |
| Scripting | `core/scripting/`, `src-tauri/src/scripting.rs` | `components/editors/VariableViewer.svelte` | — | `tests/core/scripting/` |
| Persona | `types/persona.ts` | `routes/settings/personas/`, `components/editors/` | `storage/personas.ts` | `tests/storage/personas.test.ts` |
| Storage | `storage/*.ts` | — | (self) | `tests/storage/` |
| Stores | `stores/*.ts` | — | — | `tests/stores/` |
| Triggers | `core/triggers.ts` | `components/editors/TriggerEditor.svelte` | — | `tests/core/triggers.test.ts` |
| Theme | — | `components/editors/ThemeRenderer.svelte` | `storage/settings.ts` | — |
| Tauri/Rust | `src-tauri/src/` | — | — | — |

## Impact Analysis

```dot
digraph analysis {
  "Receive task" -> "Classify domain(s)";
  "Classify domain(s)" -> "Single domain?";
  "Single domain?" -> "Checklist mode" [label="yes"];
  "Single domain?" -> "Subagent mode" [label="no (2+ domains or unclear)"];
  "Checklist mode" -> "Look up domain table";
  "Look up domain table" -> "Grep affected symbols";
  "Grep affected symbols" -> "Trace imports";
  "Trace imports" -> "Match test files";
  "Match test files" -> "Output impact report";
  "Subagent mode" -> "Dispatch analysis subagent";
  "Dispatch analysis subagent" -> "Output impact report";
}
```

### Checklist Mode (single domain, ~70% of tasks)

1. **Classify** — Identify which single domain the task touches using the domain classification table above
2. **Lookup** — Get core/UI/storage/test paths from the domain table
3. **Grep** — Search for affected function names, class names, or type names within those paths
4. **Trace** — Check imports of files that reference changed symbols
5. **Tests** — List matching test files from the test column
6. **Output** — Produce the impact report using the format below

### Subagent Mode (2+ domains or unclear scope)

Dispatch a general-purpose subagent with:
- The architecture map from this skill
- The domain classification table
- The task description
- Instructions to search across domains and trace cross-cutting dependencies

The subagent returns a structured impact report.

### Impact Report Format

Both modes produce:

```
Task: [description]
Domains: [chat-engine, providers, ...]

Must change:
  - path/to/file.ts — reason

Might change:
  - path/to/file.ts — reason

Tests to update:
  - tests/path/to/file.test.ts — reason

Risks:
  - [cross-cutting concerns]
```

## Subagent Context Templates

When using superpowers:subagent-driven-development, use these templates to give subagents Terrarium context.

### Base Context Block

Always include this at the top of subagent prompts:

```
## Terrarium Project Context

You are working on Terrarium, a SvelteKit 5 + Tauri v2 desktop AI chatbot.

Tech stack:
- Frontend: SvelteKit 2, Svelte 5 ($props/$state runes), TypeScript 5 strict, Tailwind CSS v4 (Catppuccin Mocha)
- Backend: Tauri v2 (Rust), Lua scripting via mlua
- Build: Vite 6, Vitest 3 for testing

Critical conventions:
- Tauri HTTP plugin (@tauri-apps/plugin-http) for ALL streaming fetch — never browser fetch
- Svelte 5 runes ($state, $derived, $effect, $props) — never legacy Svelte 4 patterns ($:, .subscribe(), let: directives)
- Plugin-first architecture — providers, card formats, image providers, prompt builders are all plugins
- Test files mirror src/ structure under tests/
- Use vi.mock() for Tauri plugin dependencies in tests
```

### Domain Read Guides

Based on the task domain, tell the subagent to read these files first:

| Domain | Read first |
|--------|-----------|
| Agent Pipeline | `src/lib/core/agents/agent-pipeline.ts`, `src/lib/core/agents/types.ts`, `src/lib/core/agents/extraction.ts`, `src/lib/core/agents/turn-maintenance.ts`, `src/lib/core/agents/prompts.ts` |
| Chat engine | `src/lib/core/chat/engine.ts`, `src/lib/core/chat/pipeline.ts`, `src/lib/stores/chat.ts`, `src/lib/core/chat/use-chat.ts` |
| Prompt/Preset | `src/lib/core/chat/prompt-assembler.ts`, `src/lib/core/chat/template-engine.ts`, `src/lib/core/presets/defaults.ts` |
| Providers | `src/lib/plugins/providers/builtin.ts`, `src/lib/plugins/providers/sse.ts`, `src/lib/types/config.ts` |
| Image gen | `src/lib/core/image/generator.ts`, `src/lib/plugins/image-providers/builtin.ts`, `src/lib/core/image-gen/novelai-constants.ts` |
| Cards | `src/lib/plugins/card-formats/builtin.ts`, `src/lib/types/character.ts`, `src/lib/storage/characters.ts` |
| Scripting | `src/lib/core/scripting/api.ts`, `src/lib/core/scripting/bridge.ts`, `src-tauri/src/scripting.rs` |
| Storage | `src/lib/storage/database.ts`, `src/lib/storage/paths.ts` |
| Lorebook | `src/lib/core/chat/lorebook.ts`, `src/lib/types/lorebook.ts` |
| Persona | `src/lib/types/persona.ts`, `src/lib/storage/personas.ts` |

### Subagent Prompt Template

```
## Terrarium Project Context
[Insert Base Context Block above]

## Architecture
[Insert relevant section of the architecture map from this skill]

## Task: [task description from plan]

## Affected Files
[List from impact analysis report]

## Key Files to Read First
[From Domain Read Guide table above — pick the domain matching the task]

## Conventions
- Svelte 5 runes only ($state, $derived, $effect, $props)
- Streaming via @tauri-apps/plugin-http only
- Plugin registration pattern (see builtin.ts in each plugin dir)
- Test structure mirrors src/ under tests/
- vi.mock() for Tauri plugin dependencies

## Report Format
When done, report one of:
- DONE — task complete
- DONE_WITH_CONCERNS — complete but note concerns
- BLOCKED — cannot proceed, explain why
- NEEDS_CONTEXT — need clarification

Include:
- Files changed (list)
- Tests written/updated (list)
- Any concerns or blockers
```

## Integration with Superpowers

This skill does NOT replace any superpowers skill — it provides Terrarium-specific context that makes the existing workflow faster and more accurate.

1. **Before brainstorming/writing-plans:** Use the impact analysis flow to scope the task and identify affected files
2. **During subagent-driven-development:** Use the subagent context templates to dispatch informed subagents with baked-in Terrarium context
3. **During code review:** Use the domain table to verify test coverage for changed domains
