<script lang="ts">
  interface Props {
    title?: string;
    message: string;
    onRetry?: () => void;
    canDismiss?: boolean;
    onDismiss?: () => void;
  }

  let { 
    title = 'Error', 
    message, 
    onRetry,
    canDismiss = false,
    onDismiss
  }: Props = $props();
</script>

<div class="flex flex-col items-center justify-center p-6 text-center" role="alert">
  <div class="w-12 h-12 rounded-full bg-red/20 flex items-center justify-center mb-3">
    <span class="text-red text-xl">!</span>
  </div>
  
  <h3 class="text-sm font-semibold text-text mb-1">{title}</h3>
  <p class="text-xs text-subtext0 mb-4 max-w-xs">{message}</p>
  
  <div class="flex gap-2">
    {#if onRetry}
      <button
        onclick={onRetry}
        class="px-3 py-1.5 rounded text-xs font-medium bg-mauve text-crust hover:bg-lavender transition-colors"
      >
        Retry
      </button>
    {/if}
    
    {#if canDismiss && onDismiss}
      <button
        onclick={onDismiss}
        class="px-3 py-1.5 rounded text-xs font-medium bg-surface0 text-text hover:bg-surface1 transition-colors"
      >
        Dismiss
      </button>
    {/if}
  </div>
</div>
