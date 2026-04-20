<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { chatStore } from '$lib/stores/chat';
  import { chatRepo } from '$lib/repositories/chat-repo';
  import { charactersStore } from '$lib/stores/characters';
  import { charactersRepo } from '$lib/repositories/characters-repo';
  import { worldsStore } from '$lib/stores/worlds';
  import { worldsRepo } from '$lib/repositories/worlds-repo';
  import { sceneStore } from '$lib/stores/scene';
  import { sceneRepo } from '$lib/repositories/scene-repo';
  import { settingsStore } from '$lib/stores/settings';
  import { sendMessage, initChat, generateIllustration, injectFirstMessage } from '$lib/core/chat/use-chat';
  import * as chatStorage from '$lib/storage/chats';
  import { listPersonas } from '$lib/storage/personas';
  import { makePersonaId } from '$lib/types/branded';
  import { countMemories } from '$lib/storage/memories';
  import GreetingPicker from '$lib/components/GreetingPicker.svelte';
  import type { ChatSession, WorldCard, AlternateGreeting } from '$lib/types';
  import TopBar from '$lib/components/TopBar.svelte';
  import SceneInfoBar from '$lib/components/SceneInfoBar.svelte';
  import MessageList from '$lib/components/MessageList.svelte';
  import InputArea from '$lib/components/InputArea.svelte';
  import SessionPanel from '$lib/components/SessionPanel.svelte';
  import AgentPipelineIndicator from '$lib/components/AgentPipelineIndicator.svelte';
  import MemoryPanel from '$lib/components/MemoryPanel.svelte';

  let sending = $state(false);
  let error = $state('');
  let cardType: 'character' | 'world' = $state('character');
  let sessions = $state<ChatSession[]>([]);
  let archivedSessions = $state<ChatSession[]>([]);
  let personas = $state<{ id: string; name: string }[]>([]);
  let showSessionPanel = $state(false);
  let showMemoryPanel = $state(false);
  let showGreetingPicker = $state(false);
  let memoryCounts = $state<Map<string, number>>(new Map());

  async function loadMemoryCounts() {
    const counts = new Map<string, number>();
    const all = [...sessions, ...archivedSessions];
    await Promise.all(all.map(async (s) => {
      try { counts.set(s.id, await countMemories(s.id)); } catch { counts.set(s.id, 0); }
    }));
    memoryCounts = counts;
  }

  let currentSessionId = $derived($chatStore.sessionId);
  let currentSession = $derived(sessions.find((s) => s.id === currentSessionId));

  async function loadSessions() {
    const characterId = $page.params.id!;
    sessions = await chatStorage.listSessions(characterId);
  }

  async function loadArchivedSessions() {
    const characterId = $page.params.id!;
    archivedSessions = await chatStorage.listArchivedSessions(characterId);
  }

  onMount(async () => {
    const characterId = $page.params.id!;
    const type = $page.url.searchParams.get('cardType');
    cardType = type === 'world' ? 'world' : 'character';

    try {
      if (cardType === 'world') {
        charactersStore.clearSelection();
        await worldsRepo.selectWorld(characterId);
      } else {
        worldsStore.clearSelection();
        await charactersRepo.selectCharacter(characterId);
      }
      await loadSessions();
      await loadArchivedSessions();
      personas = await listPersonas();

      if (cardType === 'world' && !$page.url.searchParams.get('session')) {
        if ($worldsStore.current?.alternateGreetings?.length) {
          showGreetingPicker = true;
        }
      }

      if (!showGreetingPicker) {
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
        loadMemoryCounts();
      }
    } catch (e) {
      console.error('[ChatPage] Failed to load:', e);
      error = `Failed to load ${cardType}`;
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
    loadMemoryCounts();
  }

  function handleGreetingCancel() {
    showGreetingPicker = false;
  }

  async function switchSession(newSessionId: string) {
    if (newSessionId === currentSessionId) return;
    const characterId = $page.params.id!;
    showSessionPanel = false;

    await chatRepo.saveMessages();
    await sceneRepo.save();

    await chatRepo.loadSession(characterId, newSessionId);
    await sceneRepo.loadScene(characterId, newSessionId);
    await injectFirstMessage();

    const typeParam = cardType === 'world' ? 'cardType=world&' : '';
    goto(`/chat/${characterId}?${typeParam}session=${newSessionId}`, { replaceState: true });
  }

  async function createNewSession(name?: string) {
    const characterId = $page.params.id!;
    showSessionPanel = false;

    await chatRepo.saveMessages();
    await sceneRepo.save();

    const session = await chatStorage.createSession(characterId, name, cardType);
    await chatRepo.loadSession(characterId, session.id);
    await sceneRepo.loadScene(characterId, session.id);
    await injectFirstMessage();
    await loadSessions();

    const typeParam = cardType === 'world' ? 'cardType=world&' : '';
    goto(`/chat/${characterId}?${typeParam}session=${session.id}`, { replaceState: true });
  }

  async function renameSession(sessionId: string, name: string) {
    const characterId = $page.params.id!;
    await chatStorage.updateSession(characterId, sessionId, { name });
    chatRepo.invalidateCache(characterId);
    await loadSessions();
  }

  async function deleteSession(sessionId: string) {
    if (sessions.length <= 1) return;
    const characterId = $page.params.id!;

    await chatStorage.deleteSession(characterId, sessionId);
    await loadSessions();

    if (sessionId === currentSessionId) {
      const remaining = sessions[0];
      await chatRepo.loadSession(characterId, remaining.id);
      await sceneRepo.loadScene(characterId, remaining.id);
      await injectFirstMessage();
      const typeParam = cardType === 'world' ? 'cardType=world&' : '';
      goto(`/chat/${characterId}?${typeParam}session=${remaining.id}`, { replaceState: true });
    }
  }

  async function archiveSessionFn(sessionId: string) {
    if (sessions.length <= 1) return;
    const characterId = $page.params.id!;
    await chatRepo.archiveSession(characterId, sessionId);
    await loadSessions();
    await loadArchivedSessions();
    if (sessionId === currentSessionId) {
      const remaining = sessions.filter(s => s.id !== sessionId);
      if (remaining.length > 0) {
        await switchSession(remaining[0].id);
      }
    }
  }

  async function restoreSessionFn(sessionId: string) {
    const characterId = $page.params.id!;
    await chatRepo.restoreSession(characterId, sessionId);
    await loadSessions();
    await loadArchivedSessions();
  }

  async function permanentDeleteSessionFn(sessionId: string) {
    if (!confirm('Permanently delete this session? This cannot be undone.')) return;
    const characterId = $page.params.id!;
    await chatRepo.permanentDeleteSession(characterId, sessionId);
    await loadArchivedSessions();
  }

  async function pinSession(sessionId: string, pinned: boolean) {
    const characterId = $page.params.id!;
    await chatStorage.updateSession(characterId, sessionId, { pinnedAt: pinned ? Date.now() : undefined });
    chatRepo.invalidateCache(characterId);
    await loadSessions();
  }

  async function exportSessionById(sessionId: string) {
    const characterId = $page.params.id!;
    const cardName = cardType === 'world'
      ? ($worldsStore.current?.name ?? 'Unknown')
      : ($charactersStore.current?.name ?? 'Unknown');
    const exportData = await chatStorage.buildSessionExport(characterId, sessionId, cardName, cardType);
    const json = chatStorage.serializeExport(exportData);
    const { save } = await import('@tauri-apps/plugin-dialog');
    const path = await save({
      defaultPath: `${cardName} - ${sessionId}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (path) {
      const { writeTextFile } = await import('@tauri-apps/plugin-fs');
      await writeTextFile(path, json);
    }
  }

  async function setSessionPersona(sessionId: string, personaId: string | undefined) {
    const characterId = $page.params.id!;
    await chatStorage.updateSession(characterId, sessionId, { personaId: personaId ? makePersonaId(personaId) : undefined });
    chatRepo.invalidateCache(characterId);
    await loadSessions();
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
        onclick={() => createNewSession()}
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
      onopenmemory={() => showMemoryPanel = true}
    />
    <MessageList streamingMessage={$chatStore.streamingMessage} />
    <AgentPipelineIndicator />
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
      {archivedSessions}
      activeSessionId={currentSessionId}
      {personas}
      onselect={switchSession}
      onrename={renameSession}
      ondelete={deleteSession}
      oncreate={createNewSession}
      onclose={() => showSessionPanel = false}
      onsetpersona={setSessionPersona}
      onpin={pinSession}
      onexport={exportSessionById}
      onarchive={archiveSessionFn}
      onrestore={restoreSessionFn}
      onpermanentlyDelete={permanentDeleteSessionFn}
      {memoryCounts}
    />
  {/if}
  {#if showMemoryPanel}
    <MemoryPanel
      sessionId={currentSessionId ?? ''}
      onclose={() => showMemoryPanel = false}
    />
  {/if}
  {#if showGreetingPicker && $worldsStore.current?.alternateGreetings?.length}
    <GreetingPicker
      greetings={$worldsStore.current.alternateGreetings}
      onselect={handleGreetingSelect}
      oncancel={handleGreetingCancel}
    />
  {/if}
{:else}
  <div class="flex-1 flex items-center justify-center text-subtext0">
    Loading...
  </div>
{/if}
