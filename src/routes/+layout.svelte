<script lang="ts">
	import '../app.css';
	import Sidebar from '$lib/components/Sidebar.svelte';

	let { children } = $props();
	let sidebarCollapsed = $state(false);
</script>

<div class="flex h-screen overflow-hidden">
	<Sidebar collapsed={sidebarCollapsed} onToggle={() => sidebarCollapsed = !sidebarCollapsed} />
	<main class="flex-1 flex flex-col overflow-hidden">
		{@render children()}
	</main>
</div>
