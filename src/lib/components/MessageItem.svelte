<script lang="ts">
  import type { Message } from '$lib/types';

  let { message } = $props<{ message: Message }>();

  const roleStyles: Record<string, string> = {
    user: 'border-l-2 border-l-blue pl-3',
    assistant: 'border-l-2 border-l-mauve pl-3',
    narrator: 'border-l-2 border-l-overlay0 pl-3 bg-surface0/30 rounded-r-lg italic',
    system: 'border-l-2 border-l-yellow pl-3 text-subtext0 text-sm',
  };
</script>

<div class="py-2 {roleStyles[message.role] || ''}">
  <p class="text-text text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
</div>
