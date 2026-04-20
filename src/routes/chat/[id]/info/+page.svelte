<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { charactersStore } from '$lib/stores/characters';
  import { charactersRepo } from '$lib/repositories/characters-repo';
  import { worldsStore } from '$lib/stores/worlds';
  import { worldsRepo } from '$lib/repositories/worlds-repo';
  import { chatStore } from '$lib/stores/chat';
  import { sceneStore } from '$lib/stores/scene';
  import { sceneRepo } from '$lib/repositories/scene-repo';
  import VariableViewer from '$lib/components/editors/VariableViewer.svelte';

  let location = $state('');
  let time = $state('');
  let mood = $state('');
  let saving = $state(false);
  let saveMessage = $state('');
  let infoExpanded = $state(true);

  const cardId = $derived($page.params.id ?? '');
  const cardType = $derived(
    ($page.url.searchParams.get('cardType') === 'world' || $worldsStore.current) && !$charactersStore.current
      ? 'world' as const
      : 'character' as const
  );

  const cardName = $derived(
    cardType === 'world'
      ? ($worldsStore.current?.name ?? '')
      : ($charactersStore.current?.name ?? '')
  );

  const cardDescription = $derived(
    cardType === 'world'
      ? ($worldsStore.current?.description ?? '')
      : ($charactersStore.current?.description ?? '')
  );

  const cardScenario = $derived(
    cardType === 'world'
      ? ($worldsStore.current?.scenario ?? '')
      : ($charactersStore.current?.scenario ?? '')
  );

  const cardPersonality = $derived(
    cardType === 'world'
      ? ''
      : ($charactersStore.current?.personality ?? '')
  );

  const lorebook = $derived(
    cardType === 'world'
      ? ($worldsStore.current?.lorebook ?? [])
      : ($charactersStore.current?.lorebook ?? [])
  );

  const hasCard = $derived(
    cardType === 'world'
      ? !!$worldsStore.current
      : !!$charactersStore.current
  );

  onMount(async () => {
    if (!cardId) return;

    if (cardType === 'world') {
      await worldsRepo.selectWorld(cardId);
    } else {
      await charactersRepo.selectCharacter(cardId);
    }

    const sessionId = $page.url.searchParams.get('session') ?? $chatStore.sessionId;
    if (sessionId) {
      await sceneRepo.loadScene(cardId, sessionId);
    } else {
      await sceneRepo.loadSceneLegacy(cardId);
    }
    const scene = $sceneStore;
    location = scene.location;
    time = scene.time;
    mood = scene.mood;
  });

  async function saveScene() {
    saving = true;
    saveMessage = '';
    try {
      sceneStore.updateScene({ location, time, mood });
      await sceneRepo.save();
      saveMessage = 'Saved';
      setTimeout(() => { saveMessage = ''; }, 2000);
    } catch {
      saveMessage = 'Failed to save';
    } finally {
      saving = false;
    }
  }

  function deleteVariable(key: string) {
    const current = { ...$sceneStore.variables };
    delete current[key];
    sceneStore.updateScene({ variables: current });
    sceneRepo.save();
  }
</script>

