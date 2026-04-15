<script lang="ts">
  import { page } from '$app/stores';
  import ErrorState from '$lib/components/base/ErrorState.svelte';
</script>

<div class="flex-1 flex items-center justify-center">
  <ErrorState
    title="Page Error"
    message={$page.error?.message || 'An unexpected error occurred'}
    onRetry={() => window.location.reload()}
  />
</div>
