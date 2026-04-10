<!-- Glyph Manager Component - For uploading and managing custom glyphs -->
<script lang="ts">
  import { glyphs, setCustomGlyph, getGlyph, getGlyphContent, resetGlyphToDefault } from '$lib/stores/glyphs.svelte';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import * as Dialog from '$lib/components/ui/dialog/index.js';
  
  let { embedded = false } = $props();
  
  let open = $state(false);
  let selectedGlyphId = $state<string | null>(null);
  let uploadError = $state<string | null>(null);
  let failedGlyphFiles = $state<Record<string, boolean>>({});
  
  // Get all glyphs grouped by type
  const glyphsByType = $derived({
    planet: Object.values(glyphs).filter(g => g.type === 'planet'),
    zodiac: Object.values(glyphs).filter(g => g.type === 'zodiac'),
    custom: Object.values(glyphs).filter(g => g.isCustom),
  });
  
  function handleFileUpload(event: Event, glyphId: string) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    
    // Validate it's an SVG
    if (!file.name.endsWith('.svg') && !file.type.includes('svg')) {
      uploadError = 'Please upload an SVG file';
      return;
    }
    
    uploadError = null;
    
    // Read file content
    const reader = new FileReader();
    reader.onload = (e) => {
      const svgContent = e.target?.result as string;
      if (svgContent) {
        const glyph = getGlyph(glyphId);
        setCustomGlyph(
          glyphId,
          glyph?.name || glyphId,
          svgContent,
          glyph?.type || 'custom',
          file.name
        );
        selectedGlyphId = null;
      }
    };
    reader.onerror = () => {
      uploadError = 'Failed to read file';
    };
    reader.readAsText(file);
  }
  
  function resetGlyph(glyphId: string) {
    resetGlyphToDefault(glyphId);
  }
</script>

{#snippet glyphManagerContent()}
  {#if uploadError}
    <div class="text-sm text-destructive mb-4">{uploadError}</div>
  {/if}
  
  <!-- Planets -->
  <div class="mb-6">
    <h3 class="text-sm font-semibold mb-3">Planets</h3>
    <div class="flex flex-wrap gap-2">
      {#each glyphsByType.planet as glyph}
        {@const glyphView = getGlyphContent(glyph.id)}
        <div class="flex items-center justify-between p-2 border rounded grow basis-[260px] min-w-[240px]">
          <div class="flex items-center gap-2">
            {#if glyphView.type === 'svg'}
              <span class="inline-block w-6 h-6">{@html glyphView.content}</span>
            {:else if glyphView.type === 'file'}
              {#if failedGlyphFiles[`p:${glyph.id}:${glyphView.content}`]}
                <span class="text-2xl">{glyphView.fallback || glyph.name.charAt(0).toUpperCase()}</span>
              {:else}
                <img
                  src={glyphView.content}
                  alt={glyph.name}
                  style={`width:${glyphView.size}px;height:${glyphView.size}px;`}
                  onerror={() => {
                    failedGlyphFiles[`p:${glyph.id}:${glyphView.content}`] = true;
                    failedGlyphFiles = { ...failedGlyphFiles };
                  }}
                />
              {/if}
            {:else}
              <span class="text-2xl">{glyphView.content}</span>
            {/if}
            <span class="text-sm">{glyph.name}</span>
            {#if glyph.isCustom}
              <span class="text-xs text-muted-foreground">(custom)</span>
            {/if}
          </div>
          <div class="flex gap-1">
            <label class="cursor-pointer">
              <Input
                type="file"
                accept=".svg,image/svg+xml"
                class="hidden"
                onchange={(e) => handleFileUpload(e, glyph.id)}
              />
              <Button variant="ghost" size="sm" type="button">Upload</Button>
            </label>
            {#if glyph.isCustom}
              <Button variant="ghost" size="sm" onclick={() => resetGlyph(glyph.id)}>Reset</Button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </div>
  
  <!-- Zodiac Signs -->
  <div class="mb-6">
    <h3 class="text-sm font-semibold mb-3">Zodiac Signs</h3>
    <div class="flex flex-wrap gap-2">
      {#each glyphsByType.zodiac as glyph}
        {@const glyphView = getGlyphContent(glyph.id)}
        <div class="flex items-center justify-between p-2 border rounded grow basis-[260px] min-w-[240px]">
          <div class="flex items-center gap-2">
            {#if glyphView.type === 'svg'}
              <span class="inline-block w-6 h-6">{@html glyphView.content}</span>
            {:else if glyphView.type === 'file'}
              {#if failedGlyphFiles[`z:${glyph.id}:${glyphView.content}`]}
                <span class="text-2xl">{glyphView.fallback || glyph.name.charAt(0).toUpperCase()}</span>
              {:else}
                <img
                  src={glyphView.content}
                  alt={glyph.name}
                  style={`width:${glyphView.size}px;height:${glyphView.size}px;`}
                  onerror={() => {
                    failedGlyphFiles[`z:${glyph.id}:${glyphView.content}`] = true;
                    failedGlyphFiles = { ...failedGlyphFiles };
                  }}
                />
              {/if}
            {:else}
              <span class="text-2xl">{glyphView.content}</span>
            {/if}
            <span class="text-sm">{glyph.name}</span>
            {#if glyph.isCustom}
              <span class="text-xs text-muted-foreground">(custom)</span>
            {/if}
          </div>
          <div class="flex gap-1">
            <label class="cursor-pointer">
              <Input
                type="file"
                accept=".svg,image/svg+xml"
                class="hidden"
                onchange={(e) => handleFileUpload(e, glyph.id)}
              />
              <Button variant="ghost" size="sm" type="button">Upload</Button>
            </label>
            {#if glyph.isCustom}
              <Button variant="ghost" size="sm" onclick={() => resetGlyph(glyph.id)}>Reset</Button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </div>
{/snippet}

{#if embedded}
  <div class="space-y-3 rounded-md border p-3 max-h-[56vh] overflow-auto">
    <div class="text-sm font-medium opacity-90">Glyphs management</div>
    <div class="text-xs text-muted-foreground">
      Upload custom SVG glyphs to replace default symbols.
    </div>
    {@render glyphManagerContent()}
  </div>
{:else}
  <Dialog.Root bind:open>
    <Dialog.Trigger>
      <Button variant="outline" size="sm">Manage Glyphs</Button>
    </Dialog.Trigger>
    <Dialog.Content class="max-w-2xl max-h-[80vh] overflow-y-auto">
      <Dialog.Header>
        <Dialog.Title>Glyph Management</Dialog.Title>
        <Dialog.Description>
          Upload custom SVG glyphs to replace default symbols. SVG files only.
        </Dialog.Description>
      </Dialog.Header>
      {@render glyphManagerContent()}
      <Dialog.Footer>
        <Button onclick={() => open = false}>Close</Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
{/if}
