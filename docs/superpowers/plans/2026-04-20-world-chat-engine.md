# World Chat Improvements — Sub-Project 2: World Chat Engine

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement narrator-style prompt assembly, per-world settings resolution, and multiple first messages with a greeting picker for World Chat.

**Architecture:** The engine changes focus on three areas: (1) prompt assembler gets a `worldDescription` item type and a narrator fallback system prompt, (2) settings resolution adds a `resolveEffectiveSettings()` function that merges global + world overrides, and (3) session creation flow gets a greeting picker that handles AlternateGreeting[]. The `buildWorldCharacterLore` function is enhanced to include personality/example messages.

**Tech Stack:** Svelte 5, TypeScript, Vitest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-04-20-world-chat-improvements-design.md` (Sections 2.1-2.4)

---

## File Structure

### New files
- `src/lib/core/chat/world-settings.ts` — `resolveEffectiveSettings()` function
- `src/lib/components/GreetingPicker.svelte` — modal greeting picker component
- `tests/core/chat/world-settings.test.ts` — tests for settings resolution

### Modified files
- `src/lib/core/chat/prompt-assembler.ts` — narrator fallback prompt, worldDescription item type
- `src/lib/core/chat/engine.ts` — enhanced `buildWorldCharacterLore`, settings resolution integration
- `src/lib/core/chat/use-chat.ts` — `injectFirstMessage()` uses AlternateGreeting, settings resolution
- `src/lib/core/chat/use-chat-helpers.ts` — `worldCardToCharacterCard` updated for new fields
- `src/routes/chat/[id]/+page.svelte` — greeting picker on new session, settings resolution in sendMessage
- `src/lib/types/prompt-preset.ts` — add `worldDescription` PromptItemType

---

### Task 1: Add worldDescription PromptItemType

**Files:**
- Modify: `src/lib/types/prompt-preset.ts`

- [ ] **Step 1: Read current PromptItemType**

Read `src/lib/types/prompt-preset.ts` to find the `PromptItemType` union.

- [ ] **Step 2: Add worldDescription to the union**

Add `'worldDescription'` to the `PromptItemType` union type. This allows preset creators to place the world description at a specific position in the prompt.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types/prompt-preset.ts
git commit -m "feat: add worldDescription PromptItemType for world chat prompts"
```

---

### Task 2: Implement resolveEffectiveSettings

**Files:**
- Create: `src/lib/core/chat/world-settings.ts`
- Create: `tests/core/chat/world-settings.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/core/chat/world-settings.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { resolveEffectiveSettings } from '$lib/core/chat/world-settings';
import type { WorldSettings } from '$lib/types';

describe('resolveEffectiveSettings', () => {
  const globalConfig = {
    providerId: 'openai',
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 4096,
  };

  it('returns global config when no world settings', () => {
    const result = resolveEffectiveSettings(globalConfig, undefined);
    expect(result.providerId).toBe('openai');
    expect(result.model).toBe('gpt-4');
    expect(result.temperature).toBe(0.7);
  });

  it('returns global config when world settings is empty', () => {
    const result = resolveEffectiveSettings(globalConfig, {});
    expect(result.providerId).toBe('openai');
    expect(result.temperature).toBe(0.7);
  });

  it('overrides specific fields from world settings', () => {
    const worldSettings: WorldSettings = {
      temperature: 0.9,
      maxTokens: 2048,
    };
    const result = resolveEffectiveSettings(globalConfig, worldSettings);
    expect(result.temperature).toBe(0.9);
    expect(result.maxTokens).toBe(2048);
    expect(result.providerId).toBe('openai');
  });

  it('overrides provider and model', () => {
    const worldSettings: WorldSettings = {
      providerId: 'anthropic',
      model: 'claude-3',
    };
    const result = resolveEffectiveSettings(globalConfig, worldSettings);
    expect(result.providerId).toBe('anthropic');
    expect(result.model).toBe('claude-3');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/chat/world-settings.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement resolveEffectiveSettings**

Create `src/lib/core/chat/world-settings.ts`:

```typescript
import type { WorldSettings, UserConfig } from '$lib/types';

