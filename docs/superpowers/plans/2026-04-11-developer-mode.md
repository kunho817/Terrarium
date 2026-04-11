# Developer Mode + API Usage Panel — Implementation Plan

**Plan Date:** 2026-04-11
**Spec:** `docs/superpowers/specs/2026-04-11-developer-mode-api-panel-design.md`

## Task 1: Add ChatMetadata type and update ProviderPlugin interface

**Files:**
- `src/lib/types/plugin.ts`

**What:**
- Add `ChatMetadata` interface: `{ inputTokens?: number; outputTokens?: number }`
- Update `ProviderPlugin.chat()` signature to include optional `metadata?: ChatMetadata` parameter
- Update any other provider interface references

**Test:** Type check passes

---

## Task 2: Update OpenAI-compatible provider to capture token usage

**Files:**
- `src/lib/plugins/providers/openai-compatible.ts`
- `src/lib/plugins/providers/sse.ts` (may need to expose raw events)

**What:**
- In `chat()` generator, parse the final SSE chunk for `usage` field
- OpenAI format: `{ usage: { prompt_tokens: number, completion_tokens: number } }`
- Some providers send usage in a chunk with `choices: []` or `finish_reason: "stop"`
- Write `metadata.inputTokens = usage.prompt_tokens` and `metadata.outputTokens = usage.completion_tokens`
- Also handle `stream_options: { include_usage: true }` if needed for OpenAI specifically

**Test:** Unit test with mock SSE data containing usage

---

## Task 3: Update Claude provider to capture token usage

**Files:**
- `src/lib/plugins/providers/claude.ts`

**What:**
- In `chat()` generator, parse SSE events:
  - `message_start` → extract `message.usage.input_tokens`
  - `message_delta` → extract `usage.output_tokens`
- Write to metadata object

**Test:** Unit test with mock Claude SSE data

---

## Task 4: Update engine to pass metadata and store generationInfo

**Files:**
- `src/lib/core/chat/engine.ts`

**What:**
- In `tokenStream()`, create `ChatMetadata` object
- Pass to `provider.chat(assembled, capturedConfig, metadata)`
- After streaming completes, populate `assistantMessage.generationInfo.inputTokens` and `outputTokens` from metadata

**Test:** Existing engine tests still pass, new test verifying metadata capture

---

## Task 5: Add developerMode to settings + toggle UI

**Files:**
- `src/lib/storage/settings.ts`
- `src/routes/settings/+page.svelte`

**What:**
- Add `developerMode: false` to default settings
- Add a toggle/checkbox in settings page labeled "Developer Mode"
- Read from settings store

**Test:** Settings default includes developerMode

---

## Task 6: Create GenerationInfoBadge + GenerationInfoPanel components

**Files:**
- `src/lib/components/GenerationInfoBadge.svelte` (new)
- `src/lib/components/GenerationInfoPanel.svelte` (new)

**What:**

**GenerationInfoBadge:**
- Props: `info: GenerationInfo`, `onclick`
- Renders: small pill/badge showing model name (shortened)
- Styled as a subtle button, Catppuccin Mocha palette

**GenerationInfoPanel:**
- Props: `info: GenerationInfo`, `onclose`
- Renders: centered modal overlay with:
  - Model name
  - Input tokens count
  - Output tokens count
  - Visual context usage bar (gradient from green to yellow based on usage %)
  - Close button
- Backdrop click closes

**Test:** Component renders without errors

---

## Task 7: Wire GenerationInfoBadge into MessageItem

**Files:**
- `src/lib/components/MessageItem.svelte`

**What:**
- Import settings store
- Import GenerationInfoBadge, GenerationInfoPanel
- When `settings.developerMode` is true AND message role is 'assistant' AND `message.generationInfo` exists:
  - Render `<GenerationInfoBadge>` below message content
  - On badge click, show `<GenerationInfoPanel>` with the message's generationInfo
- Panel state managed locally with a boolean

**Test:** Manual verification via `npm run tauri dev`

---

## Execution Order

Tasks 1-4 are sequential (each depends on the previous).
Task 5 is independent (settings).
Task 6 is independent (components).
Task 7 depends on tasks 5 and 6.

```
Task 1 → Task 2 → Task 3 → Task 4
Task 5 (parallel with 1-4)
Task 6 (parallel with 1-5)
Task 7 (after 5 and 6)
```
