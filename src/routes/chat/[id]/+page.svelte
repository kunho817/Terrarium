<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { chatStore } from '$lib/stores/chat';
  import { charactersStore } from '$lib/stores/characters';
  import { sceneStore } from '$lib/stores/scene';
  import { settingsStore } from '$lib/stores/settings';
  import { sendMessage, initChat } from '$lib/core/chat/use-chat';
  import * as chatStorage from '$lib/storage/chats';
  import type { ChatSession } from '$lib/types';
  import TopBar from '$lib/components/TopBar.svelte';
  import SceneInfoBar from '$lib/components/SceneInfoBar.svelte';
  import MessageList from '$lib/components/MessageList.svelte';
  import InputArea from '$lib/components/InputArea.svelte';

  let sending = $state(false);
  let error = $state('');
  let sessions = $state<ChatSession[]>([]);
  let showSessionMenu = $state(false);

  let currentSessionId = $derived($chatStore.sessionId);
  let currentSession = $derived(sessions.find((s) => s.id === currentSessionId));

  onMount(async () => {
    const characterId = $page.params.id!;
    try {
      await charactersStore.selectCharacter(characterId);
      sessions = await chatStorage.listSessions(characterId);

      const querySession = $page.url.searchParams.get('session');
      if (querySession && sessions.some((s) => s.id === querySession)) {
        await initChat(characterId, querySession);
      } else {
        await initChat(characterId);
        // Sync URL with resolved session
        const resolved = $chatStore.sessionId;
        if (resolved && resolved !== querySession) {
          goto(`/chat/${characterId}?session=${resolved}`, { replaceState: true });
        }
      }
    } catch {
      error = 'Failed to load character';
    }
  });

  async function handleSend(text: string, type: import('$lib/types').MessageType) {
    sending = true;
    error = '';
    try {
      await sendMessage(text, type);
    } catch (e: any) {
      error = e?.message || 'Failed to send message';
    } finally {
      sending = false;
    }
  }

  async function switchSession(newSessionId: string) {
    if (newSessionId === currentSessionId) return;
    const characterId = $page.params.id!;
    showSessionMenu = false;

    // Save current state
    await chatStore.save();
    await sceneStore.save();

    // Load new session
    await chatStore.loadSession(characterId, newSessionId);
    await sceneStore.loadScene(characterId, newSessionId);

    // Update URL
    goto(`/chat/${characterId}?session=${newSessionId}`, { replaceState: true });
  }

  async function createNewSession() {
    const characterId = $page.params.id!;
    showSessionMenu = false;

    // Save current state
    await chatStore.save();
    await sceneStore.save();

    // Create and switch to new session
    const session = await chatStorage.createSession(characterId);
    await chatStore.loadSession(characterId, session.id);
    await sceneStore.loadScene(characterId, session.id);
    sessions = await chatStorage.listSessions(characterId);

    // Update URL
    goto(`/chat/${characterId}?session=${session.id}`, { replaceState: true });
  }

  function toggleSessionMenu() {
    showSessionMenu = !showSessionMenu;
  }

  function closeSessionMenu() {
    showSessionMenu = false;
  }
</script>

<svelte:window onclick={closeSessionMenu} />

{#if error}
  <div class="flex-1 flex items-center justify-center">
    <div class="text-center">
      <p class="text-red text-lg mb-2">{error}</p>
      <a href="/" class="text-mauve hover:text-lavender text-sm">Go back</a>
    </div>
  </div>
{:else if $charactersStore.current}
  <div class="flex-1 flex flex-col overflow-hidden">
    <TopBar
      characterName={$charactersStore.current.name}
      modelName={($settingsStore.providers[$settingsStore.defaultProvider] as any)?.model || ''}
      characterId={$page.params.id}
    />
    <!-- Session bar -->
    <div class="flex items-center justify-between px-4 py-1 border-b border-surface0 bg-crust relative">
      <div class="flex items-center gap-2 min-w-0">
        <span class="text-xs text-subtext0 shrink-0">Session:</span>
        <button
          onclick={(e) => { e.stopPropagation(); toggleSessionMenu(); }}
          class="text-xs text-text hover:text-lavender truncate max-w-[200px] cursor-pointer bg-transparent border-none p-0"
        >
          {currentSession?.name ?? 'Chat'}
        </button>
      </div>

      <!-- Dropdown -->
      {#if showSessionMenu}
        <div
          onclick={(e) => e.stopPropagation()}
          class="absolute top-full left-0 mt-0 ml-4 w-56 bg-surface0 border border-surface1 rounded shadow-lg z-50 max-h-64 overflow-y-auto"
          role="menu"
        >
          {#each sessions as session}
            <button
              onclick={(e) => { e.stopPropagation(); switchSession(session.id); }}
              class="w-full text-left px-3 py-1.5 text-xs hover:bg-surface1 transition-colors {session.id === currentSessionId ? 'text-lavender bg-surface2' : 'text-text'}"
              role="menuitem"
            >
              <div class="truncate font-medium">{session.name}</div>
              {#if session.preview}
                <div class="text-subtext0 truncate text-[10px] mt-0.5">{session.preview}</div>
              {/if}
            </button>
          {/each}
          <div class="border-t border-surface1">
            <button
              onclick={(e) => { e.stopPropagation(); createNewSession(); }}
              class="w-full text-left px-3 py-1.5 text-xs text-green hover:bg-surface1 transition-colors"
              role="menuitem"
            >
              + New Session
            </button>
          </div>
        </div>
      {/if}

      <button
        onclick={createNewSession}
        class="text-xs text-green hover:text-lavender transition-colors shrink-0 cursor-pointer bg-transparent border-none p-0"
        title="New session"
      >
        + New
      </button>
    </div>

    <SceneInfoBar
      location={$sceneStore.location}
      time={$sceneStore.time}
      mood={$sceneStore.mood}
    />
    <MessageList
      messages={$chatStore.messages}
      streamingMessage={$chatStore.streamingMessage}
    />
    <InputArea onSend={handleSend} disabled={sending || $chatStore.isStreaming} />
  </div>
{:else}
  <div class="flex-1 flex items-center justify-center text-subtext0">
    Loading...
  </div>
{/if}