<div class="flex-1 flex flex-col overflow-y-auto bg-base">
  <div class="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 border-b border-surface0 bg-mantle">
    <a
      href="/chat/{cardId}{cardType === 'world' ? '?cardType=world' : ''}"
      class="px-3 py-1.5 rounded text-sm text-subtext0 hover:text-text hover:bg-surface0 transition-colors"
    >
      &larr; Back
    </a>
    <h1 class="text-sm font-semibold text-text">Chat Info</h1>
    {#if cardType === 'world'}
      <span class="text-[10px] px-1.5 py-0.5 rounded bg-lavender/20 text-lavender font-medium">World</span>
    {/if}
  </div>

  <div class="flex-1 p-4 max-w-2xl mx-auto w-full flex flex-col gap-4">
    {#if hasCard}
      <section class="rounded-lg border border-surface0 overflow-hidden">
        <button
          type="button"
          onclick={() => { infoExpanded = !infoExpanded; }}
          class="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-surface0/50 transition-colors"
        >
          <span
            class="text-xs text-overlay0 transition-transform"
            class:rotate-90={infoExpanded}
          >
            &#9654;
          </span>
          <h2 class="text-sm font-semibold text-text flex-1">{cardType === 'world' ? 'World' : 'Character'} Info</h2>
          <span class="text-xs text-overlay0">{cardName}</span>
        </button>

        {#if infoExpanded}
          <div class="px-4 pb-4 border-t border-surface0 flex flex-col gap-3">
            <div>
              <span class="block text-xs font-medium text-subtext0 mb-1">Name</span>
              <p class="text-sm text-text">{cardName}</p>
            </div>
            <div>
              <span class="block text-xs font-medium text-subtext0 mb-1">Description</span>
              <p class="text-sm text-text whitespace-pre-wrap">{cardDescription || 'No description'}</p>
            </div>
            {#if cardType === 'character'}
              <div>
                <span class="block text-xs font-medium text-subtext0 mb-1">Personality</span>
                <p class="text-sm text-text whitespace-pre-wrap">{cardPersonality || 'No personality set'}</p>
              </div>
            {/if}
            <div>
              <span class="block text-xs font-medium text-subtext0 mb-1">Scenario</span>
              <p class="text-sm text-text whitespace-pre-wrap">{cardScenario || 'No scenario set'}</p>
            </div>
          </div>
        {/if}
      </section>

      <!-- Scene Editor -->
      <section class="rounded-lg border border-surface0 p-4 flex flex-col gap-3">
        <h2 class="text-sm font-semibold text-text">Scene Editor</h2>

        <div>
          <label for="scene-location" class="block text-xs font-medium text-subtext0 mb-1">Location</label>
          <input
            id="scene-location"
            type="text"
            bind:value={location}
            placeholder="e.g. Forest clearing"
            class="w-full px-3 py-2 rounded bg-crust border border-surface0 text-sm text-text placeholder:text-overlay0 focus:outline-none focus:border-mauve transition-colors"
          />
        </div>

        <div>
          <label for="scene-time" class="block text-xs font-medium text-subtext0 mb-1">Time</label>
          <input
            id="scene-time"
            type="text"
            bind:value={time}
            placeholder="e.g. Midnight"
            class="w-full px-3 py-2 rounded bg-crust border border-surface0 text-sm text-text placeholder:text-overlay0 focus:outline-none focus:border-mauve transition-colors"
          />
        </div>

        <div>
          <label for="scene-mood" class="block text-xs font-medium text-subtext0 mb-1">Mood</label>
          <input
            id="scene-mood"
            type="text"
            bind:value={mood}
            placeholder="e.g. Tense"
            class="w-full px-3 py-2 rounded bg-crust border border-surface0 text-sm text-text placeholder:text-overlay0 focus:outline-none focus:border-mauve transition-colors"
          />
        </div>

        <div class="flex items-center gap-2 mt-1">
          <button
            type="button"
            onclick={saveScene}
            disabled={saving}
            class="px-4 py-2 rounded text-sm font-medium bg-mauve text-crust hover:bg-lavender transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Scene'}
          </button>
          {#if saveMessage}
            <span class="text-xs text-green">{saveMessage}</span>
          {/if}
        </div>
      </section>

      <!-- Variables -->
      <section class="rounded-lg border border-surface0 p-4">
        <VariableViewer
          variables={$sceneStore.variables}
          ondelete={deleteVariable}
        />
      </section>

      <!-- Lorebook -->
      <section class="rounded-lg border border-surface0 p-4">
        <h2 class="text-sm font-semibold text-text mb-2">Lorebook</h2>
        {#if lorebook.length > 0}
          <div class="flex flex-col gap-1">
            {#each lorebook as entry (entry.id)}
              <div class="flex items-center gap-2 px-3 py-2 rounded border border-surface0 bg-crust">
                <span class="text-sm text-text flex-1 truncate">{entry.name || 'Untitled'}</span>
                {#if !entry.enabled}
                  <span class="text-xs px-1.5 py-0.5 rounded bg-surface1 text-overlay0">Disabled</span>
                {/if}
                {#if entry.constant}
                  <span class="text-xs px-1.5 py-0.5 rounded bg-blue/20 text-blue">Constant</span>
                {/if}
                <span class="text-xs text-overlay0">P:{entry.priority}</span>
              </div>
            {/each}
          </div>
        {:else}
          <p class="text-xs text-overlay0 text-center py-2">No lorebook entries.</p>
        {/if}
      </section>
    {:else}
      <div class="flex-1 flex items-center justify-center text-subtext0">
        Loading...
      </div>
    {/if}
  </div>
</div>
