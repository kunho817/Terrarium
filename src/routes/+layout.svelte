<script lang="ts">
	import { onMount } from 'svelte';
	import '../app.css';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import { settingsRepo } from '$lib/repositories/settings-repo';

	let { children } = $props();
	let sidebarCollapsed = $state(false);

	onMount(() => {
		settingsRepo.load();
	});
</script>

<div class="flex h-screen overflow-hidden">
	<Sidebar collapsed={sidebarCollapsed} onToggle={() => sidebarCollapsed = !sidebarCollapsed} />
	<main class="flex-1 flex flex-col overflow-hidden">
		{@render children()}
	</main>
</div>
