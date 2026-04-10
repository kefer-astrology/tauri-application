<script lang="ts">
  import { layout, type ChartData } from '$lib/state/layout';
  import * as Breadcrumb from '$lib/components/ui/breadcrumb/index.js';
  import { Button } from '$lib/components/ui/button/index.js';

  function selectContext(chart: ChartData) {
    layout.selectedContext = chart.id;
  }
</script>

<!-- Bottom bar styled for dark topography and larger touch targets -->
<div class="w-full h-full flex items-center justify-center overflow-x-auto overflow-y-hidden">
  <Breadcrumb.Root>
    <Breadcrumb.List class="flex items-center gap-2 text-white/90 min-w-0">
      {#each layout.contexts as chart, i}
        <Breadcrumb.Item>
          {#if layout.selectedContext === chart.id}
            <Breadcrumb.Page class="px-2 py-1.5 rounded-md text-white font-semibold underline underline-offset-4">{chart.name}</Breadcrumb.Page>
          {:else}
            <Breadcrumb.Link>
              {#snippet child({ props })}
                <Button
                  type="button"
                  variant="ghost"
                  class={`${props.class ?? ''} px-2 py-1.5 rounded-md text-white/90 bg-transparent hover:bg-transparent hover:underline transition-colors`}
                  onclick={() => selectContext(chart)}
                >{chart.name}</Button>
              {/snippet}
            </Breadcrumb.Link>
          {/if}
        </Breadcrumb.Item>
        {#if i < layout.contexts.length - 1}
          <Breadcrumb.Separator class="text-white/40" />
        {/if}
      {/each}
    </Breadcrumb.List>
  </Breadcrumb.Root>
</div>
