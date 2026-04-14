<script lang="ts">
  import { onMount } from 'svelte';
  import { charactersStore } from '$lib/stores/characters';
  import { worldsStore } from '$lib/stores/worlds';
  import * as chatStorage from '$lib/storage/chats';
  import type { ChatSession } from '$lib/types';

  interface RecentSession extends ChatSession {
    cardName: string;
  }

  let recentSessions: RecentSession[] = $state([]);
  let activeTab: 'characters' | 'worlds' = $state('characters');

  function relativeTime(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  }

  async function loadRecentSessions(): Promise<void> {
    const chatIds = await chatStorage.listChats();
    if (chatIds.length === 0) return;

    const charNames = new Map<string, string>();
    for (const c of $charactersStore.list) charNames.set(c.id, c.name);
    for (const w of $worldsStore.list) charNames.set(w.id, w.name);

    const all: RecentSession[] = [];
    for (const cid of chatIds) {
      const sessions = await chatStorage.listSessions(cid);
      if (sessions.length === 0) continue;

      const latest = sessions.reduce((a, b) =>
        a.lastMessageAt > b.lastMessageAt ? a : b,
      );

      all.push({
        ...latest,
        cardName: charNames.get(cid) ?? cid,
      });
    }

    all.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
    recentSessions = all;
  }

  onMount(async () => {
    await charactersStore.loadList();
    await worldsStore.loadList();
    await loadRecentSessions();
  });
</script>

<div class="flex-1 flex flex-col overflow-hidden">
  <div class="flex items-center justify-between p-4 border-b border-surface0">
    <div class="flex gap-1">
      <button
        onclick={() => activeTab = 'characters'}
        class="px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer border-none
               {activeTab === 'characters' ? 'bg-surface1 text-text' : 'bg-transparent text-subtext0 hover:text-text'}"
      >
        Characters
      </button>
      <button
        onclick={() => activeTab = 'worlds'}
        class="px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer border-none
               {activeTab === 'worlds' ? 'bg-surface1 text-text' : 'bg-transparent text-subtext0 hover:text-text'}"
      >
        Worlds
      </button>
    </div>
    {#if activeTab === 'characters'}
      <a
        href="/characters"
        class="px-3 py-1.5 bg-mauve text-crust rounded-md text-sm font-medium
               hover:bg-lavender transition-colors"
      >
        + New Chat
      </a>
    {:else}
      <a
        href="/worlds"
        class="px-3 py-1.5 bg-mauve text-crust rounded-md text-sm font-medium
               hover:bg-lavender transition-colors"
      >
        + New World
      </a>
    {/if}
  </div>

  <div class="flex-1 overflow-y-auto p-4">
    {#if activeTab === 'characters'}
      {#if $charactersStore.isLoading}
        <div class="text-center text-subtext0 py-8">Loading...</div>
      {:else if $charactersStore.list.length === 0}
        <div class="text-center text-subtext0 py-8">
          <p class="text-lg mb-2">No characters yet</p>
          <p class="text-sm">Import a character card to get started</p>
          <a
            href="/characters"
            class="inline-block mt-4 px-4 py-2 bg-surface1 text-text rounded-md
                   hover:bg-surface2 transition-colors"
          >
            Go to Characters
          </a>
        </div>
      {:else}
        {#if recentSessions.length > 0}
          <div class="mb-4">
            <h2 class="text-sm font-medium text-subtext0 mb-2 px-1">Recent Chats</h2>
            <div class="grid gap-2">
              {#each recentSessions as session}
                <a
                  href="/chat/{session.characterId}?session={session.id}{session.cardType === 'world' ? '&cardType=world' : ''}"
                  class="block p-3 rounded-lg bg-surface0 hover:bg-surface1
                         transition-colors border border-surface1"
                >
                  <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2">
                      <span class="text-text font-medium text-sm">{session.cardName}</span>
                      {#if session.cardType === 'world'}
                        <span class="text-[10px] px-1.5 py-0.5 rounded bg-lavender/20 text-lavender font-medium">World</span>
                      {/if}
                    </div>
                    <span class="text-subtext1 text-xs shrink-0">{relativeTime(session.lastMessageAt)}</span>
                  </div>
                  <div class="flex items-center gap-2 mt-0.5">
                    <span class="text-subtext0 text-xs">{session.name}</span>
                  </div>
                  {#if session.preview}
                    <p class="text-subtext1 text-xs mt-1 truncate">{session.preview}</p>
                  {/if}
                </a>
              {/each}
            </div>
          </div>
        {/if}

        <div class="mb-4">
          {#if recentSessions.length > 0}
            <h2 class="text-sm font-medium text-subtext0 mb-2 px-1">Characters</h2>
          {/if}
          <div class="grid gap-3">
            {#each $charactersStore.list as character}
              <a
                href="/chat/{character.id}"
                class="block p-3 rounded-lg bg-surface0 hover:bg-surface1
                       transition-colors border border-surface1"
              >
                <span class="text-text font-medium">{character.name}</span>
              </a>
            {/each}
          </div>
        </div>
      {/if}
    {:else}
      {#if $worldsStore.isLoading}
        <div class="text-center text-subtext0 py-8">Loading...</div>
      {:else if $worldsStore.list.length === 0}
        <div class="text-center text-subtext0 py-8">
          <p class="text-lg mb-2">No worlds yet</p>
          <p class="text-sm">Create a world card to get started</p>
          <a
            href="/worlds"
            class="inline-block mt-4 px-4 py-2 bg-surface1 text-text rounded-md
                   hover:bg-surface2 transition-colors"
          >
            Go to Worlds
          </a>
        </div>
      {:else}
        <div class="grid gap-3">
          {#each $worldsStore.list as world}
            <a
              href="/chat/{world.id}?cardType=world"
              class="block p-3 rounded-lg bg-surface0 hover:bg-surface1
                     transition-colors border border-surface1"
            >
              <div class="flex items-center gap-2">
                <span class="text-text font-medium">{world.name}</span>
                <span class="text-[10px] px-1.5 py-0.5 rounded bg-lavender/20 text-lavender font-medium">World</span>
              </div>
            </a>
          {/each}
        </div>
      {/if}
    {/if}
  </div>
</div>
