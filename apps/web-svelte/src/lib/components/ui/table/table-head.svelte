<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements';
  import { cn, type WithElementRef } from '$lib/utils.js';

  let {
    ref = $bindable(null),
    class: className,
    children,
    scope,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLTableCellElement>, HTMLTableCellElement> & {
    scope?: 'row' | 'rowgroup' | 'col' | 'colgroup';
  } = $props();
</script>

<th bind:this={ref} data-slot="table-head" {scope} class={cn('text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0', className)} {...restProps}>
  {@render children?.()}
</th>
