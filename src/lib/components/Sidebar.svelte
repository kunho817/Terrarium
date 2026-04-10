<script lang="ts">
  import { page } from '$app/stores';

  let { collapsed = false, onToggle } = $props<{
    collapsed?: boolean;
    onToggle: () => void;
  }>();

  const navItems = [
    { href: '/', label: 'Chats', icon: '💬' },
    { href: '/characters', label: 'Characters', icon: '👤' },
    { href: '/settings', label: 'Settings', icon: '⚙️' },
  ];
</script>

<nav class="flex flex-col h-full bg-mantle border-r border-surface0 select-none" class:w-16={collapsed} class:w-60={!collapsed}>
  <!-- Header -->
  <div class="flex items-center justify-between p-3 border-b border-surface0">
    {#if !collapsed}
      <span class="text-sm font-bold text-mauve tracking-wide">TERRARIUM</span>
    {/if}
    <button
      onclick={onToggle}
      class="p-1.5 rounded hover:bg-surface0 text-subtext0 hover:text-text transition-colors"
      aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
    >
      {collapsed ? '→' : '←'}
    </button>
  </div>

  <!-- Navigation -->
  <div class="flex-1 flex flex-col gap-1 p-2">
    {#each navItems as item}
      <a
        href={item.href}
        class="flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors
               hover:bg-surface0 text-subtext1 hover:text-text"
        class:justify-center={collapsed}
        class:bg-surface1={$page.url.pathname === item.href || (item.href !== '/' && $page.url.pathname.startsWith(item.href))}
      >
        <span class="text-base">{item.icon}</span>
        {#if !collapsed}
          <span>{item.label}</span>
        {/if}
      </a>
    {/each}
  </div>
</nav>