export function resolveEffectiveSettings(
	globalConfig: UserConfig,
	worldSettings: WorldSettings | undefined,
): UserConfig {
	if (!worldSettings) return globalConfig;

	return {
		...globalConfig,
		...(worldSettings.providerId && { providerId: worldSettings.providerId }),
		...(worldSettings.model && { model: worldSettings.model }),
		...(worldSettings.temperature !== undefined && { temperature: worldSettings.temperature }),
		...(worldSettings.topP !== undefined && { topP: worldSettings.topP }),
		...(worldSettings.maxTokens !== undefined && { maxTokens: worldSettings.maxTokens }),
	};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/chat/world-settings.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/core/chat/world-settings.ts tests/core/chat/world-settings.test.ts
git commit -m "feat: add resolveEffectiveSettings for per-world settings overrides"
```

---

### Task 3: Add Narrator Fallback and worldDescription to Prompt Assembler

**Files:**
- Modify: `src/lib/core/chat/prompt-assembler.ts`

- [ ] **Step 1: Update buildFallbackSystemPrompt for narrator mode**

In `src/lib/core/chat/prompt-assembler.ts`, find the `buildFallbackSystemPrompt` function. Add narrator mode:

After the existing function body, add logic to detect world cards. When `worldCard` is present and no system prompt is set, use a narrator fallback:

```typescript
function buildFallbackSystemPrompt(card: CharacterCard, scene: SceneState, persona?: UserPersona, worldCard?: WorldCard): string {
  const parts: string[] = [];

  if (worldCard) {
    parts.push('You are a skilled novelist narrating an immersive story set in the world described below. Write in third person, describing events, dialogue, and the environment vividly. Respond to the user\'s actions by continuing the narrative naturally.');
  } else {
    parts.push(`You are ${card.name}.`);
  }

  if (scene.location || scene.time || scene.mood) {
    const sceneParts: string[] = [];
    if (scene.location) sceneParts.push(`Current location: ${scene.location}`);
    if (scene.time) sceneParts.push(`Time: ${scene.time}`);
    if (scene.mood) sceneParts.push(`Mood: ${scene.mood}`);
    parts.push(sceneParts.join('. ') + '.');
  }

  return parts.join('\n\n');
}
```

- [ ] **Step 2: Add worldDescription case to resolveItem**

In the `resolveItem` switch statement, add a new case after `description`:

```typescript
    case 'worldDescription': {
      if (!ctx.worldCard?.description) return null;
      const defaultFormat = 'World: {{slot}}';
      const raw = resolveSlotContent(item.content || defaultFormat, ctx.worldCard.description);
      return sysMsg(substituteVariables(raw, buildTemplateVars(card, scene, ctx.worldCard.description, ctx.persona, ctx.worldCard)));
    }
```

- [ ] **Step 3: Verify compilation**

Run: `npx svelte-check --threshold error 2>&1 | Select-String "prompt-assembler"`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/core/chat/prompt-assembler.ts
git commit -m "feat: add narrator fallback prompt and worldDescription item type"
```

---

### Task 4: Enhance buildWorldCharacterLore

**Files:**
- Modify: `src/lib/core/chat/engine.ts`

- [ ] **Step 1: Read current buildWorldCharacterLore**

Read `src/lib/core/chat/engine.ts` around line 39-55 to find `buildWorldCharacterLore`.

- [ ] **Step 2: Enhance to include personality and example messages**

Replace the function body. The current version joins `[char.name, char.description, char.personality].filter(Boolean)`. Enhance to include more detail:

```typescript
function buildWorldCharacterLore(worldCard: WorldCard): LorebookEntry[] {
  return worldCard.characters.map(char => {
    const parts: string[] = [];
    parts.push(`[Character: ${char.name}]`);
    if (char.description) parts.push(char.description);
    if (char.personality) parts.push(`Personality: ${char.personality}`);
    parts.push('');

    return {
      id: `__world_char_${char.id}`,
      name: char.name,
      keywords: [char.name.toLowerCase()],
      caseSensitive: false,
      content: parts.join('\n'),
      position: 'before_char' as const,
      priority: 0,
      enabled: true,
      scanDepth: worldCard.loreSettings.scanDepth,
      scope: 'global' as const,
      mode: 'normal' as const,
      constant: true,
      category: 'character' as const,
    };
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/core/chat/engine.ts
git commit -m "feat: enhance buildWorldCharacterLore with personality and structured format"
```

---

### Task 5: Build GreetingPicker Component

**Files:**
- Create: `src/lib/components/GreetingPicker.svelte`

- [ ] **Step 1: Create the greeting picker modal**

Create `src/lib/components/GreetingPicker.svelte`:

```svelte
<script lang="ts">
  import type { AlternateGreeting } from '$lib/types';

  let {
    greetings,
    onselect,
    oncancel,
  }: {
    greetings: AlternateGreeting[];
    onselect: (greeting: AlternateGreeting) => void;
    oncancel: () => void;
  } = $props();

  let selectedId = $state<string | null>(greetings.length === 1 ? greetings[0].id : null);
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-overlay0/50" role="dialog">
  <div class="bg-mantle rounded-xl border border-surface1 shadow-2xl max-w-lg w-full mx-4 max-h-[80vh] flex flex-col">
    <div class="p-4 border-b border-surface0">
      <h2 class="text-lg font-semibold text-text">Choose a Starting Scenario</h2>
      <p class="text-xs text-subtext0 mt-1">Select how the story begins</p>
    </div>

    <div class="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
      {#each greetings as greeting (greeting.id)}
        <button
          type="button"
          onclick={() => { selectedId = greeting.id; }}
          class="w-full text-left p-3 rounded-lg border transition-colors cursor-pointer
                 {selectedId === greeting.id
                   ? 'border-mauve bg-mauve/10'
                   : 'border-surface1 bg-crust hover:bg-surface0'}"
        >
          <div class="flex items-center gap-2 mb-1">
            <span class="text-sm font-medium text-text">{greeting.name || 'Untitled'}</span>
            {#if selectedId === greeting.id}
              <span class="text-xs text-mauve">&#10003;</span>
            {/if}
          </div>
          <p class="text-xs text-subtext0 line-clamp-3">{greeting.content || 'No content'}</p>
        </button>
      {/each}
    </div>

    <div class="p-4 border-t border-surface0 flex justify-end gap-2">
      <button
        type="button"
        onclick={oncancel}
        class="px-4 py-2 rounded-lg text-sm text-subtext0 hover:text-text hover:bg-surface0 transition-colors cursor-pointer border-none bg-transparent"
      >
        Cancel
      </button>
      <button
        type="button"
        onclick={() => {
          const g = greetings.find(g => g.id === selectedId);
          if (g) onselect(g);
        }}
        disabled={!selectedId}
        class="px-4 py-2 rounded-lg text-sm font-medium bg-mauve text-crust hover:bg-lavender
               disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer border-none"
      >
        Start
      </button>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/GreetingPicker.svelte
git commit -m "feat: add GreetingPicker modal component"
```

---

### Task 6: Wire Settings Resolution and Greeting Picker into Chat Page

**Files:**
- Modify: `src/lib/core/chat/use-chat.ts`
- Modify: `src/routes/chat/[id]/+page.svelte`

- [ ] **Step 1: Update use-chat.ts sendMessage to use world settings**

In `src/lib/core/chat/use-chat.ts`, update the `sendMessage` function to resolve world settings before building config.

Add import at top:
```typescript
import { resolveEffectiveSettings } from './world-settings';
```

In `sendMessage`, after resolving the card, resolve settings:

Find the line that builds `config` from `settings.providers[settings.defaultProvider]`. Before it, add:

```typescript
	const baseConfig = {
		providerId: settings.defaultProvider,
		model: (providerConfig?.model as string) || undefined,
		apiKey: (providerConfig?.apiKey as string) || undefined,
		baseUrl: (providerConfig?.baseUrl as string) || undefined,
		temperature: (providerConfig?.temperature as number) || undefined,
		maxTokens: (providerConfig?.maxTokens as number) || undefined,
	};

	const config = resolveEffectiveSettings(baseConfig, resolved.worldCard?.worldSettings);
```

Replace the existing `config` object with the resolved one.

- [ ] **Step 2: Update injectFirstMessage for AlternateGreeting**

In `src/lib/core/chat/use-chat.ts`, update `injectFirstMessage()`:

Change the function to accept an optional greeting content parameter:

```typescript
export async function injectFirstMessage(greetingContent?: string): Promise<void> {
	const state = get(chatStore);
	if (state.messages.length === 0) {
		let firstMsg: string | undefined = greetingContent;

		if (!firstMsg) {
			const charState = get(charactersStore);
			if (charState.current?.firstMessage) {
				firstMsg = charState.current.firstMessage;
			}
		}

		if (!firstMsg) {
			try {
				const { worldsStore } = await import('$lib/stores/worlds');
				const worldState = get(worldsStore);
				if (worldState.current?.firstMessage) {
					firstMsg = worldState.current.firstMessage;
				}
			} catch {}
		}

		if (firstMsg) {
			const greeting: Message = {
				role: 'assistant',
				content: firstMsg,
				type: 'dialogue',
				timestamp: Date.now(),
				isFirstMessage: true,
			};
			chatStore.addMessage(greeting);
			await chatRepo.saveMessages();
		}
	}
}
```

- [ ] **Step 3: Add greeting picker state and logic to chat page**

In `src/routes/chat/[id]/+page.svelte`, add:

Import:
```typescript
import GreetingPicker from '$lib/components/GreetingPicker.svelte';
import type { AlternateGreeting } from '$lib/types';
```

Add state:
```typescript
let showGreetingPicker = $state(false);
let pendingGreetingWorldId = $state<string | null>(null);
```

In the `onMount`, after loading the world and before `initChat`, check if world has alternate greetings and this is a new session:

After `await loadSessions();`, and before the session init block, add greeting picker logic:

```typescript
      if (cardType === 'world' && !$page.url.searchParams.get('session')) {
        const { worldsStore } = await import('$lib/stores/worlds');
        const worldState = $worldsStore;
        if (worldState.current?.alternateGreetings?.length) {
          pendingGreetingWorldId = characterId;
          showGreetingPicker = true;
        }
      }
```

Add handler functions:
```typescript
  async function handleGreetingSelect(greeting: AlternateGreeting) {
    showGreetingPicker = false;
    const characterId = $page.params.id!;
    await initChat(characterId);
    const { injectFirstMessage } = await import('$lib/core/chat/use-chat');
    await injectFirstMessage(greeting.content);
    await loadSessions();
    const chatState = $chatStore;
    if (chatState.sessionId) {
      const typeParam = cardType === 'world' ? 'cardType=world&' : '';
      goto(`/chat/${characterId}?${typeParam}session=${chatState.sessionId}`, { replaceState: true });
    }
    pendingGreetingWorldId = null;
  }

  function handleGreetingCancel() {
    showGreetingPicker = false;
    pendingGreetingWorldId = null;
  }
```

Add the GreetingPicker component in the template, right before the closing `</div>` of the main container:

```svelte
{#if showGreetingPicker && $worldsStore.current?.alternateGreetings?.length}
  <GreetingPicker
    greetings={$worldsStore.current.alternateGreetings}
    onselect={handleGreetingSelect}
    oncancel={handleGreetingCancel}
  />
{/if}
```

- [ ] **Step 4: Verify compilation**

Run: `npx svelte-check --threshold error 2>&1 | Select-String "GreetingPicker|use-chat"`
Expected: No new errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/core/chat/use-chat.ts src/routes/chat/[id]/+page.svelte src/lib/components/GreetingPicker.svelte
git commit -m "feat: wire world settings resolution and greeting picker into chat flow"
```

---

### Task 7: Run Full Test Suite and Verify

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (845+), 2 pre-existing WASM errors OK

- [ ] **Step 2: Run svelte-check**

Run: `npx svelte-check --threshold error`
Expected: No new errors beyond pre-existing ones

- [ ] **Step 3: Fix any issues found**

Address any type errors from the changes.

- [ ] **Step 4: Final commit if needed**

```bash
git add -A
git commit -m "fix: address type errors from world chat engine integration"
```
