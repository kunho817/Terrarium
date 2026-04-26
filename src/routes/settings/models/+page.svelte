<script lang="ts">
  import { onMount } from 'svelte';
  import { settingsStore } from '$lib/stores/settings';
  import { settingsRepo } from '$lib/repositories/settings-repo';
  import { getRegistry } from '$lib/core/bootstrap';
  import {
    MODEL_SLOT_DEFINITIONS,
    type ModelProfile,
    type ModelSlot,
  } from '$lib/types/config';
  import { DEFAULT_EXTRACTION_PROMPT, DEFAULT_SUMMARY_PROMPT } from '$lib/types/memory';

  let loaded = $state(false);
  let selectedProfileId = $state('');
  let profiles = $state<ModelProfile[]>([]);
  let slotAssignments = $state<Record<string, ModelSlot>>({});

  const providers = getRegistry().listProviders();

  const PROVIDER_BASE_URLS: Record<string, string> = {
    nanogpt: 'https://api.nanogpt.io/v1',
    openai: 'https://api.openai.com/v1',
    claude: 'https://api.anthropic.com/v1',
    'opencode-go': 'https://opencode.ai/zen/go/v1',
    fireworks: 'https://api.fireworks.ai/inference/v1',
    'local-llm': 'http://localhost:11434/v1',
  };

  function makeBlankProfile(index: number): ModelProfile {
    return {
      id: crypto.randomUUID(),
      name: `Model Card ${index}`,
      provider: '',
      apiKey: '',
      baseUrl: '',
      model: '',
      temperature: 0.7,
      maxTokens: 32000,
    };
  }

  function getModelOptions(providerId: string) {
    return providers
      .find((provider) => provider.id === providerId)
      ?.requiredConfig.find((field) => field.key === 'model' && field.type === 'select')
      ?.options;
  }

  function getInheritedProviderValue(providerId: string, key: string): string {
    const value = $settingsStore.providers?.[providerId]?.[key];
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number') {
      return String(value);
    }
    return '';
  }

  function getApiKeyStatus(profile: ModelProfile): string {
    if (profile.apiKey?.trim()) {
      return 'Stored on this card';
    }
    if (getInheritedProviderValue(profile.provider, 'apiKey')) {
      return 'Inherited from Provider Settings';
    }
    return 'No API key configured';
  }

  function getProfile(id: string): ModelProfile | undefined {
    return profiles.find((profile) => profile.id === id);
  }

  function updateSelectedProfile(patch: Partial<ModelProfile>) {
    profiles = profiles.map((profile) =>
      profile.id === selectedProfileId ? { ...profile, ...patch } : profile,
    );
  }

  function updateSlot(slotId: string, patch: Partial<ModelSlot>) {
    slotAssignments = {
      ...slotAssignments,
      [slotId]: {
        ...(slotAssignments[slotId] ?? {}),
        ...patch,
      },
    };
  }

  function removeProfile(profileId: string) {
    if (profiles.length <= 1) {
      profiles = [makeBlankProfile(1)];
      selectedProfileId = profiles[0].id;
    } else {
      profiles = profiles.filter((profile) => profile.id !== profileId);
      if (selectedProfileId === profileId) {
        selectedProfileId = profiles[0]?.id ?? '';
      }
    }

    const nextAssignments: Record<string, ModelSlot> = {};
    for (const [slotId, slot] of Object.entries(slotAssignments)) {
      nextAssignments[slotId] = slot.profileId === profileId
        ? { ...slot, profileId: undefined }
        : slot;
    }
    slotAssignments = nextAssignments;
  }

  function addProfile() {
    const profile = makeBlankProfile(profiles.length + 1);
    profiles = [...profiles, profile];
    selectedProfileId = profile.id;
  }

  async function handleSave() {
    const serializedProfiles = Object.fromEntries(
      profiles.map((profile) => [profile.id, profile]),
    );
    settingsStore.update({
      modelProfiles: serializedProfiles,
      modelSlots: slotAssignments,
    });
    await settingsRepo.save();
  }

  onMount(async () => {
    await settingsRepo.load();
    const loadedProfiles = Object.values($settingsStore.modelProfiles || {});
    profiles = loadedProfiles.length > 0 ? loadedProfiles : [makeBlankProfile(1)];
    selectedProfileId = profiles[0]?.id ?? '';
    slotAssignments = { ...($settingsStore.modelSlots || {}) };
    loaded = true;
  });
