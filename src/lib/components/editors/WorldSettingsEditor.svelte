<script lang="ts">
	import type { WorldSettings } from '$lib/types/world';

	let { settings, onchange, providerIds = [] }: {
		settings: WorldSettings;
		onchange: (settings: WorldSettings) => void;
		providerIds?: string[];
	} = $props();

	type AgentKey = 'memory' | 'director' | 'sceneState' | 'characterState' | 'narrativeConsistency';

	const agents: { key: AgentKey; label: string }[] = [
		{ key: 'memory', label: 'Memory Agent' },
		{ key: 'director', label: 'Director Agent' },
		{ key: 'sceneState', label: 'Scene State Agent' },
		{ key: 'characterState', label: 'Character State Agent' },
		{ key: 'narrativeConsistency', label: 'Narrative Consistency' },
	];

	function numOrUndef(value: string): number | undefined {
		const n = parseFloat(value);
		return isNaN(n) ? undefined : n;
	}

	function updateField(field: keyof WorldSettings, value: unknown) {
		onchange({ ...settings, [field]: value === '' || value === '(global)' ? undefined : value });
	}

	function updateAgent(agentKey: AgentKey, partial: { enabled?: boolean; tokenBudget?: number }) {
		const current = settings.agents?.[agentKey] ?? {};
		onchange({
			...settings,
			agents: {
				...settings.agents,
				[agentKey]: { ...current, ...partial },
			},
		});
	}

	function updateLore(field: keyof NonNullable<WorldSettings['loreSettings']>, value: unknown) {
		onchange({
			...settings,
			loreSettings: {
				...settings.loreSettings,
				[field]: value === '' ? undefined : value,
			},
		});
	}
</script>

<div class="flex flex-col gap-6">
	<div>
		<h3 class="text-sm font-medium text-text mb-1">Model Overrides</h3>
		<p class="text-xs text-subtext0 mb-3">Leave blank to use global settings.</p>
		<div class="grid grid-cols-2 gap-3">
			<label class="flex flex-col gap-1">
				<span class="text-xs text-subtext0">Provider</span>
				<select
					class="bg-surface0 text-text border border-surface1 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-mauve"
					value={settings.providerId ?? ''}
					onchange={(e) => updateField('providerId', e.currentTarget.value)}
				>
					<option value="">(global)</option>
					{#each providerIds as id}
						<option value={id}>{id}</option>
					{/each}
				</select>
			</label>

			<label class="flex flex-col gap-1">
				<span class="text-xs text-subtext0">Model</span>
				<input
					type="text"
					class="bg-surface0 text-text border border-surface1 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-mauve"
					placeholder="(global)"
					value={settings.model ?? ''}
					oninput={(e) => updateField('model', e.currentTarget.value)}
				/>
			</label>

			<label class="flex flex-col gap-1">
				<span class="text-xs text-subtext0">Temperature</span>
				<input
					type="number"
					min="0"
					max="2"
					step="0.1"
					class="bg-surface0 text-text border border-surface1 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-mauve"
					placeholder="(global)"
					value={settings.temperature ?? ''}
					oninput={(e) => updateField('temperature', numOrUndef(e.currentTarget.value))}
				/>
			</label>

			<label class="flex flex-col gap-1">
				<span class="text-xs text-subtext0">Top P</span>
				<input
					type="number"
					min="0"
					max="1"
					step="0.05"
					class="bg-surface0 text-text border border-surface1 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-mauve"
					placeholder="(global)"
					value={settings.topP ?? ''}
					oninput={(e) => updateField('topP', numOrUndef(e.currentTarget.value))}
				/>
			</label>

			<label class="flex flex-col gap-1">
				<span class="text-xs text-subtext0">Max Tokens</span>
				<input
					type="number"
					class="bg-surface0 text-text border border-surface1 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-mauve"
					placeholder="(global)"
					value={settings.maxTokens ?? ''}
					oninput={(e) => updateField('maxTokens', numOrUndef(e.currentTarget.value))}
				/>
			</label>
		</div>
	</div>

	<div>
		<h3 class="text-sm font-medium text-text mb-3">Agent Overrides</h3>
		<div class="flex flex-col gap-2">
			{#each agents as agent}
				<div class="flex items-center gap-3 rounded-lg border border-surface1 bg-crust px-3 py-2">
					<input
						type="checkbox"
						class="accent-mauve"
						checked={settings.agents?.[agent.key]?.enabled ?? true}
						onchange={(e) => updateAgent(agent.key, { enabled: e.currentTarget.checked })}
					/>
					<span class="text-sm text-text flex-1">{agent.label}</span>
					<label class="flex items-center gap-1.5">
						<span class="text-xs text-subtext0">Budget</span>
						<input
							type="number"
							class="bg-surface0 text-text border border-surface1 rounded px-2 py-1 text-sm w-24 focus:outline-none focus:border-mauve"
							placeholder="(global)"
							value={settings.agents?.[agent.key]?.tokenBudget ?? ''}
							oninput={(e) => updateAgent(agent.key, { tokenBudget: numOrUndef(e.currentTarget.value) })}
						/>
					</label>
				</div>
			{/each}
		</div>
	</div>

	<div>
		<h3 class="text-sm font-medium text-text mb-3">Lore Settings Overrides</h3>
		<div class="grid grid-cols-2 gap-3">
			<label class="flex flex-col gap-1">
				<span class="text-xs text-subtext0">Token Budget</span>
				<input
					type="number"
					class="bg-surface0 text-text border border-surface1 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-mauve"
					placeholder="(global)"
					value={settings.loreSettings?.tokenBudget ?? ''}
					oninput={(e) => updateLore('tokenBudget', numOrUndef(e.currentTarget.value))}
				/>
			</label>

			<label class="flex flex-col gap-1">
				<span class="text-xs text-subtext0">Scan Depth</span>
				<input
					type="number"
					class="bg-surface0 text-text border border-surface1 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-mauve"
					placeholder="(global)"
					value={settings.loreSettings?.scanDepth ?? ''}
					oninput={(e) => updateLore('scanDepth', numOrUndef(e.currentTarget.value))}
				/>
			</label>
		</div>
	</div>
</div>
