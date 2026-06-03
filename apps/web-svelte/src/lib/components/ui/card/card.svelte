<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements';
  import { cn, type WithElementRef } from '$lib/utils.js';

  let { ref = $bindable(null), class: className, children, ...restProps }: WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement> = $props();
</script>

<div bind:this={ref} data-slot="card" class={cn('bg-card text-card-foreground flex flex-col rounded-xl border shadow-sm', className)} {...restProps}>
  {@render children?.()}
</div>
