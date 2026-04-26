<script lang="ts">
	import { onMount } from 'svelte';
	import '../app.css';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import { settingsRepo } from '$lib/repositories/settings-repo';

	let { children } = $props();
	let sidebarCollapsed = $state(false);
	let settingsReady = $state(false);

	onMount(async () => {
		await settingsRepo.ensureLoaded();
		settingsReady = true;
	});
</script>

{#if settingsReady}
	<div class="flex h-screen overflow-hidden">
		<Sidebar collapsed={sidebarCollapsed} onToggle={() => sidebarCollapsed = !sidebarCollapsed} />
		<main class="flex-1 flex flex-col overflow-hidden">
			{@render children()}
		</main>
	</div>
{:else}
	<div class="flex h-screen items-center justify-center text-subtext0">
		Loading settings...
	</div>
{/if}
