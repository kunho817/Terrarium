<script lang="ts">
  let { name = '', description = '', tags = [], onclick } = $props<{
    name?: string;
    description?: string;
    tags?: string[];
    onclick?: () => void;
  }>();
</script>

<button
  {onclick}
  class="block text-left p-4 rounded-lg bg-surface0 hover:bg-surface1
         transition-colors border border-surface1 w-full"
>
  <h3 class="text-text font-medium text-sm mb-1">{name}</h3>
  {#if description}
    <p class="text-subtext0 text-xs line-clamp-2">{description}</p>
  {/if}
  {#if tags.length > 0}
    <div class="flex gap-1 mt-2 flex-wrap">
      {#each tags.slice(0, 5) as tag}
        <span class="text-xs px-1.5 py-0.5 bg-surface2 rounded text-subtext0">{tag}</span>
      {/each}
    </div>
  {/if}
</button>
