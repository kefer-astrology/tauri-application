<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements';
  import { cn, type WithElementRef } from '$lib/utils.js';

  let {
    ref = $bindable(null),
    class: className,
    children,
    colspan,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLTableCellElement>, HTMLTableCellElement> & {
    colspan?: number;
  } = $props();
</script>

<td bind:this={ref} data-slot="table-cell" {colspan} class={cn('p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0', className)} {...restProps}>
  {@render children?.()}
</td>
