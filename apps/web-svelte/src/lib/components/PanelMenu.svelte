<!-- Reusable left-panel menu using shadcn Button and shared stylesheet classes -->
<script lang="ts">
  import { Button } from '$lib/components/ui/button/index.js';

  export type PanelMenuItem = {
    id: string;
    label: string;
    children?: Array<{ id: string; label: string }>;
  };

  let {
    items = [],
    selectedId = $bindable(undefined as string | undefined),
    class: className = '',
  }: {
    items: PanelMenuItem[];
    selectedId?: string | undefined;
    class?: string;
  } = $props();

  function isSelected(id: string): boolean {
    return selectedId === id;
  }

  function hasSelectedChild(item: PanelMenuItem): boolean {
    return !!item.children?.some((c) => selectedId === c.id);
  }

  function isExpanded(item: PanelMenuItem): boolean {
    return selectedId === item.id || hasSelectedChild(item);
  }

  function select(id: string) {
    if (selectedId === id) {
      selectedId = undefined;
    } else {
      selectedId = id;
    }
  }

  function selectParent(item: PanelMenuItem) {
    if (hasSelectedChild(item)) {
      selectedId = undefined;
    } else {
      selectedId = item.id;
    }
  }
</script>

<nav class="panel-menu {className}" role="list">
  {#each items as item}
    {#if item.children?.length}
      <div class="space-y-0.5">
        <Button
          type="button"
          variant="ghost"
          class="panel-menu__btn {isSelected(item.id) || hasSelectedChild(item) ? 'panel-menu__btn--selected' : ''}"
          onclick={() => selectParent(item)}
        >
          {item.label}
        </Button>
        {#if isExpanded(item)}
          <div class="panel-menu__children">
            {#each item.children as child}
              <Button
                type="button"
                variant="ghost"
                class="panel-menu__btn panel-menu__btn--child {isSelected(child.id) ? 'panel-menu__btn--selected' : ''}"
                onclick={() => select(child.id)}
              >
                {child.label}
              </Button>
            {/each}
          </div>
        {/if}
      </div>
    {:else}
      <Button
        type="button"
        variant="ghost"
        class="panel-menu__btn {isSelected(item.id) ? 'panel-menu__btn--selected' : ''}"
        onclick={() => select(item.id)}
      >
        {item.label}
      </Button>
    {/if}
  {/each}
</nav>
