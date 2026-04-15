<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { chatStore } from '$lib/stores/chat';
  import { chatRepo } from '$lib/repositories/chat-repo';
  import { charactersStore } from '$lib/stores/characters';
  import { charactersRepo } from '$lib/repositories/characters-repo';
  import { worldsStore } from '$lib/stores/worlds';
  import { sceneStore } from '$lib/stores/scene';
  import { settingsStore } from '$lib/stores/settings';
  import { sendMessage, initChat, generateIllustration, injectFirstMessage } from '$lib/core/chat/use-chat';
  import * as chatStorage from '$lib/storage/chats';
  import { listPersonas } from '$lib/storage/personas';
  import type { ChatSession, WorldCard } from '$lib/types';
  import TopBar from '$lib/components/TopBar.svelte';
  import SceneInfoBar from '$lib/components/SceneInfoBar.svelte';
  import MessageList from '$lib/components/MessageList.svelte';
  import InputArea from '$lib/components/InputArea.svelte';
  import SessionPanel from '$lib/components/SessionPanel.svelte';

  let sending = $state(false);
  let error = $state('');
  let cardType: 'character' | 'world' = $state('character');
  let sessions = $state<ChatSession[]>([]);
  let personas = $state<{ id: string; name: string }[]>([]);
  let showSessionPanel = $state(false);

  let currentSessionId = $derived($chatStore.sessionId);
  let currentSession = $derived(sessions.find((s) => s.id === currentSessionId));

  onMount(async () => {
    const characterId = $page.params.id!;
    const type = $page.url.searchParams.get('cardType');
    cardType = type === 'world' ? 'world' : 'character';

    try {
      if (cardType === 'world') {
        charactersStore.clearSelection();
        await worldsStore.selectWorld(characterId);
      } else {
        worldsStore.clearSelection();
        await charactersRepo.selectCharacter(characterId);
      }
      sessions = await chatStorage.listSessions(characterId);
      personas = await listPersonas();

      const querySession = $page.url.searchParams.get('session');
      if (querySession && sessions.some((s) => s.id === querySession)) {
        await initChat(characterId, querySession);
      } else {
        await initChat(characterId);
        const resolved = $chatStore.sessionId;
        if (resolved && resolved !== querySession) {
          const typeParam = cardType === 'world' ? 'cardType=world&' : '';
          goto(`/chat/${characterId}?${typeParam}session=${resolved}`, { replaceState: true });
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

  async function handleGenerateImage() {
    sending = true;
    error = '';
    try {
      await generateIllustration();
    } catch (e: any) {
      error = e?.message || 'Failed to generate image';
    } finally {
      sending = false;
    }
  }

  async function switchSession(newSessionId: string) {
    if (newSessionId === currentSessionId) return;
    const characterId = $page.params.id!;
    showSessionPanel = false;

    await chatRepo.saveMessages();
    await sceneStore.save();

    await chatRepo.loadSession(characterId, newSessionId);
    await sceneStore.loadScene(characterId, newSessionId);
    await injectFirstMessage();

    const typeParam = cardType === 'world' ? 'cardType=world&' : '';
    goto(`/chat/${characterId}?${typeParam}session=${newSessionId}`, { replaceState: true });
  }

  async function createNewSession() {
    const characterId = $page.params.id!;
    showSessionPanel = false;

    await chatRepo.saveMessages();
    await sceneStore.save();

    const sessionId = await chatRepo.createSession(characterId);
    await sceneStore.loadScene(characterId, sessionId);
    await injectFirstMessage();
    sessions = await chatStorage.listSessions(characterId);

    const typeParam = cardType === 'world' ? 'cardType=world&' : '';
    goto(`/chat/${characterId}?${typeParam}session=${sessionId}`, { replaceState: true });
  }

  async function renameSession(sessionId: string, name: string) {
    const characterId = $page.params.id!;
    await chatStorage.updateSession(characterId, sessionId, { name });
    sessions = await chatStorage.listSessions(characterId);
  }

  async function deleteSession(sessionId: string) {
    if (sessions.length <= 1) return;
    const characterId = $page.params.id!;

    await chatStorage.deleteSession(characterId, sessionId);
    sessions = await chatStorage.listSessions(characterId);

    if (sessionId === currentSessionId) {
      const remaining = sessions[0];
      await chatRepo.loadSession(characterId, remaining.id);
      await sceneStore.loadScene(characterId, remaining.id);
      await injectFirstMessage();
      const typeParam = cardType === 'world' ? 'cardType=world&' : '';
      goto(`/chat/${characterId}?${typeParam}session=${remaining.id}`, { replaceState: true });
    }
  }

  async function setSessionPersona(sessionId: string, personaId: string | undefined) {
    const characterId = $page.params.id!;
    await chatStorage.updateSession(characterId, sessionId, { personaId });
    sessions = await chatStorage.listSessions(characterId);
  }
</script>

{#if error}
  <div class="flex-1 flex items-center justify-center">
    <div class="text-center">
      <p class="text-red text-lg mb-2">{error}</p>
      <a href="/" class="text-mauve hover:text-lavender text-sm">Go back</a>
    </div>
  </div>
{:else if (cardType === 'character' && $charactersStore.current) || (cardType === 'world' && $worldsStore.current)}
  <div class="flex-1 flex flex-col overflow-hidden">
    <TopBar
      characterName={cardType === 'world' ? ($worldsStore.current?.name ?? 'World') : ($charactersStore.current?.name ?? '')}
      modelName={($settingsStore.providers[$settingsStore.defaultProvider] as any)?.model || ''}
      characterId={$page.params.id}
      isWorld={cardType === 'world'}
    />

    <!-- Session bar -->
    <div class="flex items-center justify-between px-4 py-1.5 border-b border-surface0 bg-crust">
      <button
        onclick={() => showSessionPanel = true}
        class="flex items-center gap-2 text-sm text-text hover:text-lavender cursor-pointer bg-surface0 hover:bg-surface1 border border-surface1 hover:border-surface2 rounded-md px-3 py-1.5 transition-colors"
      >
        <span class="text-subtext0">Session:</span>
        <span class="truncate max-w-[200px]">{currentSession?.name ?? 'Chat'}</span>
        <span class="text-subtext0 text-xs">▼</span>
      </button>

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
    <MessageList streamingMessage={$chatStore.streamingMessage} />
    <InputArea
      onSend={handleSend}
      onGenerateImage={handleGenerateImage}
      imageProviderAvailable={$settingsStore.imageGeneration?.provider !== 'none' && $settingsStore.imageGeneration?.provider !== undefined}
      disabled={sending || $chatStore.isStreaming}
    />
  </div>

  {#if showSessionPanel}
    <SessionPanel
      {sessions}
      activeSessionId={currentSessionId}
      {personas}
      onselect={switchSession}
      onrename={renameSession}
      ondelete={deleteSession}
      oncreate={createNewSession}
      onclose={() => showSessionPanel = false}
      onsetpersona={setSessionPersona}
    />
  {/if}
{:else}
  <div class="flex-1 flex items-center justify-center text-subtext0">
    Loading...
  </div>
{/if}
