# Agent Progress Monitoring — Design Spec

**Date:** 2026-04-19
**Sub-project:** 3 of 4 (Code Quality → Session System → **Agent Progress Monitoring** → Memory Inspector)

## Problem

When a user sends a message, the agent pipeline (Memory → Director → Scene State → Character State) runs silently before LLM generation begins. Users see no feedback during this phase — the UI appears frozen until the first token streams. This is confusing when agents take several seconds to complete.

## Goal

Show a minimal, real-time floating indicator that displays which agents are running during the pipeline phase, plus an LLM generation step during token streaming. The indicator auto-hides when the pipeline completes.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Display style | Floating pill, bottom-right corner | Non-intrusive, doesn't displace content |
| Detail level | Status only (pending/running/done/failed) | Minimal UI, quick to scan |
| Visibility | Only during agent + generation phases | No clutter when idle |
| LLM phase | Included as final pipeline step | User sees full lifecycle |
| State management | Svelte writable store | Consistent with existing pattern |
| Callback mechanism | Progress callback passed to AgentRunner | Decouples progress from agent logic |

## Architecture

### Pipeline State Store

New file: `src/lib/stores/agent-progress.ts`

```typescript
type PipelineStepStatus = 'pending' | 'running' | 'done' | 'failed';

interface PipelineStep {
  agentId: string;
  label: string;
  status: PipelineStepStatus;
}

interface PipelineState {
  active: boolean;
  steps: PipelineStep[];
  startedAt: number;
}
```

Store functions:
- `startPipeline(agents: {id: string, label: string}[])` — sets `active: true`, initializes all steps as `pending`
- `updateStep(agentId: string, status: PipelineStepStatus)` — updates a single step
- `resetPipeline()` — sets `active: false`, clears steps

### Progress Callback

`AgentRunner.onBeforeSend` accepts an optional `onProgress` callback:

```typescript
type ProgressCallback = (agentId: string, status: 'running' | 'done' | 'failed') => void;
```

Before each agent's `onBeforeSend` runs, the runner calls `onProgress(agent.id, 'running')`. After completion (success or catch), it calls `onProgress(agent.id, 'done')` or `onProgress(agent.id, 'failed')`.

### Engine Integration

In `engine.ts`:

1. Before calling `agentRunner.onBeforeSend`, call `startPipeline(...)` with all registered agents + an `{id: 'llm-generation', label: 'Generating'}` step.
2. Pass `onProgress` callback that calls `updateStep(agentId, status)`.
3. When token streaming begins, call `updateStep('llm-generation', 'running')`.
4. When streaming completes (in `streamAndFinalize` or the token generator), call `updateStep('llm-generation', 'done')` then `resetPipeline()` after a brief delay (300ms) so the user sees the final ✓.

### UI Component

New file: `src/lib/components/AgentPipelineIndicator.svelte`

- Positioned `fixed` or `absolute` in bottom-right of the chat area
- Renders a pill/badge with agent labels and status icons:
  - `○` pending
  - `●` running (with subtle pulse animation)
  - `✓` done
  - `✗` failed
- Only renders when `$pipelineStore.active` is true
- Subscribes to `agentProgress` store
- Fades out when pipeline completes

Wired into `src/routes/chat/[id]/+page.svelte` inside the chat area container.

### Example rendering

```
Memory ✓  Director ✓  SceneState ●  CharState ○  ...Generating ○
```

During LLM streaming:
```
Memory ✓  Director ✓  SceneState ✓  CharState ✓  Generating ●
```

## Scope

### In scope
- Pipeline progress store
- AgentRunner progress callback integration
- Engine integration (start/update/reset pipeline)
- Floating indicator component
- Fading animation on completion

### Out of scope
- Post-turn agent report/summary panel (sub-project 4 handles memory inspection)
- Clickable indicator with expanded detail
- Agent execution timing/duration tracking
- Persistent agent logs/history
- Configurable agent pipeline order in UI

## Testing

- Unit tests for pipeline store (start, update, reset)
- Unit tests for AgentRunner with progress callback (verify callbacks fire in correct order)
- Integration test: engine.send() fires pipeline start → per-agent updates → llm-generation → reset

## Files Changed

| File | Change |
|------|--------|
| `src/lib/stores/agent-progress.ts` | **New** — pipeline state store |
| `src/lib/types/agent.ts` | Add `ProgressCallback` type |
| `src/lib/core/agents/agent-runner.ts` | Accept `onProgress` callback in `onBeforeSend` |
| `src/lib/core/chat/engine.ts` | Start/update/reset pipeline around agent + LLM phases |
| `src/lib/components/AgentPipelineIndicator.svelte` | **New** — floating indicator |
| `src/routes/chat/[id]/+page.svelte` | Wire indicator into chat area |
| `tests/stores/agent-progress.test.ts` | **New** — store tests |
| `tests/agents/agent-runner-progress.test.ts` | **New** — progress callback tests |
