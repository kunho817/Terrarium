<script lang="ts">
  let { location = '', time = '', mood = '' } = $props<{
    location?: string;
    time?: string;
    mood?: string;
  }>();
</script>

{#if location || time || mood}
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
  </div>
{/if}
