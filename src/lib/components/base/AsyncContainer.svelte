<script lang="ts">
  import ErrorState from './ErrorState.svelte';
  
  type AsyncState<T> = 
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'success'; data: T }
    | { status: 'error'; error: string };

  interface Props<T> {
    state: AsyncState<T>;
    loadingMessage?: string;
    errorTitle?: string;
    onRetry?: () => void;
    children: import('svelte').Snippet<[T]>;
  }

  let { 
    state, 
    loadingMessage = 'Loading...',
    errorTitle = 'Failed to load',
    onRetry,
    children
  }: Props<unknown> = $props();
</script>

{#if state.status === 'idle'}
  <div class="flex items-center justify-center p-6 text-subtext0 text-sm">
    Waiting...
  </div>
{:else if state.status === 'loading'}
  <div class="flex flex-col items-center justify-center p-6">
    <div class="w-6 h-6 border-2 border-surface0 border-t-mauve rounded-full animate-spin mb-2"></div>
    <span class="text-xs text-subtext0">{loadingMessage}</span>
  </div>
{:else if state.status === 'error'}
  <ErrorState
    title={errorTitle}
    message={state.error}
    onRetry={onRetry}
  />
{:else if state.status === 'success'}
  {@render children(state.data)}
{/if}
