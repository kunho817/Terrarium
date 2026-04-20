<script lang="ts">
  import { onMount } from 'svelte';
  import { settingsStore } from '$lib/stores/settings';
  import { settingsRepo } from '$lib/repositories/settings-repo';
  import { listPersonas, loadPersona, createPersona, savePersona, deletePersona } from '$lib/storage/personas';
  import type { UserPersona } from '$lib/types/persona';

  let loaded = $state(false);
  let personas = $state<{ id: string; name: string }[]>([]);
  let showEditor = $state(false);
  let editingId: string | null = $state(null);

  // Editor fields
  let editorName = $state('');
  let editorShortDesc = $state('');
  let editorDetailed = $state('');
  let editorDialogue = $state('');

  async function refreshList() {
    personas = await listPersonas();
  }

  async function handleNew() {
    editingId = null;
    editorName = '';
    editorShortDesc = '';
    editorDetailed = '';
    editorDialogue = '';
    showEditor = true;
  }

  async function handleEdit(id: string) {
    const persona = await loadPersona(id);
    editingId = id;
    editorName = persona.name;
    editorShortDesc = persona.shortDescription;
    editorDetailed = persona.detailedSettings;
    editorDialogue = persona.exampleDialogue;
    showEditor = true;
  }

  async function handleSave() {
    if (!editorName.trim()) return;
    const data: UserPersona = {
      name: editorName,
      shortDescription: editorShortDesc,
      detailedSettings: editorDetailed,
      exampleDialogue: editorDialogue,
    };
    if (editingId) {
      await savePersona(editingId, data);
    } else {
      await createPersona(data);
    }
    showEditor = false;
    await refreshList();
  }

  function handleCancel() {
    showEditor = false;
  }

  async function handleDelete(id: string) {
    await deletePersona(id);
    // If this was the default, clear it
    if ($settingsStore.defaultPersonaId === id) {
      settingsStore.update({ defaultPersonaId: undefined });
      await settingsRepo.save();
    }
    await refreshList();
  }

  async function handleSetDefault(id: string) {
    settingsStore.update({ defaultPersonaId: id });
    await settingsRepo.save();
  }

  onMount(async () => {
    await settingsRepo.load();
    await refreshList();
    loaded = true;
  });
</script>

{#if !loaded}
  <div class="flex-1 flex items-center justify-center text-subtext0">Loading...</div>
{:else}
  <div class="flex-1 overflow-y-auto">
    <div class="max-w-2xl mx-auto p-6 space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <a
            href="/settings"
            class="text-sm text-mauve hover:text-lavender transition-colors"
          >
            &larr; Back to Settings
          </a>
          <h1 class="text-lg font-semibold text-text mt-1">User Personas</h1>
        </div>
        <button
          onclick={handleNew}
          class="px-4 py-1.5 rounded-md text-sm font-medium bg-mauve text-crust
                 hover:bg-lavender transition-colors"
        >
          New Persona
        </button>
      </div>

      <!-- Editor -->
      {#if showEditor}
        <section class="space-y-3 bg-surface0 rounded-md border border-surface1 p-4">
          <h2 class="text-sm font-medium text-text">
            {editingId ? 'Edit Persona' : 'New Persona'}
          </h2>

          <div>
            <label for="persona-name" class="block text-xs text-subtext0 mb-1">Name</label>
            <input
              id="persona-name"
              type="text"
              bind:value={editorName}
              placeholder="Persona name"
              class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
                     focus:outline-none focus:border-mauve"
            />
          </div>

          <div>
            <label for="persona-short-desc" class="block text-xs text-subtext0 mb-1">Short Description</label>
            <input
              id="persona-short-desc"
              type="text"
              bind:value={editorShortDesc}
              placeholder="Brief persona description"
              class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
                     focus:outline-none focus:border-mauve"
            />
          </div>

          <div>
            <label for="persona-detailed" class="block text-xs text-subtext0 mb-1">Detailed Settings</label>
            <textarea
              id="persona-detailed"
              bind:value={editorDetailed}
              placeholder="Detailed persona description, traits, background..."
              rows="4"
              class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
                     focus:outline-none focus:border-mauve resize-y"
            ></textarea>
          </div>

          <div>
            <label for="persona-dialogue" class="block text-xs text-subtext0 mb-1">Example Dialogue</label>
            <textarea
              id="persona-dialogue"
              bind:value={editorDialogue}
              placeholder="Example dialogue lines for this persona..."
              rows="4"
              class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
                     focus:outline-none focus:border-mauve resize-y"
            ></textarea>
          </div>

          <div class="flex gap-2 pt-2">
            <button
              onclick={handleSave}
              class="px-4 py-1.5 rounded-md text-sm font-medium bg-mauve text-crust
                     hover:bg-lavender transition-colors"
            >
              Save
            </button>
            <button
              onclick={handleCancel}
              class="px-4 py-1.5 rounded-md text-sm font-medium bg-surface0 text-text
                     hover:bg-surface1 transition-colors border border-surface1"
            >
              Cancel
            </button>
          </div>
        </section>
      {/if}

      <!-- Persona List -->
      <section class="space-y-3">
        {#if personas.length === 0}
          <p class="text-sm text-subtext0">No personas yet. Create one to get started.</p>
        {:else}
          {#each personas as persona (persona.id)}
            {@const isDefault = $settingsStore.defaultPersonaId === persona.id}
            <div class="bg-surface0 rounded-md border border-surface1 p-4 space-y-2">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium text-text">{persona.name}</span>
                  {#if isDefault}
                    <span class="text-xs px-1.5 py-0.5 rounded bg-mauve text-crust font-medium">
                      Default
                    </span>
                  {/if}
                </div>
                <div class="flex gap-2">
                  <button
                    onclick={() => handleEdit(persona.id)}
                    class="px-2 py-1 text-xs rounded bg-surface1 text-subtext1
                           hover:bg-surface2 hover:text-text transition-colors"
                  >
                    Edit
                  </button>
                  {#if !isDefault}
                    <button
                      onclick={() => handleSetDefault(persona.id)}
                      class="px-2 py-1 text-xs rounded bg-surface1 text-subtext1
                             hover:bg-surface2 hover:text-text transition-colors"
                    >
                      Set Default
                    </button>
                  {/if}
                  <button
                    onclick={() => handleDelete(persona.id)}
                    class="px-2 py-1 text-xs rounded bg-surface1 text-red
                           hover:bg-surface2 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          {/each}
        {/if}
      </section>
    </div>
  </div>
{/if}
