<script lang="ts">
  import type { CharacterCard } from '$lib/types/character';
  import type { LorebookEntry } from '$lib/types/lorebook';
  import type { Trigger } from '$lib/types/trigger';
  import type { RegexScript } from '$lib/types/script';
  import LorebookEditor from './LorebookEditor.svelte';
  import TriggerEditor from './TriggerEditor.svelte';
  import RegexEditor from './RegexEditor.svelte';

  let { card, onchange }: {
    card: CharacterCard;
    onchange: (card: CharacterCard) => void;
  } = $props();

  type TabId = 'basic' | 'prompts' | 'lorebook' | 'triggers' | 'metadata';

  interface Tab {
    id: TabId;
    label: string;
  }

  const tabs: Tab[] = [
    { id: 'basic', label: 'Basic Info' },
    { id: 'prompts', label: 'Prompts' },
    { id: 'lorebook', label: 'Lorebook' },
    { id: 'triggers', label: 'Triggers & Scripts' },
    { id: 'metadata', label: 'Metadata' },
  ];

  let activeTab = $state<TabId>('basic');

  // Local tags string for comma-separated input
  let tagsString = $state(card.tags.join(', '));

  // Alternate greetings list
  let alternateGreetings = $state<string[]>([...card.alternateGreetings]);

  function update(patch: Partial<CharacterCard>) {
    onchange({ ...card, ...patch });
  }

  function updateField<K extends keyof CharacterCard>(key: K, value: CharacterCard[K]) {
    update({ [key]: value } as Partial<CharacterCard>);
  }

  function updateTags() {
    const parsed = tagsString.split(',').map((t) => t.trim()).filter(Boolean);
    updateField('tags', parsed);
  }

  function addGreeting() {
    const next = [...alternateGreetings, ''];
    alternateGreetings = next;
    updateField('alternateGreetings', next);
  }

  function removeGreeting(index: number) {
    const next = alternateGreetings.filter((_: string, i: number) => i !== index);
    alternateGreetings = next;
    updateField('alternateGreetings', next);
  }

  function updateGreeting(index: number, value: string) {
    const next = [...alternateGreetings];
    next[index] = value;
    alternateGreetings = next;
    updateField('alternateGreetings', next);
  }

  // Depth prompt helpers
  let depthPromptContent = $state(card.depthPrompt?.prompt ?? '');
  let depthPromptDepth = $state(card.depthPrompt?.depth ?? 4);

  function updateDepthPrompt() {
    if (depthPromptContent.trim() === '') {
      updateField('depthPrompt', undefined);
    } else {
      updateField('depthPrompt', { prompt: depthPromptContent, depth: depthPromptDepth });
    }
  }
</script>

