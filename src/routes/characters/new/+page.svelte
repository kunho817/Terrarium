<script lang="ts">
  import { goto } from '$app/navigation';
  import * as characterStorage from '$lib/storage/characters';
  import type { CharacterCard } from '$lib/types';

  let name = $state('');
  let description = $state('');
  let personality = $state('');
  let scenario = $state('');
  let firstMessage = $state('');
  let systemPrompt = $state('');
  let postHistoryInstructions = $state('');
  let saving = $state(false);
  let error = $state('');

  async function handleSave() {
    if (!name.trim()) {
      error = 'Name is required';
      return;
    }
    saving = true;
    error = '';
    try {
      const card: CharacterCard = {
        name: name.trim(),
        description,
        personality,
        scenario,
        firstMessage,
        alternateGreetings: [],
        exampleMessages: '',
        systemPrompt,
        postHistoryInstructions,
        creator: '',
        characterVersion: '1.0',
        tags: [],
        creatorNotes: '',
        lorebook: [],
        loreSettings: {
          tokenBudget: 2048,
          scanDepth: 10,
          recursiveScanning: false,
          fullWordMatching: false,
        },
        regexScripts: [],
        triggers: [],
        scriptState: {},
        emotionImages: [],
        additionalAssets: [],
        metadata: {},
      };
      const id = await characterStorage.createCharacter(card);
      goto(`/chat/${id}`);
    } catch (e: any) {
      error = e?.message || 'Failed to create character';
    } finally {
      saving = false;
    }
  }
</script>

<div class="flex-1 overflow-y-auto">
  <div class="max-w-2xl mx-auto p-6 space-y-6">
    <div class="flex items-center gap-3">
      <a href="/characters" class="text-subtext0 hover:text-text transition-colors">←</a>
      <h1 class="text-lg font-semibold text-text">New Character</h1>
    </div>

    {#if error}
      <div class="px-4 py-2 bg-red/10 text-red text-sm rounded-md">{error}</div>
    {/if}

    <div class="space-y-4">
      <!-- Name -->
      <div class="space-y-1">
        <label for="name" class="text-sm font-medium text-text">Name *</label>
        <input
          id="name"
          type="text"
          bind:value={name}
          placeholder="Character name"
          class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
                 focus:outline-none focus:border-mauve placeholder:text-subtext0"
        />
      </div>

      <!-- Description -->
      <div class="space-y-1">
        <label for="desc" class="text-sm font-medium text-text">Description</label>
        <textarea
          id="desc"
          bind:value={description}
          placeholder="Character appearance, background, traits..."
          rows="4"
          class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
                 focus:outline-none focus:border-mauve resize-y placeholder:text-subtext0"
        ></textarea>
      </div>

      <!-- Personality -->
      <div class="space-y-1">
        <label for="personality" class="text-sm font-medium text-text">Personality</label>
        <textarea
          id="personality"
          bind:value={personality}
          placeholder="Character personality traits, speech patterns..."
          rows="3"
          class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
                 focus:outline-none focus:border-mauve resize-y placeholder:text-subtext0"
        ></textarea>
      </div>

      <!-- Scenario -->
      <div class="space-y-1">
        <label for="scenario" class="text-sm font-medium text-text">Scenario</label>
        <textarea
          id="scenario"
          bind:value={scenario}
          placeholder="Setting and situation for the chat..."
          rows="3"
          class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
                 focus:outline-none focus:border-mauve resize-y placeholder:text-subtext0"
        ></textarea>
      </div>

      <!-- First Message -->
      <div class="space-y-1">
        <label for="firstMsg" class="text-sm font-medium text-text">First Message</label>
        <textarea
          id="firstMsg"
          bind:value={firstMessage}
          placeholder="The character's opening message..."
          rows="3"
          class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
                 focus:outline-none focus:border-mauve resize-y placeholder:text-subtext0"
        ></textarea>
      </div>

      <!-- System Prompt -->
      <div class="space-y-1">
        <label for="sysprompt" class="text-sm font-medium text-text">System Prompt</label>
        <textarea
          id="sysprompt"
          bind:value={systemPrompt}
          placeholder="Custom system prompt instructions..."
          rows="4"
          class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
                 focus:outline-none focus:border-mauve resize-y placeholder:text-subtext0"
        ></textarea>
      </div>

      <!-- Post History Instructions -->
      <div class="space-y-1">
        <label for="phi" class="text-sm font-medium text-text">Author's Note</label>
        <textarea
          id="phi"
          bind:value={postHistoryInstructions}
          placeholder="Instructions injected after chat history..."
          rows="2"
          class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
                 focus:outline-none focus:border-mauve resize-y placeholder:text-subtext0"
        ></textarea>
      </div>

      <button
        onclick={handleSave}
        disabled={saving || !name.trim()}
        class="px-4 py-2 bg-mauve text-crust rounded-md text-sm font-medium
               hover:bg-lavender disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {saving ? 'Creating...' : 'Create Character'}
      </button>
    </div>
  </div>
</div>
