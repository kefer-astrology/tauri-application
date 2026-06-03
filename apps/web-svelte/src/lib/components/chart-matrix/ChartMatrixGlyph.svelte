<script lang="ts">
  import { getGlyphContent } from '$lib/stores/glyphs.svelte';
  import { cn } from '$lib/utils';

  interface Props {
    glyphId: string;
    context?: string;
    size?: number;
    fallback?: string;
    class?: string;
  }

  let {
    glyphId,
    context = 'matrix',
    size = 24,
    fallback,
    class: className
  }: Props = $props();

  let failedGlyphFiles = $state<Record<string, boolean>>({});
  const glyph = $derived(getGlyphContent(glyphId));
  const fallbackLabel = $derived(fallback ?? glyph.fallback ?? glyphId.charAt(0).toUpperCase());
  const failureKey = $derived(`${context}:${glyphId}:${glyph.content}`);
</script>

<span class={cn('inline-flex items-center justify-center', className)}>
  {#if glyph.type === 'svg'}
    <span class="inline-block" style={`width:${size}px;height:${size}px;vertical-align:middle;`}>
      {@html glyph.content}
    </span>
  {:else if glyph.type === 'file'}
    {#if failedGlyphFiles[failureKey]}
      <span class="text-lg font-medium">{fallbackLabel}</span>
    {:else}
      <img
        src={glyph.content}
        alt={glyphId}
        style={`width:${glyph.size ?? size}px;height:${glyph.size ?? size}px;vertical-align:middle;`}
        onerror={() => {
          failedGlyphFiles[failureKey] = true;
          failedGlyphFiles = { ...failedGlyphFiles };
        }}
      />
    {/if}
  {:else}
    <span class="text-lg font-medium">{glyph.content || fallbackLabel}</span>
  {/if}
</span>
