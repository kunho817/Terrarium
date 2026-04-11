<script lang="ts">
  import { onMount } from 'svelte';
  import { charactersStore } from '$lib/stores/characters';
  import * as chatStorage from '$lib/storage/chats';
  import type { ChatSession } from '$lib/types';

  interface RecentSession extends ChatSession {
    characterName: string;
  }

  let recentSessions: RecentSession[] = $state([]);

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
    const characterIds = await chatStorage.listChats();
    if (characterIds.length === 0) return;

    // Build a name lookup from the characters store
    const nameMap = new Map<string, string>();
    for (const c of $charactersStore.list) {
      nameMap.set(c.id, c.name);
    }

    const all: RecentSession[] = [];
    for (const cid of characterIds) {
      const sessions = await chatStorage.listSessions(cid);
      if (sessions.length === 0) continue;

      // Pick the most recent session for this character
      const latest = sessions.reduce((a, b) =>
        a.lastMessageAt > b.lastMessageAt ? a : b,
      );

      all.push({
        ...latest,
        characterName: nameMap.get(cid) ?? cid,
      });
    }

    // Sort by lastMessageAt descending
    all.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
    recentSessions = all;
  }

  onMount(async () => {
    await charactersStore.loadList();
    await loadRecentSessions();
  });
</script>

<div class="flex-1 flex flex-col overflow-hidden">
  <div class="flex items-center justify-between p-4 border-b border-surface0">
    <h1 class="text-lg font-semibold text-text">Chats</h1>
    <a
      href="/characters"
      class="px-3 py-1.5 bg-mauve text-crust rounded-md text-sm font-medium
             hover:bg-lavender transition-colors"
    >
      + New Chat
    </a>
  </div>

  <div class="flex-1 overflow-y-auto p-4">
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
      <!-- Recent Chats -->
      {#if recentSessions.length > 0}
        <div class="mb-4">
          <h2 class="text-sm font-medium text-subtext0 mb-2 px-1">Recent Chats</h2>
          <div class="grid gap-2">
            {#each recentSessions as session}
              <a
                href="/chat/{session.characterId}?session={session.id}"
                class="block p-3 rounded-lg bg-surface0 hover:bg-surface1
                       transition-colors border border-surface1"
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="text-text font-medium text-sm">{session.characterName}</span>
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

      <!-- Character Grid -->
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
  </div>
</div>
