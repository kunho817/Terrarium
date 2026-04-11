<script lang="ts">
  import type { GenerationInfo } from '$lib/types';

  let { info, onclick } = $props<{
    info: GenerationInfo;
    onclick: () => void;
  }>();

  const displayName = $derived(
    info.model
      ? (info.model.length > 20 ? info.model.slice(0, 20) + '…' : info.model)
      : 'Unknown Model'
  );
</script>

<button
  {onclick}
  class="inline-flex items-center gap-1 bg-surface0 text-subtext0 text-xs px-2 py-0.5 rounded
         cursor-pointer hover:bg-surface1 transition-colors"
  title={info.model ?? 'Unknown Model'}
>
  <svg
    class="w-3 h-3 shrink-0"
    viewBox="0 0 16 16"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M8 1a4 4 0 0 0-4 4v2H2.5A1.5 1.5 0 0 0 1 8.5v5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 13.5 7H12V5a4 4 0 0 0-4-4Zm2.5 6h-5V5a2.5 2.5 0 0 1 5 0v2Z" />
  </svg>
  <span>{displayName}</span>
</button>
