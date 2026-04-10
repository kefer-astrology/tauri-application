<script lang="ts">
  import { Button } from '$lib/components/ui/button/index.js';
  let {
    title = '',
    expanded = $bindable(true),
    editable = true,
    onEdit = undefined,
    onToggle = undefined,
    children = undefined,
    footer = undefined,
  } = $props();

  function toggle() {
    expanded = !expanded;
    onToggle?.(expanded);
  }

  function edit() {
    onEdit?.();
  }
</script>

<div class="w-full flex flex-col max-h-full overflow-hidden rounded-md border shadow-sm bg-panel text-panel-foreground" aria-expanded={expanded}>
  <!-- Header: themeable panel header -->
  <div class="flex items-center justify-between px-3 py-2 select-none bg-panel-header text-primary-foreground">
    <div class="flex items-center gap-2 min-w-0">
      <Button variant="ghost" size="icon" class="h-7 w-7 rounded-sm hover:opacity-85 transition-opacity" onclick={toggle} aria-label="Toggle panel">
        {#if expanded}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>
        {:else}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
        {/if}
      </Button>
      <div class="font-semibold truncate">{title}</div>
    </div>
    {#if editable}
      <Button variant="ghost" size="icon" class="h-7 w-7 rounded-sm hover:opacity-85 transition-opacity" onclick={edit} aria-label="Edit widget">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z"/></svg>
      </Button>
    {/if}
  </div>

  {#if expanded}
    <!-- Body: same panel background + white text for consistency -->
    <div class="flex-1 min-h-0 overflow-auto bg-panel text-panel-foreground">
      <div class="p-3">
        {@render children?.()}
      </div>
    </div>

    <!-- Footer -->
    <div class="px-3 py-2 bg-primary text-primary-foreground select-none">
      {@render footer?.()}
    </div>
  {/if}
</div>