<div class="flex flex-col gap-4">
  <!-- Tab navigation -->
  <div class="flex border-b border-surface1">
    {#each tabs as tab (tab.id)}
      <button
        type="button"
        onclick={() => activeTab = tab.id}
        class="px-4 py-2 text-sm font-medium transition-colors
               {activeTab === tab.id
                 ? 'text-mauve border-b-2 border-mauve'
                 : 'text-subtext0 hover:text-text border-b-2 border-transparent'}"
      >
        {tab.label}
      </button>
    {/each}
  </div>

  <!-- Tab content -->
  <div class="flex flex-col gap-4">
    {#if activeTab === 'basic'}
      <!-- Basic Info -->
      <div class="space-y-4">
        <!-- Name -->
        <div class="space-y-1">
          <label for="char-name" class="text-sm font-medium text-text">Name *</label>
          <input
            id="char-name"
            type="text"
            value={card.name}
            oninput={(e) => updateField('name', (e.target as HTMLInputElement).value)}
            placeholder="Character name"
            class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
                   focus:outline-none focus:border-mauve placeholder:text-subtext0"
          />
        </div>

        <!-- Description -->
        <div class="space-y-1">
          <label for="char-desc" class="text-sm font-medium text-text">Description</label>
          <textarea
            id="char-desc"
            value={card.description}
            oninput={(e) => updateField('description', (e.target as HTMLTextAreaElement).value)}
            placeholder="Character appearance, background, traits..."
            rows="4"
            class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
                   focus:outline-none focus:border-mauve resize-y placeholder:text-subtext0"
          ></textarea>
        </div>

        <!-- Personality -->
        <div class="space-y-1">
          <label for="char-personality" class="text-sm font-medium text-text">Personality</label>
          <textarea
            id="char-personality"
            value={card.personality}
            oninput={(e) => updateField('personality', (e.target as HTMLTextAreaElement).value)}
            placeholder="Character personality traits, speech patterns..."
            rows="3"
            class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
                   focus:outline-none focus:border-mauve resize-y placeholder:text-subtext0"
          ></textarea>
        </div>

        <!-- Scenario -->
        <div class="space-y-1">
          <label for="char-scenario" class="text-sm font-medium text-text">Scenario</label>
          <textarea
            id="char-scenario"
            value={card.scenario}
            oninput={(e) => updateField('scenario', (e.target as HTMLTextAreaElement).value)}
            placeholder="Setting and situation for the chat..."
            rows="3"
            class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
                   focus:outline-none focus:border-mauve resize-y placeholder:text-subtext0"
          ></textarea>
        </div>

        <!-- First Message -->
        <div class="space-y-1">
          <label for="char-firstmsg" class="text-sm font-medium text-text">First Message</label>
          <textarea
            id="char-firstmsg"
            value={card.firstMessage}
            oninput={(e) => updateField('firstMessage', (e.target as HTMLTextAreaElement).value)}
            placeholder="The character's opening message..."
            rows="3"
            class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
                   focus:outline-none focus:border-mauve resize-y placeholder:text-subtext0"
          ></textarea>
        </div>

        <!-- Alternate Greetings -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <label class="text-sm font-medium text-text">Alternate Greetings</label>
            <button
              type="button"
              onclick={addGreeting}
              class="px-3 py-1 rounded text-xs font-medium bg-surface0 text-blue
                     hover:bg-surface1 transition-colors"
            >
              + Add Greeting
            </button>
          </div>
          {#each alternateGreetings as greeting, i}
            <div class="flex items-start gap-2">
              <textarea
                value={greeting}
                oninput={(e) => updateGreeting(i, (e.target as HTMLTextAreaElement).value)}
                placeholder="Alternate greeting message..."
                rows="3"
                class="flex-1 bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
                       focus:outline-none focus:border-mauve resize-y placeholder:text-subtext0"
              ></textarea>
              <button
                type="button"
                onclick={() => removeGreeting(i)}
                class="px-2 py-1 rounded text-sm text-red hover:bg-surface0 transition-colors mt-1"
                title="Remove greeting"
              >
                &times;
              </button>
            </div>
          {/each}
          {#if alternateGreetings.length === 0}
            <p class="text-xs text-overlay0 text-center py-2">No alternate greetings. Click "+ Add Greeting" to add one.</p>
          {/if}
        </div>
      </div>

    {:else if activeTab === 'prompts'}
      <!-- Prompts -->
      <div class="space-y-4">
        <!-- System Prompt -->
        <div class="space-y-1">
          <label for="char-sysprompt" class="text-sm font-medium text-text">System Prompt</label>
          <textarea
            id="char-sysprompt"
            value={card.systemPrompt}
            oninput={(e) => updateField('systemPrompt', (e.target as HTMLTextAreaElement).value)}
            placeholder="Override the default system prompt for this character..."
            rows="4"
            class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
                   focus:outline-none focus:border-mauve resize-y placeholder:text-subtext0"
          ></textarea>
          <p class="text-xs text-subtext0">Leave empty to use the default system prompt.</p>
        </div>

        <!-- Author's Note (Post History Instructions) -->
        <div class="space-y-1">
          <label for="char-posthist" class="text-sm font-medium text-text">Author's Note</label>
          <textarea
            id="char-posthist"
            value={card.postHistoryInstructions}
            oninput={(e) => updateField('postHistoryInstructions', (e.target as HTMLTextAreaElement).value)}
            placeholder="Instructions injected after the chat history..."
            rows="3"
            class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
                   focus:outline-none focus:border-mauve resize-y placeholder:text-subtext0"
          ></textarea>
          <p class="text-xs text-subtext0">Also known as "Post History Instructions". Injected after the last message.</p>
        </div>

        <!-- Depth Prompt -->
        <div class="space-y-2">
          <label class="text-sm font-medium text-text">Depth Prompt</label>
          <textarea
            value={depthPromptContent}
            oninput={(e) => { depthPromptContent = (e.target as HTMLTextAreaElement).value; updateDepthPrompt(); }}
            placeholder="Prompt injected at a specific depth in the chat history..."
            rows="3"
            class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
                   focus:outline-none focus:border-mauve resize-y placeholder:text-subtext0"
          ></textarea>
          <div class="flex items-center gap-2">
            <label for="char-depth-num" class="text-xs text-subtext0 whitespace-nowrap">Depth:</label>
            <input
              id="char-depth-num"
              type="number"
              min="0"
              max="999"
              value={depthPromptDepth}
              oninput={(e) => { depthPromptDepth = Number((e.target as HTMLInputElement).value) || 0; updateDepthPrompt(); }}
              class="w-20 bg-surface0 text-text text-sm rounded-md px-3 py-1 border border-surface1
                     focus:outline-none focus:border-mauve"
            />
            <p class="text-xs text-subtext0">Messages from the bottom of the chat history.</p>
          </div>
        </div>
      </div>

    {:else if activeTab === 'lorebook'}
      <!-- Lorebook -->
      <div class="space-y-4">
        <LorebookEditor
          entries={card.lorebook}
          onchange={(entries: LorebookEntry[]) => updateField('lorebook', entries)}
        />
      </div>

    {:else if activeTab === 'triggers'}
      <!-- Triggers & Scripts -->
      <div class="space-y-6">
        <TriggerEditor
          triggers={card.triggers}
          onchange={(triggers: Trigger[]) => updateField('triggers', triggers)}
        />

        <div class="border-t border-surface1 pt-4">
          <RegexEditor
            scripts={card.regexScripts}
            onchange={(scripts: RegexScript[]) => updateField('regexScripts', scripts)}
          />
        </div>
      </div>

    {:else if activeTab === 'metadata'}
      <!-- Metadata -->
      <div class="space-y-4">
        <!-- Creator -->
        <div class="space-y-1">
          <label for="char-creator" class="text-sm font-medium text-text">Creator</label>
          <input
            id="char-creator"
            type="text"
            value={card.creator}
            oninput={(e) => updateField('creator', (e.target as HTMLInputElement).value)}
            placeholder="Your name or handle"
            class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
                   focus:outline-none focus:border-mauve placeholder:text-subtext0"
          />
        </div>

        <!-- Character Version -->
        <div class="space-y-1">
          <label for="char-version" class="text-sm font-medium text-text">Character Version</label>
          <input
            id="char-version"
            type="text"
            value={card.characterVersion}
            oninput={(e) => updateField('characterVersion', (e.target as HTMLInputElement).value)}
            placeholder="1.0"
            class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
                   focus:outline-none focus:border-mauve placeholder:text-subtext0"
          />
        </div>

        <!-- Tags -->
        <div class="space-y-1">
          <label for="char-tags" class="text-sm font-medium text-text">Tags</label>
          <input
            id="char-tags"
            type="text"
            value={tagsString}
            oninput={(e) => { tagsString = (e.target as HTMLInputElement).value; updateTags(); }}
            placeholder="Comma-separated tags (e.g. fantasy, original, adventure)"
            class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
                   focus:outline-none focus:border-mauve placeholder:text-subtext0"
          />
          <p class="text-xs text-subtext0">Separate tags with commas</p>
        </div>

        <!-- Creator Notes -->
        <div class="space-y-1">
          <label for="char-notes" class="text-sm font-medium text-text">Creator Notes</label>
          <textarea
            id="char-notes"
            value={card.creatorNotes}
            oninput={(e) => updateField('creatorNotes', (e.target as HTMLTextAreaElement).value)}
            placeholder="Notes for other users about this character..."
            rows="4"
            class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
                   focus:outline-none focus:border-mauve resize-y placeholder:text-subtext0"
          ></textarea>
        </div>
      </div>
    {/if}
  </div>
</div>
