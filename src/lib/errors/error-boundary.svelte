<script lang="ts">
  import ErrorState from '$lib/components/base/ErrorState.svelte';
  import { handleError } from './error-handler';

  interface Props {
    children: import('svelte').Snippet;
    fallback?: import('svelte').Snippet<[Error]>;
    onError?: (error: Error) => void;
  }

  let { children, fallback, onError }: Props = $props();

  let error: Error | null = $state(null);

  export function captureError(e: Error) {
    error = e;
    handleError(e, 'ErrorBoundary');
    onError?.(e);
  }

  function reset() {
    error = null;
  }
</script>

{#if error}
  {#if fallback}
    {@render fallback(error)}
  {:else}
    <ErrorState
      title="Something went wrong"
      message={error.message}
      onRetry={reset}
    />
  {/if}
{:else}
  {@render children()}
{/if}
