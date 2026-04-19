<script lang="ts">
	let { location = '', time = '', mood = '', onopenmemory }: {
		location?: string;
		time?: string;
		mood?: string;
		onopenmemory?: () => void;
	} = $props();
</script>

{#if location || time || mood || onopenmemory}
  <div class="flex items-center gap-4 px-4 py-1.5 bg-surface0/50 text-xs text-subtext0 border-b border-surface0">
    {#if location}
      <span>📍 {location}</span>
    {/if}
    {#if time}
      <span>🕐 {time}</span>
    {/if}
    {#if mood}
      <span>🎭 {mood}</span>
    {/if}
    {#if onopenmemory}
      <button
        onclick={onopenmemory}
        class="ml-auto text-xs text-subtext0 hover:text-lavender bg-transparent border-none cursor-pointer"
        title="Memory Inspector"
      >🧠 Memory</button>
    {/if}
  </div>
{/if}
