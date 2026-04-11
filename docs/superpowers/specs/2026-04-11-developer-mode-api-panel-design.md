# Developer Mode + API Usage Panel — Design

**Date:** 2026-04-11
**Scope:** Add developer mode toggle, capture token usage from providers, show generation info panel in chat

## Overview

When developer mode is enabled, each AI message shows a model name badge. Clicking it opens a panel with generation metadata: model, input/output tokens, context usage bar.

## Architecture

### 1. ChatMetadata — Provider Usage Capture

**Problem:** Providers parse SSE data but currently only yield text tokens. Usage data (inputTokens, outputTokens) is lost.

**Solution:** Add optional mutable `ChatMetadata` parameter to `provider.chat()`.

```typescript
interface ChatMetadata {
  inputTokens?: number;
  outputTokens?: number;
}
```

Provider populates during streaming. Engine reads after streaming completes.

### 2. SSE Usage Extraction

**OpenAI-compatible** (NanoGPT, OpenAI, Fireworks, Local LLM):
- Final SSE chunk includes `usage: { prompt_tokens, completion_tokens }`

**Claude:**
- `message_start` event: `message.usage.input_tokens`
- `message_delta` event: `usage.output_tokens`

### 3. Settings

Add `developerMode: boolean` to AppSettings (default: false).
Toggle in settings page as a checkbox.

### 4. UI Components

**GenerationInfoBadge.svelte** — Small inline badge below each AI assistant message:
- Shows model name (truncated)
- Only visible when developer mode is on
- On click: opens GenerationInfoPanel

**GenerationInfoPanel.svelte** — Modal/popup showing:
- Model name
- Input tokens / Output tokens
- Context usage bar (visual)
- Total tokens / max context ratio

## Files to Change

| File | Change |
|------|--------|
| `src/lib/types/plugin.ts` | Add `ChatMetadata` interface, update `chat()` signature |
| `src/lib/plugins/providers/openai-compatible.ts` | Extract `usage` from final SSE chunk, write to metadata |
| `src/lib/plugins/providers/claude.ts` | Extract `input_tokens` from `message_start`, `output_tokens` from `message_delta` |
| `src/lib/core/chat/engine.ts` | Create metadata, pass to provider, store in generationInfo |
| `src/lib/storage/settings.ts` | Add `developerMode` to defaults |
| `src/routes/settings/+page.svelte` | Add developer mode toggle checkbox |
| `src/lib/components/GenerationInfoBadge.svelte` | New — model badge on AI messages |
| `src/lib/components/GenerationInfoPanel.svelte` | New — generation info modal |
| `src/lib/components/MessageItem.svelte` | Show badge when dev mode on + assistant message |
| `src/lib/components/TopBar.svelte` | No change — model already shown there |
