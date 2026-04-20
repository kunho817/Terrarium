# Agent → Image Generation Integration Design

**Date:** 2026-04-20
**Scope:** Thread agent outputs into image prompt generation for contextually appropriate images
**Approach:** Pass existing agent context through the pipeline — no new agents or LLM calls

---

## Current State

Image generation (`generateImagePrompt()`) builds prompts from:
- Character name + description
- Scene state (location, time, mood) — via `sceneStore` (stale, not agent-updated)
- Persona name
- Last 10 messages

Agents produce rich context that images never see:
- Director guidance (scene mandate, emphasis, forbidden moves)
- Character states (emotion per character)
- Scene state (freshly extracted from narrative by Scene State Agent)
- Memory facts

## Design

### New Type: AgentImageContext

In `src/lib/core/image/generator.ts`:

```ts
export interface AgentImageContext {
  sceneLocation?: string;
  sceneTime?: string;
  sceneMood?: string;
  directorMandate?: string;
  directorEmphasis?: string[];
  characterEmotions?: Record<string, string>;
}
```

### Data Flow

1. **`engine.send()`** — After `onBeforeSend` and `onAfterReceive`, build `AgentImageContext` from agent results:
   - Scene State Agent's `updatedState.scene` → location, time, mood
   - Director Agent's `updatedState.directorGuidance` → mandate, emphasis
   - Character State Agent's updated character states → name→emotion map
   - Return it alongside existing `stream`, `onComplete`, `userMessage`

2. **`use-chat.ts`** — Pass `AgentImageContext` from engine result to `streamAndFinalize()`

3. **`streamAndFinalize()`** — Accept `AgentImageContext` as parameter, pass to `generateAndInsertIllustrations()`

4. **`generateAndInsertIllustrations()`** — Set it on `ImageGenContext`

5. **`generateImagePrompt()`** — Append agent context to the prompt:
   - Director mandate → `Director Scene Mandate: ...`
   - Director emphasis → `Director Emphasis: ...`
   - Character emotions → `Character Emotions: Alice (nervous), Bob (calm)`
   - Scene details now come from agent-extracted state (more accurate than stale store)

### Files Changed

| File | Change |
|------|--------|
| `src/lib/core/image/generator.ts` | Add `AgentImageContext`, add to `ImageGenContext`, use in `generateImagePrompt()` |
| `src/lib/core/chat/engine.ts` | Build `AgentImageContext` from agent results, add to `SendMessageResult` |
| `src/lib/core/chat/use-chat.ts` | Pass agent context to `streamAndFinalize()` |
| `src/lib/core/chat/use-chat-streaming.ts` | Accept and forward `AgentImageContext` |
| `src/lib/core/chat/use-chat-illustration.ts` | Pass agent context into `ImageGenContext` |

No new agents. No new LLM calls. No UI changes.
