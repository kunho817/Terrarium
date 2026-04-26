<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { settingsStore } from '$lib/stores/settings';
  import { settingsRepo } from '$lib/repositories/settings-repo';
  import { chatStore } from '$lib/stores/chat';
  import { resetSessionData } from '$lib/storage/sessions';
  import { getEngine } from '$lib/core/bootstrap';
  import { getResponseLengthTier } from '$lib/types/chat-settings';
  import { showAlertDialog, showConfirmDialog } from '$lib/utils/app-dialog';

  let loaded = $state(false);
  let resetting = $state(false);

  const linkClass =
    'flex items-start justify-between gap-4 rounded-lg border border-surface1 bg-surface0/50 p-4 transition-colors hover:bg-surface0';

  onMount(async () => {
    await settingsRepo.load();
    loaded = true;
  });

  async function handleSave() {
    await settingsRepo.save();
  }

  async function handleResetSessionDB() {
    const state = get(chatStore);
    if (!state.sessionId) {
      await showAlertDialog('No active session. Open a chat first, then return here.');
      return;
    }
    if (!(await showConfirmDialog('Reset all agent data for the current session? This clears memories, summaries, and session agent state. Conversation messages stay intact.'))) {
      return;
    }

    resetting = true;
    try {
      await resetSessionData(state.sessionId as string);
      getEngine().getPipeline().reset();
      await showAlertDialog('Session DB has been reset.');
    } catch (e) {
      await showAlertDialog('Reset failed: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      resetting = false;
    }
  }
</script>

{#if !loaded}
  <div class="flex flex-1 items-center justify-center text-subtext0">Loading...</div>
{:else}
  <div class="flex-1 overflow-y-auto">
    <div class="mx-auto flex max-w-4xl flex-col gap-8 p-6">
      <div class="space-y-1">
        <h1 class="text-lg font-semibold text-text">Settings</h1>
        <p class="text-sm text-subtext0">Core chat controls, agent systems, media, and diagnostics.</p>
      </div>

      <section class="space-y-3">
        <div class="space-y-1">
          <h2 class="text-xs font-semibold uppercase tracking-wider text-subtext0">Conversation &amp; Models</h2>
          <p class="text-sm text-subtext0">Default providers, slot routing, response length, and chat-facing controls.</p>
        </div>

        <div class="grid gap-3 md:grid-cols-2">
          <a href="/settings/providers" class={linkClass}>
            <div class="min-w-0">
              <div class="text-sm font-medium text-text">AI Providers</div>
              <div class="mt-1 text-xs text-subtext0">Default provider: {$settingsStore.defaultProvider || 'None selected'}</div>
            </div>
            <span class="shrink-0 text-xs text-subtext0">Open</span>
          </a>

          <a href="/settings/models" class={linkClass}>
            <div class="min-w-0">
              <div class="text-sm font-medium text-text">Model Cards</div>
              <div class="mt-1 text-xs text-subtext0">Reusable provider+model cards with per-system assignment.</div>
            </div>
            <span class="shrink-0 text-xs text-subtext0">Open</span>
          </a>

          <a href="/settings/chat-controls" class={linkClass}>
            <div class="min-w-0">
              <div class="text-sm font-medium text-text">Chat Controls</div>
              <div class="mt-1 text-xs text-subtext0">
                {getResponseLengthTier($settingsStore.responseLengthTier).label} length, {$settingsStore.imageGeneration?.targetImageCount ?? 2} target image(s)
              </div>
            </div>
            <span class="shrink-0 text-xs text-subtext0">Open</span>
          </a>

          <div class="flex items-center gap-4 rounded-lg border border-surface1 bg-surface0/50 p-4">
            <div class="min-w-0 flex-1">
              <div class="text-sm font-medium text-text">Output Language</div>
              <div class="mt-1 text-xs text-subtext0">Force a language or leave it on auto.</div>
            </div>
            <select
              value={$settingsStore.outputLanguage || ''}
              onchange={(e) => {
                settingsStore.update({ outputLanguage: (e.target as HTMLSelectElement).value });
                handleSave();
              }}
              class="max-w-[180px] rounded border border-surface2 bg-surface1 px-2 py-1 text-xs text-text focus:border-mauve focus:outline-none"
            >
              <option value="">Auto</option>
              <option value="English">English</option>
              <option value="Korean">Korean</option>
              <option value="Japanese">Japanese</option>
              <option value="Chinese (Simplified)">Chinese (Simplified)</option>
              <option value="Chinese (Traditional)">Chinese (Traditional)</option>
              <option value="Spanish">Spanish</option>
              <option value="French">French</option>
              <option value="German">German</option>
              <option value="Portuguese">Portuguese</option>
              <option value="Russian">Russian</option>
              <option value="Italian">Italian</option>
              <option value="Thai">Thai</option>
              <option value="Vietnamese">Vietnamese</option>
              <option value="Indonesian">Indonesian</option>
              <option value="Arabic">Arabic</option>
              <option value="Turkish">Turkish</option>
              <option value="Dutch">Dutch</option>
              <option value="Polish">Polish</option>
            </select>
          </div>
        </div>
      </section>

      <section class="space-y-3">
        <div class="space-y-1">
          <h2 class="text-xs font-semibold uppercase tracking-wider text-subtext0">Agent Systems</h2>
          <p class="text-sm text-subtext0">Pipeline toggles, memory behavior, prompt assembly, and world injection.</p>
        </div>

        <div class="grid gap-3 md:grid-cols-2">
          <a href="/settings/agents" class={linkClass}>
            <div class="min-w-0">
              <div class="text-sm font-medium text-text">Agent Settings</div>
              <div class="mt-1 text-xs text-subtext0">Turn maintenance, extraction, world mode, and pipeline switches.</div>
            </div>
            <span class="shrink-0 text-xs text-subtext0">Open</span>
          </a>

          <a href="/settings/memory" class={linkClass}>
            <div class="min-w-0">
              <div class="text-sm font-medium text-text">Memory System</div>
              <div class="mt-1 text-xs text-subtext0">Embedding, retrieval budgets, summaries, and extraction tuning.</div>
            </div>
            <span class="shrink-0 text-xs text-subtext0">Open</span>
          </a>

          <a href="/settings/prompt-builder" class={linkClass}>
            <div class="min-w-0">
              <div class="text-sm font-medium text-text">Prompt Builder</div>
              <div class="mt-1 text-xs text-subtext0">Prompt assembly order, preset templates, and injection structure.</div>
            </div>
            <span class="shrink-0 text-xs text-subtext0">Open</span>
          </a>
        </div>
      </section>

      <section class="space-y-3">
        <div class="space-y-1">
          <h2 class="text-xs font-semibold uppercase tracking-wider text-subtext0">Identity &amp; Media</h2>
          <p class="text-sm text-subtext0">Persona, illustration generation, and presentation-level appearance.</p>
        </div>

        <div class="grid gap-3 md:grid-cols-2">
          <a href="/settings/personas" class={linkClass}>
            <div class="min-w-0">
              <div class="text-sm font-medium text-text">User Personas</div>
              <div class="mt-1 text-xs text-subtext0">Profile-specific identity, style, and roleplay assumptions.</div>
            </div>
            <span class="shrink-0 text-xs text-subtext0">Open</span>
          </a>

          <a href="/settings/image-generation" class={linkClass}>
            <div class="min-w-0">
              <div class="text-sm font-medium text-text">Image Generation</div>
              <div class="mt-1 text-xs text-subtext0">Providers, style presets, prompt instructions, and auto-illustration.</div>
            </div>
            <span class="shrink-0 text-xs text-subtext0">Open</span>
          </a>

          <a href="/settings/theme-editor" class={linkClass}>
            <div class="min-w-0">
              <div class="text-sm font-medium text-text">Theme Editor</div>
              <div class="mt-1 text-xs text-subtext0">Colors, message presentation, and overall UI tone.</div>
            </div>
            <span class="shrink-0 text-xs text-subtext0">Open</span>
          </a>

          <div class="flex items-center gap-4 rounded-lg border border-surface1 bg-surface0/50 p-4">
            <div class="min-w-0 flex-1">
              <div class="text-sm font-medium text-text">Theme Preset</div>
              <div class="mt-1 text-xs text-subtext0">Current UI theme selection.</div>
            </div>
            <select
              value={$settingsStore.theme}
              onchange={(e) => {
                settingsStore.update({ theme: (e.target as HTMLSelectElement).value });
                handleSave();
              }}
              class="max-w-[180px] rounded border border-surface2 bg-surface1 px-2 py-1 text-xs text-text focus:border-mauve focus:outline-none"
            >
              <option value="default">Catppuccin Mocha</option>
            </select>
          </div>
        </div>
      </section>

      <section class="space-y-3">
        <div class="space-y-1">
          <h2 class="text-xs font-semibold uppercase tracking-wider text-subtext0">Diagnostics</h2>
          <p class="text-sm text-subtext0">Developer-facing toggles and session repair tools.</p>
        </div>

        <div class="grid gap-3 md:grid-cols-2">
          <div class="flex items-center gap-4 rounded-lg border border-surface1 bg-surface0/50 p-4">
            <div class="min-w-0 flex-1">
              <div class="text-sm font-medium text-text">Developer Mode</div>
              <div class="mt-1 text-xs text-subtext0">Expose debug UI, internal metadata, and advanced repair actions.</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={$settingsStore.developerMode ?? false}
              aria-label="Developer mode"
              onclick={() => {
                settingsStore.update({ developerMode: !($settingsStore.developerMode ?? false) });
                handleSave();
              }}
              class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-mauve focus:ring-offset-2 focus:ring-offset-base {($settingsStore.developerMode ?? false) ? 'bg-mauve' : 'bg-surface1'}"
            >
              <span
                class="pointer-events-none inline-block h-5 w-5 rounded-full bg-text shadow ring-0 transition-transform duration-200 ease-in-out {($settingsStore.developerMode ?? false) ? 'translate-x-5' : 'translate-x-0'}"
              ></span>
            </button>
          </div>

          {#if $settingsStore.developerMode}
            <div class="flex items-center gap-4 rounded-lg border border-red/30 bg-surface0/50 p-4">
              <div class="min-w-0 flex-1">
                <div class="text-sm font-medium text-text">Reset Session DB</div>
                <div class="mt-1 text-xs text-subtext0">Clear memories, summaries, and session agent state for the active session.</div>
              </div>
              <button
                type="button"
                onclick={handleResetSessionDB}
                disabled={resetting || !$chatStore.sessionId}
                class="shrink-0 rounded-lg border border-red/40 bg-red/20 px-3 py-1.5 text-xs font-medium text-red transition-colors hover:bg-red/30 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {resetting ? 'Resetting...' : 'Reset'}
              </button>
            </div>
          {/if}
        </div>
      </section>
    </div>
  </div>
{/if}
