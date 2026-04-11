# Editor UIs — Implementation Plan 9

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add editor UIs for characters, lorebook, triggers/scripts, and variables. Also implement the custom theme system (HTML/CSS template rendering in Shadow DOM). These editors allow users to create and modify content that currently only works via imported cards.

**Architecture:** Each editor is a Svelte route page with form components. Editors read/write data through existing stores and storage modules. The theme system renders custom HTML/CSS templates inside a Shadow DOM for security isolation.

**Tech Stack:** SvelteKit 2, Svelte 5 (runes), Tailwind CSS v4, TypeScript 5

---

## Prerequisites

- Plans 1–8 completed
- 299 tests passing, 0 type errors
- Working Tauri app with functional UI

---

## File Structure (created by this plan)

```
D:/Project/TextChatbot/
├── src/
│   ├── routes/
│   │   ├── characters/
│   │   │   └── new/
│   │   │       └── +page.svelte              [NEW] Character create/edit
│   │   ├── chat/
│   │   │   └── [id]/
│   │   │       └── info/
│   │   │           └── +page.svelte          [NEW] Chat/character info panel
│   └── settings/
│   │       └── theme-editor/
│   │           └── +page.svelte              [NEW] Custom theme editor
│   ├── lib/
│   │   ├── components/
│   │   │   ├── editors/
│   │   │   │   ├── CharacterEditor.svelte    [NEW] Character card form
│   │   │   │   ├── LorebookEditor.svelte     [NEW] Lorebook entry list + form
│   │   │   │   ├── LorebookEntryForm.svelte  [NEW] Single lorebook entry editor
│   │   │   │   ├── TriggerEditor.svelte      [NEW] Trigger list + form
│   │   │   │   ├── TriggerForm.svelte        [NEW] Single trigger editor
│   │   │   │   ├── RegexEditor.svelte        [NEW] Regex script list + form
│   │   │   │   ├── VariableViewer.svelte     [NEW] Variable store table
│   │   │   │   └── ThemeRenderer.svelte      [NEW] Shadow DOM theme renderer
```

---

### Task 1: Character Editor

**Files:**
- Create: `src/routes/characters/new/+page.svelte`
- Create: `src/lib/components/editors/CharacterEditor.svelte`

Character create/edit form covering all CharacterCard fields: basic info (name, description, personality, scenario, firstMessage), prompt fields (systemPrompt, postHistoryInstructions), lorebook, triggers, regex scripts, and metadata.

- [ ] **Step 1: Create CharacterEditor component**

A large form component with tabs/sections for all CharacterCard fields. Uses `$state` for form data, saves via `charactersStore` or `characterStorage`.

Key sections:
- **Basic Info**: name, description, personality, scenario, firstMessage, alternateGreetings
- **Prompt**: systemPrompt, postHistoryInstructions, depthPrompt
- **Metadata**: creator, characterVersion, tags, creatorNotes
- **Lorebook**: embed LorebookEditor component
- **Triggers**: embed TriggerEditor component
- **Regex Scripts**: embed RegexEditor component

- [ ] **Step 2: Create /characters/new route page**

Wraps CharacterEditor. On save, creates a new character via `characterStorage.createCharacter()` and navigates to the chat page.

- [ ] **Step 3: Verify build + tests, commit**

---

### Task 2: Lorebook Editor

**Files:**
- Create: `src/lib/components/editors/LorebookEditor.svelte`
- Create: `src/lib/components/editors/LorebookEntryForm.svelte`

Editable list of LorebookEntry items with add/remove/reorder. Each entry form covers: name, keywords, secondaryKeywords, regex, content, position, priority, mode, scope, enabled, caseSensitive, activationPercent.

- [ ] **Step 1: Create LorebookEntryForm**

Form for a single LorebookEntry. Fields map directly to the LorebookEntry type.

- [ ] **Step 2: Create LorebookEditor**

List of entries with add/remove. Manages an array of LorebookEntry in local state, propagates changes up via `onchange` callback.

- [ ] **Step 3: Verify build + tests, commit**

---

### Task 3: Trigger Editor + Regex Editor + Variable Viewer

**Files:**
- Create: `src/lib/components/editors/TriggerEditor.svelte`
- Create: `src/lib/components/editors/TriggerForm.svelte`
- Create: `src/lib/components/editors/RegexEditor.svelte`
- Create: `src/lib/components/editors/VariableViewer.svelte`

**TriggerEditor**: List of Trigger entries with add/remove. Each trigger has: name, enabled, event selector (dropdown of TriggerEvents), pattern, matchOn, script (textarea for Lua code).

**RegexEditor**: List of RegexScript entries with add/remove. Each has: name, pattern, replacement, stage selector, enabled, flags.

**VariableViewer**: Read-only table showing all variables from the scene store. Shows key, value, type. May include a delete button.

- [ ] **Step 1: Create TriggerForm and TriggerEditor**
- [ ] **Step 2: Create RegexEditor**
- [ ] **Step 3: Create VariableViewer**
- [ ] **Step 4: Verify build + tests, commit**

---

### Task 4: Chat Info Panel + Scene Editor

**Files:**
- Create: `src/routes/chat/[id]/info/+page.svelte`

Slide-in panel showing character info, scene state (editable location/time/mood), variable viewer, and lorebook entries for the current chat.

- [ ] **Step 1: Create info panel route**

A page at `/chat/[id]/info` that shows:
- Character info (name, description, personality)
- Scene state editor (location, time, mood inputs)
- VariableViewer for current variables
- LorebookEditor (read-only view of active entries)

- [ ] **Step 2: Add info panel toggle to chat page**

Modify `/chat/[id]/+page.svelte` to add an info button in TopBar that navigates to the info panel.

- [ ] **Step 3: Verify build + tests, commit**

---

### Task 5: Custom Theme System

**Files:**
- Create: `src/lib/components/editors/ThemeRenderer.svelte`
- Create: `src/routes/settings/theme-editor/+page.svelte`

The theme system renders message lists using custom HTML/CSS templates inside a Shadow DOM for security.

- [ ] **Step 1: Create ThemeRenderer component**

Renders messages using a custom HTML template with CSS inside a Shadow DOM. Template variables (`{{char.name}}`, `{{content}}`, `{{type}}`, etc.) are substituted at render time.

- [ ] **Step 2: Create theme editor page**

Allows users to edit the HTML template and CSS for the chat view. Preview pane shows sample messages rendered with the current theme.

- [ ] **Step 3: Integrate ThemeRenderer into MessageList**

Optionally use ThemeRenderer in MessageList when a custom theme is active.

- [ ] **Step 4: Verify build + tests, commit**

---

### Task 6: Final Verification

- [ ] TypeScript check: `npm run check`
- [ ] Tests: `npx vitest run`
- [ ] Build: `npm run build`
- [ ] Rust: `cargo check`
- [ ] Manual testing of all editors

---

## Notes

- This plan covers v1 editor UIs. The block editor (visual scripting → Lua codegen) is a v2 feature per the spec roadmap.
- All editors use existing stores and storage modules — no new backend logic needed.
- Theme system is security-critical: templates from imported cards must be rendered in Shadow DOM to prevent XSS.
