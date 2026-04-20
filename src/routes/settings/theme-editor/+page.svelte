<script lang="ts">
  import { onMount } from 'svelte';
  import { settingsStore } from '$lib/stores/settings';
  import { settingsRepo } from '$lib/repositories/settings-repo';
  import ThemeRenderer from '$lib/components/editors/ThemeRenderer.svelte';
  import type { Message } from '$lib/types';

  const DEFAULT_HTML = `<div class="message {{role}} {{type}}">
  <div class="name">{{name}}</div>
  <div class="content">{{content}}</div>
</div>`;

  const DEFAULT_CSS = `.message { padding: 8px 12px; margin: 4px 0; border-radius: 8px; }
.message.user { background: #313244; }
.message.assistant { background: #1e1e2e; }
.message.narrator { background: #1e1e2e; font-style: italic; }
.name { font-weight: bold; margin-bottom: 2px; color: #cdd6f4; }
.content { white-space: pre-wrap; color: #cdd6f4; }`;

  const sampleMessages: Message[] = [
    {
      role: 'user',
      type: 'dialogue',
      content: 'Hello! Nice to meet you.',
      timestamp: Date.now() - 60000,
    },
    {
      role: 'assistant',
      type: 'action',
      content: '*smiles warmly* Welcome! I\'ve been expecting you.',
      timestamp: Date.now() - 30000,
    },
    {
      role: 'narrator',
      type: 'narrator',
      content: 'The sun sets over the horizon...',
      timestamp: Date.now(),
    },
  ];

  let loaded = $state(false);
  let htmlTemplate = $state(DEFAULT_HTML);
  let cssTemplate = $state(DEFAULT_CSS);
  let saved = $state(false);

  onMount(async () => {
    await settingsRepo.load();
    const themeData = $settingsStore.themeTemplates as
      | { html: string; css: string }
      | undefined;
    if (themeData) {
      htmlTemplate = themeData.html;
      cssTemplate = themeData.css;
    }
    loaded = true;
  });

  function resetToDefault() {
    htmlTemplate = DEFAULT_HTML;
    cssTemplate = DEFAULT_CSS;
  }

  async function saveTheme() {
    settingsStore.update({
      themeTemplates: { html: htmlTemplate, css: cssTemplate },
    } as Record<string, unknown>);
    await settingsRepo.save();
    saved = true;
    setTimeout(() => {
      saved = false;
    }, 2000);
  }
</script>

{#if !loaded}
  <div class="flex-1 flex items-center justify-center text-subtext0">Loading...</div>
{:else}
  <div class="flex-1 overflow-hidden flex h-full">
    <!-- Left column: Editor -->
    <div class="w-1/2 flex flex-col border-r border-surface0 overflow-y-auto">
      <div class="p-4 space-y-4">
        <div class="flex items-center justify-between">
          <h1 class="text-lg font-semibold text-text">Theme Editor</h1>
          <a
            href="/settings"
            class="text-sm text-mauve hover:text-lavender transition-colors"
          >
            Back to Settings
          </a>
        </div>

        <!-- HTML Template -->
        <div class="space-y-1.5">
          <label for="theme-html-template" class="text-sm font-medium text-subtext1">HTML Template</label>
          <p class="text-xs text-overlay0">
            Available variables: {`{{name}}, {{content}}, {{type}}, {{role}}, {{timestamp}}, {{charName}}`}
          </p>
          <textarea
            id="theme-html-template"
            bind:value={htmlTemplate}
            rows="10"
            class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
                   focus:outline-none focus:border-mauve font-mono resize-y"
            spellcheck="false"
          ></textarea>
        </div>

        <!-- CSS Template -->
        <div class="space-y-1.5">
          <label for="theme-css-template" class="text-sm font-medium text-subtext1">CSS Template</label>
          <p class="text-xs text-overlay0">
            Styles apply inside the preview container. Classes: .message, .user, .assistant, .narrator, .name, .content
          </p>
          <textarea
            id="theme-css-template"
            bind:value={cssTemplate}
            rows="10"
            class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
                   focus:outline-none focus:border-mauve font-mono resize-y"
            spellcheck="false"
          ></textarea>
        </div>

        <!-- Action buttons -->
        <div class="flex items-center gap-3">
          <button
            onclick={resetToDefault}
            class="px-4 py-1.5 rounded-md text-sm font-medium bg-surface0 text-subtext1
                   hover:bg-surface1 transition-colors"
          >
            Reset to Default
          </button>
          <button
            onclick={saveTheme}
            class="px-4 py-1.5 rounded-md text-sm font-medium bg-mauve text-crust
                   hover:bg-lavender transition-colors"
          >
            {saved ? 'Saved!' : 'Save Theme'}
          </button>
        </div>
      </div>
    </div>

    <!-- Right column: Preview -->
    <div class="w-1/2 flex flex-col overflow-y-auto">
      <div class="p-4">
        <h2 class="text-sm font-medium text-subtext1 mb-3">Live Preview</h2>
        <div class="bg-crust rounded-lg border border-surface0 p-4">
          <ThemeRenderer
            messages={sampleMessages}
            {htmlTemplate}
            {cssTemplate}
            charName="Character"
          />
        </div>
      </div>
    </div>
  </div>
{/if}
