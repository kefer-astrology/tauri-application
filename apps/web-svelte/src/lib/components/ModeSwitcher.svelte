<script lang="ts">
  import { Button } from '$lib/components/ui/button/index.js';
  import { cn } from '$lib/utils';

  type ModeSwitcherOption = {
    value: string;
    label: string;
  };

  interface Props {
    value: string;
    options: readonly ModeSwitcherOption[];
    ariaLabel: string;
    onValueChange?: (value: string) => void;
    class?: string;
  }

  let { value = $bindable(), options, ariaLabel, onValueChange, class: className }: Props = $props();

  function select(next: string) {
    value = next;
    onValueChange?.(next);
  }
</script>

<div
  class={cn('grid h-10 gap-1 rounded-md border bg-muted p-1', className)}
  style:grid-template-columns={`repeat(${options.length}, minmax(0, 1fr))`}
  role="radiogroup"
  aria-label={ariaLabel}
>
  {#each options as option (option.value)}
    <Button
      type="button"
      variant={value === option.value ? 'default' : 'ghost'}
      class="h-full min-w-0 px-2"
      aria-pressed={value === option.value}
      onclick={() => select(option.value)}
    >
      <span class="truncate">{option.label}</span>
    </Button>
  {/each}
</div>
