<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { chatStore } from '$lib/stores/chat';
  import { charactersStore } from '$lib/stores/characters';
  import { sceneStore } from '$lib/stores/scene';
  import { settingsStore } from '$lib/stores/settings';
  import { sendMessage } from '$lib/core/chat/use-chat';
  import TopBar from '$lib/components/TopBar.svelte';
  import SceneInfoBar from '$lib/components/SceneInfoBar.svelte';
  import MessageList from '$lib/components/MessageList.svelte';
  import InputArea from '$lib/components/InputArea.svelte';

  let sending = $state(false);
  let error = $state('');

  onMount(async () => {
    const characterId = $page.params.id;
    try {
      await charactersStore.selectCharacter(characterId);
      await chatStore.loadChat(characterId);
      await sceneStore.loadScene(characterId);
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
</script>

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
    />
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
