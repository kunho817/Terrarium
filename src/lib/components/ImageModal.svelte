<script lang="ts">
  let { src, onclose } = $props<{
    src: string;
    onclose: () => void;
  }>();
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-overlay/70"
  tabindex="-1"
  onclick={onclose}
  onkeydown={(e) => { if (e.key === 'Escape') onclose(); }}
>
  <div role="presentation" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
    <img
      src={src}
      alt="Full-size illustration"
      class="max-w-[90vw] max-h-[85vh] rounded-lg shadow-2xl"
    />
  </div>
</div>
