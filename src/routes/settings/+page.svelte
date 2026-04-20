<script lang="ts">
  import { onMount } from 'svelte';
  import { settingsStore } from '$lib/stores/settings';
  import { settingsRepo } from '$lib/repositories/settings-repo';
  import { getRegistry } from '$lib/core/bootstrap';

  let loaded = $state(false);

  onMount(async () => {
    await settingsRepo.load();
    loaded = true;
  });

  async function handleSave() {
    await settingsRepo.save();
  }
</script>

{#if !loaded}
  <div class="flex-1 flex items-center justify-center text-subtext0">Loading...</div>
{:else}
  <div class="flex-1 overflow-y-auto">
    <div class="max-w-2xl mx-auto p-6 space-y-8">
      <h1 class="text-lg font-semibold text-text">Settings</h1>

      <!-- ═══ AI & Language ═══ -->
      <div>
        <h2 class="text-xs font-semibold uppercase tracking-wider text-subtext0 mb-3">AI &amp; Language</h2>
        <div class="space-y-2">

          <!-- Default Provider -->
          <a href="/settings/providers" class="flex items-center gap-3 p-3 rounded-lg bg-surface0/50 hover:bg-surface0 border border-surface1 transition-colors">
            <span class="text-lg w-8 text-center shrink-0">🤖</span>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-text">AI Providers</div>
              <div class="text-xs text-subtext0 truncate">Default: {$settingsStore.defaultProvider || 'None selected'}</div>
            </div>
            <span class="text-subtext0 text-sm">&rarr;</span>
          </a>

          <!-- Model Slots -->
          <a href="/settings/models" class="flex items-center gap-3 p-3 rounded-lg bg-surface0/50 hover:bg-surface0 border border-surface1 transition-colors">
            <span class="text-lg w-8 text-center shrink-0">🧮</span>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-text">Model Slots</div>
              <div class="text-xs text-subtext0 truncate">Dedicated models for memory &amp; illustration</div>
            </div>
            <span class="text-subtext0 text-sm">&rarr;</span>
          </a>

          <!-- Output Language -->
          <div class="flex items-center gap-3 p-3 rounded-lg bg-surface0/50 border border-surface1">
            <span class="text-lg w-8 text-center shrink-0">🌐</span>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-text">Output Language</div>
            </div>
            <select
              value={$settingsStore.outputLanguage || ''}
              onchange={(e) => { settingsStore.update({ outputLanguage: (e.target as HTMLSelectElement).value }); handleSave(); }}
              class="bg-surface1 text-text text-xs rounded px-2 py-1 border border-surface2 focus:outline-none focus:border-mauve max-w-[160px]"
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
      </div>

      <!-- ═══ Agents & Memory ═══ -->
      <div>
        <h2 class="text-xs font-semibold uppercase tracking-wider text-subtext0 mb-3">Agents &amp; Memory</h2>
        <div class="space-y-2">

          <!-- Agent Settings -->
          <a href="/settings/agents" class="flex items-center gap-3 p-3 rounded-lg bg-surface0/50 hover:bg-surface0 border border-surface1 transition-colors">
            <span class="text-lg w-8 text-center shrink-0">🎭</span>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-text">Agent Settings</div>
              <div class="text-xs text-subtext0 truncate">Director, Scene State, Character State</div>
            </div>
            <span class="text-subtext0 text-sm">&rarr;</span>
          </a>

          <!-- Memory System -->
          <a href="/settings/memory" class="flex items-center gap-3 p-3 rounded-lg bg-surface0/50 hover:bg-surface0 border border-surface1 transition-colors">
            <span class="text-lg w-8 text-center shrink-0">🧠</span>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-text">Memory System</div>
              <div class="text-xs text-subtext0 truncate">Embedding, extraction, token budgets</div>
            </div>
            <span class="text-subtext0 text-sm">&rarr;</span>
          </a>

          <!-- Prompt Builder -->
          <a href="/settings/prompt-builder" class="flex items-center gap-3 p-3 rounded-lg bg-surface0/50 hover:bg-surface0 border border-surface1 transition-colors">
            <span class="text-lg w-8 text-center shrink-0">📝</span>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-text">Prompt Builder</div>
              <div class="text-xs text-subtext0 truncate">Assembly order, templates, presets</div>
            </div>
            <span class="text-subtext0 text-sm">&rarr;</span>
          </a>
        </div>
      </div>

      <!-- ═══ Persona & Appearance ═══ -->
      <div>
        <h2 class="text-xs font-semibold uppercase tracking-wider text-subtext0 mb-3">Persona &amp; Appearance</h2>
        <div class="space-y-2">

          <!-- User Personas -->
          <a href="/settings/personas" class="flex items-center gap-3 p-3 rounded-lg bg-surface0/50 hover:bg-surface0 border border-surface1 transition-colors">
            <span class="text-lg w-8 text-center shrink-0">👤</span>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-text">User Personas</div>
              <div class="text-xs text-subtext0 truncate">Roleplay identity profiles</div>
            </div>
            <span class="text-subtext0 text-sm">&rarr;</span>
          </a>

          <!-- Image Generation -->
          <a href="/settings/image-generation" class="flex items-center gap-3 p-3 rounded-lg bg-surface0/50 hover:bg-surface0 border border-surface1 transition-colors">
            <span class="text-lg w-8 text-center shrink-0">🎨</span>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-text">Image Generation</div>
              <div class="text-xs text-subtext0 truncate">Providers, art styles, auto-generation</div>
            </div>
            <span class="text-subtext0 text-sm">&rarr;</span>
          </a>

          <!-- Theme -->
          <div class="flex items-center gap-3 p-3 rounded-lg bg-surface0/50 border border-surface1">
            <span class="text-lg w-8 text-center shrink-0">🌙</span>
            <div class="flex-1 min-w-0">
              <a href="/settings/theme-editor" class="text-sm font-medium text-text hover:text-lavender">Theme</a>
              <div class="text-xs text-subtext0">Customize appearance &amp; message styling</div>
            </div>
            <select
              value={$settingsStore.theme}
              onchange={(e) => { settingsStore.update({ theme: (e.target as HTMLSelectElement).value }); handleSave(); }}
              class="bg-surface1 text-text text-xs rounded px-2 py-1 border border-surface2 focus:outline-none focus:border-mauve max-w-[160px]"
            >
              <option value="default">Catppuccin Mocha</option>
            </select>
          </div>
        </div>
      </div>

      <!-- ═══ Advanced ═══ -->
      <div>
        <h2 class="text-xs font-semibold uppercase tracking-wider text-subtext0 mb-3">Advanced</h2>
        <div class="space-y-2">
          <div class="flex items-center gap-3 p-3 rounded-lg bg-surface0/50 border border-surface1">
            <span class="text-lg w-8 text-center shrink-0">⚙️</span>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-text">Developer Mode</div>
              <div class="text-xs text-subtext0">Advanced features and debug information</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={$settingsStore.developerMode ?? false}
              onclick={() => { settingsStore.update({ developerMode: !($settingsStore.developerMode ?? false) }); handleSave(); }}
              class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent
                     transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-mauve focus:ring-offset-2 focus:ring-offset-base
                     {($settingsStore.developerMode ?? false) ? 'bg-mauve' : 'bg-surface1'}"
            >
              <span
                class="pointer-events-none inline-block h-5 w-5 rounded-full bg-text shadow ring-0
                       transition-transform duration-200 ease-in-out
                       {($settingsStore.developerMode ?? false) ? 'translate-x-5' : 'translate-x-0'}"
              ></span>
            </button>
          </div>
        </div>
      </div>

    </div>
  </div>
{/if}