</script>

{#if !loaded}
  <div class="flex-1 flex items-center justify-center text-subtext0">Loading...</div>
{:else}
  <div class="flex-1 overflow-y-auto">
    <div class="max-w-5xl mx-auto p-6 space-y-8">
      <div class="flex items-center gap-3">
        <a href="/settings" class="text-subtext0 hover:text-text transition-colors">&larr;</a>
        <div>
          <h1 class="text-lg font-semibold text-text">Model Cards</h1>
          <p class="text-xs text-subtext0 mt-1">
            Build reusable provider+model cards, then assign them to each LLM-driven system.
          </p>
        </div>
      </div>

      <section class="grid gap-4 lg:grid-cols-[15rem,1fr]">
        <div class="rounded-lg border border-surface1 bg-surface0/40 p-3 space-y-2">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-medium text-text">Cards</h2>
            <button
              type="button"
              onclick={addProfile}
              class="text-xs rounded-md border border-surface1 px-2 py-1 text-subtext0 hover:text-text"
            >
              + Add
            </button>
          </div>

          <div class="space-y-1">
            {#each profiles as profile (profile.id)}
              <button
                type="button"
                onclick={() => { selectedProfileId = profile.id; }}
                class="w-full rounded-md border px-3 py-2 text-left text-sm transition-colors {selectedProfileId === profile.id ? 'border-mauve text-text bg-surface1' : 'border-surface1 text-subtext0 hover:text-text hover:bg-surface1/60'}"
              >
                <div class="font-medium">{profile.name}</div>
                <div class="mt-1 text-[11px] text-subtext0">{profile.provider || 'No provider'} {profile.model ? `• ${profile.model}` : ''}</div>
              </button>
            {/each}
          </div>
        </div>

        {#if getProfile(selectedProfileId)}
          {@const selectedProfile = getProfile(selectedProfileId)!}
          <div class="rounded-lg border border-surface1 bg-surface0/40 p-4 space-y-4">
            <div class="flex items-center justify-between gap-3">
              <div>
                <h2 class="text-sm font-medium text-text">Card Details</h2>
                <p class="text-xs text-subtext0 mt-1">Connection and model settings for this reusable card.</p>
              </div>
              <button
                type="button"
                onclick={() => removeProfile(selectedProfile.id)}
                class="text-xs rounded-md border border-red/30 bg-red/10 px-2 py-1 text-red hover:bg-red/20"
              >
                Remove
              </button>
            </div>

            <div class="grid gap-4 md:grid-cols-2">
              <div class="space-y-1">
                <label for="selected-card-name" class="text-sm text-text">Card Name</label>
                <input
                  id="selected-card-name"
                  type="text"
                  value={selectedProfile.name}
                  oninput={(e) => updateSelectedProfile({ name: (e.target as HTMLInputElement).value })}
                  class="w-full rounded-md border border-surface1 bg-surface0 px-3 py-2 text-sm text-text focus:border-mauve focus:outline-none"
                />
              </div>

              <div class="space-y-1">
                <label for="selected-card-provider" class="text-sm text-text">Provider</label>
                <select
                  id="selected-card-provider"
                  value={selectedProfile.provider}
                  onchange={(e) => {
                    const provider = (e.target as HTMLSelectElement).value;
                    updateSelectedProfile({
                      provider,
                      baseUrl:
                        selectedProfile.baseUrl
                        || getInheritedProviderValue(provider, 'baseUrl')
                        || PROVIDER_BASE_URLS[provider]
                        || '',
                      model:
                        selectedProfile.model
                        || getInheritedProviderValue(provider, 'model')
                        || getModelOptions(provider)?.[0]?.value
                        || '',
                    });
                  }}
                  class="w-full rounded-md border border-surface1 bg-surface0 px-3 py-2 text-sm text-text focus:border-mauve focus:outline-none"
                >
                  <option value="">-- Select Provider --</option>
                  {#each providers as provider}
                    <option value={provider.id}>{provider.name}</option>
                  {/each}
                </select>
              </div>

              <div class="space-y-1">
                <label for="selected-card-api-key" class="text-sm text-text">API Key</label>
                <input
                  id="selected-card-api-key"
                  type="password"
                  value={selectedProfile.apiKey || ''}
                  oninput={(e) => updateSelectedProfile({ apiKey: (e.target as HTMLInputElement).value })}
                  placeholder={selectedProfile.apiKey ? '' : (getInheritedProviderValue(selectedProfile.provider, 'apiKey') ? 'Inherited from Provider Settings' : '')}
                  class="w-full rounded-md border border-surface1 bg-surface0 px-3 py-2 text-sm text-text focus:border-mauve focus:outline-none"
                />
                <p class="text-xs text-subtext0">{getApiKeyStatus(selectedProfile)}</p>
              </div>

              <div class="space-y-1">
                <label for="selected-card-base-url" class="text-sm text-text">Base URL</label>
                <input
                  id="selected-card-base-url"
                  type="text"
                  value={selectedProfile.baseUrl || ''}
                  oninput={(e) => updateSelectedProfile({ baseUrl: (e.target as HTMLInputElement).value })}
                  placeholder={selectedProfile.baseUrl || getInheritedProviderValue(selectedProfile.provider, 'baseUrl') || PROVIDER_BASE_URLS[selectedProfile.provider] || ''}
                  class="w-full rounded-md border border-surface1 bg-surface0 px-3 py-2 text-sm text-text focus:border-mauve focus:outline-none"
                />
                {#if !selectedProfile.baseUrl && getInheritedProviderValue(selectedProfile.provider, 'baseUrl')}
                  <p class="text-xs text-subtext0">Using provider default: {getInheritedProviderValue(selectedProfile.provider, 'baseUrl')}</p>
                {/if}
              </div>

              <div class="space-y-1">
                <label for="selected-card-model" class="text-sm text-text">Model</label>
                {#if getModelOptions(selectedProfile.provider)?.length}
                  <select
                    id="selected-card-model"
                    value={selectedProfile.model || getInheritedProviderValue(selectedProfile.provider, 'model')}
                    onchange={(e) => updateSelectedProfile({ model: (e.target as HTMLSelectElement).value })}
                    class="w-full rounded-md border border-surface1 bg-surface0 px-3 py-2 text-sm text-text focus:border-mauve focus:outline-none"
                  >
                    <option value="">-- Select Model --</option>
                    {#each getModelOptions(selectedProfile.provider) || [] as option}
                      <option value={option.value}>{option.label}</option>
                    {/each}
                  </select>
                {:else}
                  <input
                    id="selected-card-model"
                    type="text"
                    value={selectedProfile.model}
                    oninput={(e) => updateSelectedProfile({ model: (e.target as HTMLInputElement).value })}
                    placeholder={getInheritedProviderValue(selectedProfile.provider, 'model')}
                    class="w-full rounded-md border border-surface1 bg-surface0 px-3 py-2 text-sm text-text focus:border-mauve focus:outline-none"
                  />
                {/if}
                {#if !selectedProfile.model && getInheritedProviderValue(selectedProfile.provider, 'model')}
                  <p class="text-xs text-subtext0">Using provider default: {getInheritedProviderValue(selectedProfile.provider, 'model')}</p>
                {/if}
              </div>

              <div class="space-y-1">
                <label for="selected-card-temperature" class="text-sm text-text">Temperature: {selectedProfile.temperature ?? 0.7}</label>
                <input
                  id="selected-card-temperature"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={selectedProfile.temperature ?? 0.7}
                  oninput={(e) => updateSelectedProfile({ temperature: Number((e.target as HTMLInputElement).value) })}
                  class="w-full accent-mauve"
                />
              </div>
            </div>

            <div class="space-y-1">
              <label for="selected-card-max-tokens" class="text-sm text-text">Max Tokens: {selectedProfile.maxTokens ?? 32000}</label>
              <input
                id="selected-card-max-tokens"
                type="range"
                min="1024"
                max="64000"
                step="512"
                value={selectedProfile.maxTokens ?? 32000}
                oninput={(e) => updateSelectedProfile({ maxTokens: Number((e.target as HTMLInputElement).value) })}
                class="w-full accent-mauve"
              />
            </div>
          </div>
        {/if}
      </section>

      <section class="space-y-4">
        <div>
          <h2 class="text-sm font-medium text-text">Slot Assignments</h2>
          <p class="text-xs text-subtext0 mt-1">
            Each system can point at a different card. Unassigned slots fall back through their local defaults.
          </p>
        </div>

        <div class="grid gap-3 lg:grid-cols-2">
          {#each MODEL_SLOT_DEFINITIONS as slotDef (slotDef.id)}
            {@const slot = slotAssignments[slotDef.id] ?? {}}
            <section class="rounded-lg border border-surface1 bg-surface0/40 p-4 space-y-3">
              <div>
                <h3 class="text-sm font-medium text-text">{slotDef.label}</h3>
                <p class="text-xs text-subtext0 mt-1">{slotDef.description}</p>
              </div>

              <div class="space-y-1">
                <label for={`slot-${slotDef.id}-profile`} class="text-xs text-subtext0 uppercase tracking-wider">Assigned Card</label>
                <select
                  id={`slot-${slotDef.id}-profile`}
                  value={slot.profileId || ''}
                  onchange={(e) => updateSlot(slotDef.id, { profileId: (e.target as HTMLSelectElement).value || undefined })}
                  class="w-full rounded-md border border-surface1 bg-surface0 px-3 py-2 text-sm text-text focus:border-mauve focus:outline-none"
                >
                  <option value="">-- Use Fallback --</option>
                  {#each profiles as profile}
                    <option value={profile.id}>{profile.name}</option>
                  {/each}
                </select>
              </div>

              <div class="grid gap-3 md:grid-cols-2">
                <div class="space-y-1">
                  <label for={`slot-${slotDef.id}-temperature`} class="text-xs text-subtext0 uppercase tracking-wider">Temperature Override</label>
                  <input
                    id={`slot-${slotDef.id}-temperature`}
                    type="number"
                    min="0"
                    max="1"
                    step="0.05"
                    value={slot.temperature ?? ''}
                    oninput={(e) => updateSlot(slotDef.id, {
                      temperature: (e.target as HTMLInputElement).value === ''
                        ? undefined
                        : Number((e.target as HTMLInputElement).value),
                    })}
                    placeholder="inherit"
                    class="w-full rounded-md border border-surface1 bg-surface0 px-3 py-2 text-sm text-text focus:border-mauve focus:outline-none"
                  />
                </div>

                <div class="space-y-1">
                  <label for={`slot-${slotDef.id}-max-tokens`} class="text-xs text-subtext0 uppercase tracking-wider">Max Tokens Override</label>
                  <input
                    id={`slot-${slotDef.id}-max-tokens`}
                    type="number"
                    min="1024"
                    max="64000"
                    step="512"
                    value={slot.maxTokens ?? ''}
                    oninput={(e) => updateSlot(slotDef.id, {
                      maxTokens: (e.target as HTMLInputElement).value === ''
                        ? undefined
                        : Number((e.target as HTMLInputElement).value),
                    })}
                    placeholder="inherit"
                    class="w-full rounded-md border border-surface1 bg-surface0 px-3 py-2 text-sm text-text focus:border-mauve focus:outline-none"
                  />
                </div>
              </div>

              {#if slotDef.id === 'memory' || slotDef.id === 'extraction'}
                <div class="space-y-1">
                  <div class="flex items-center justify-between gap-3">
                    <label for={`slot-${slotDef.id}-custom-extraction`} class="text-xs text-subtext0 uppercase tracking-wider">Custom Extraction Prompt</label>
                    <button
                      type="button"
                      onclick={() => updateSlot(slotDef.id, { customExtractionPrompt: DEFAULT_EXTRACTION_PROMPT })}
                      class="text-[11px] text-mauve hover:text-lavender"
                    >
                      Reset
                    </button>
                  </div>
                  <textarea
                    id={`slot-${slotDef.id}-custom-extraction`}
                    rows="4"
                    value={slot.customExtractionPrompt || ''}
                    oninput={(e) => updateSlot(slotDef.id, { customExtractionPrompt: (e.target as HTMLTextAreaElement).value })}
                    placeholder={DEFAULT_EXTRACTION_PROMPT.slice(0, 80) + '...'}
                    class="w-full rounded-md border border-surface1 bg-surface0 px-3 py-2 text-sm text-text focus:border-mauve focus:outline-none"
                  ></textarea>
                </div>
              {/if}

              {#if slotDef.id === 'memory' || slotDef.id === 'summary'}
                <div class="space-y-1">
                  <div class="flex items-center justify-between gap-3">
                    <label for={`slot-${slotDef.id}-custom-summary`} class="text-xs text-subtext0 uppercase tracking-wider">Custom Summary Prompt</label>
                    <button
                      type="button"
                      onclick={() => updateSlot(slotDef.id, { customSummaryPrompt: DEFAULT_SUMMARY_PROMPT })}
                      class="text-[11px] text-mauve hover:text-lavender"
                    >
                      Reset
                    </button>
                  </div>
                  <textarea
                    id={`slot-${slotDef.id}-custom-summary`}
                    rows="4"
                    value={slot.customSummaryPrompt || ''}
                    oninput={(e) => updateSlot(slotDef.id, { customSummaryPrompt: (e.target as HTMLTextAreaElement).value })}
                    placeholder={DEFAULT_SUMMARY_PROMPT.slice(0, 80) + '...'}
                    class="w-full rounded-md border border-surface1 bg-surface0 px-3 py-2 text-sm text-text focus:border-mauve focus:outline-none"
                  ></textarea>
                </div>
              {/if}

              {#if slotDef.id === 'illustration'}
                <div class="space-y-1">
                  <label for={`slot-${slotDef.id}-custom-planning`} class="text-xs text-subtext0 uppercase tracking-wider">Custom Planning Prompt</label>
                  <textarea
                    id={`slot-${slotDef.id}-custom-planning`}
                    rows="4"
                    value={slot.customPlanningPrompt || ''}
                    oninput={(e) => updateSlot(slotDef.id, { customPlanningPrompt: (e.target as HTMLTextAreaElement).value })}
                    placeholder="Custom prompt for illustration planning..."
                    class="w-full rounded-md border border-surface1 bg-surface0 px-3 py-2 text-sm text-text focus:border-mauve focus:outline-none"
                  ></textarea>
                </div>
              {/if}
            </section>
          {/each}
        </div>
      </section>

      <div class="flex justify-end">
        <button
          onclick={handleSave}
          class="px-4 py-2 bg-mauve text-crust rounded-md text-sm font-medium hover:bg-lavender transition-colors"
        >
          Save
        </button>
      </div>
    </div>
  </div>
{/if}
