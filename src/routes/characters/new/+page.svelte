<script lang="ts">
  import { goto } from '$app/navigation';
  import * as characterStorage from '$lib/storage/characters';
  import CharacterEditor from '$lib/components/editors/CharacterEditor.svelte';
  import type { CharacterCard } from '$lib/types';

  // Default card with all fields
  let card = $state<CharacterCard>({
    name: '',
    description: '',
    personality: '',
    scenario: '',
    firstMessage: '',
    alternateGreetings: [],
    exampleMessages: '',
    systemPrompt: '',
    postHistoryInstructions: '',
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
  });

  let saving = $state(false);
  let error = $state('');

  async function handleSave() {
    if (!card.name.trim()) {
      error = 'Name is required';
      return;
    }
    saving = true;
    error = '';
    try {
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
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <a href="/characters" class="text-subtext0 hover:text-text transition-colors">&#8592;</a>
        <h1 class="text-lg font-semibold text-text">New Character</h1>
      </div>
      <button
        onclick={handleSave}
        disabled={saving || !card.name.trim()}
        class="px-4 py-2 bg-mauve text-crust rounded-md text-sm font-medium
               hover:bg-lavender disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {saving ? 'Creating...' : 'Create Character'}
      </button>
    </div>

    {#if error}
      <div class="px-4 py-2 bg-red/10 text-red text-sm rounded-md">{error}</div>
    {/if}

    <CharacterEditor {card} onchange={(updated) => card = updated} />
  </div>
</div>
