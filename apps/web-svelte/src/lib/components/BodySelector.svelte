<!-- Body Selector Component - Grid of checkboxes with astrological bodies organized by categories -->
<script lang="ts">
  import { getGlyphContent } from '$lib/stores/glyphs.svelte';
  import { Button } from '$lib/components/ui/button/index.js';
  import {
    OBSERVABLE_OBJECTS,
    OBSERVABLE_OBJECT_CATEGORY_LABELS,
    type ObservableObjectCategory
  } from '$lib/astrology/observableObjects';
  
  interface Props {
    selectedBodies?: string[];
    onSelectionChange?: (selected: string[]) => void | Promise<void>;
  }
  
  let { 
    selectedBodies = $bindable([]),
    onSelectionChange
  }: Props = $props();
  let failedGlyphFiles = $state<Record<string, boolean>>({});
  
  const categoryOrder: ObservableObjectCategory[] = [
    'luminaries',
    'personal_planets',
    'social_outer_planets',
    'angles',
    'lunar_nodes',
    'calculated_points',
    'asteroids'
  ];

  const bodyCategories = categoryOrder.map((category) => ({
    id: category,
    name: OBSERVABLE_OBJECT_CATEGORY_LABELS[category],
    bodies: OBSERVABLE_OBJECTS.filter((body) => body.category === category)
  }));
  
  // Category expanded state
  let categoryExpanded = $state<Record<string, boolean>>({
    'Luminaries': true,
    'Personal Planets': true,
    'Social and Outer Planets': true,
    'Angles': false,
    'Lunar Nodes': false,
    'Calculated Points': false,
    'Asteroids': false
  });
  
  function toggleCategory(categoryName: string) {
    categoryExpanded[categoryName] = !categoryExpanded[categoryName];
    categoryExpanded = { ...categoryExpanded };
  }
  
  function toggleBody(bodyId: string) {
    if (selectedBodies.includes(bodyId)) {
      selectedBodies = selectedBodies.filter(id => id !== bodyId);
    } else {
      selectedBodies = [...selectedBodies, bodyId];
    }
    onSelectionChange?.(selectedBodies);
  }
  
  function toggleCategorySelection(categoryName: string) {
    const category = bodyCategories.find(c => c.name === categoryName);
    if (!category) return;
    
    const categoryBodyIds = category.bodies.map(b => b.id);
    const allSelected = categoryBodyIds.every(id => selectedBodies.includes(id));
    
    if (allSelected) {
      // Deselect all in category
      selectedBodies = selectedBodies.filter(id => !categoryBodyIds.includes(id));
    } else {
      // Select all in category
      const newSelection = [...selectedBodies];
      categoryBodyIds.forEach(id => {
        if (!newSelection.includes(id)) {
          newSelection.push(id);
        }
      });
      selectedBodies = newSelection;
    }
    onSelectionChange?.(selectedBodies);
  }
  
  function isCategoryAllSelected(categoryName: string): boolean {
    const category = bodyCategories.find(c => c.name === categoryName);
    if (!category) return false;
    return category.bodies.every(b => selectedBodies.includes(b.id));
  }
</script>

<div class="space-y-2 text-sm">
  {#each bodyCategories as category}
    <div class="space-y-1">
      <!-- Category header -->
      <div class="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          class="flex items-center gap-2 hover:opacity-80 transition-opacity"
          onclick={() => toggleCategory(category.name)}
        >
          <input
            type="checkbox"
            class="w-4 h-4 rounded border border-foreground/30 bg-background text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2 cursor-pointer"
            checked={isCategoryAllSelected(category.name)}
            onchange={() => toggleCategorySelection(category.name)}
            onclick={(e) => e.stopPropagation()}
          />
          <span class="font-medium">{category.name}</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          class="ml-auto text-xs opacity-60 hover:opacity-100"
          onclick={() => toggleCategory(category.name)}
        >
          {categoryExpanded[category.name] ? '−' : '+'}
        </Button>
      </div>
      
      <!-- Category bodies -->
      {#if categoryExpanded[category.name]}
        <div class="pl-6 space-y-1">
          {#each category.bodies as body}
            {@const glyph = getGlyphContent(body.id)}
            <label class="flex items-center gap-2 cursor-pointer group hover:opacity-80 transition-opacity">
              <input
                type="checkbox"
                class="w-4 h-4 rounded border border-foreground/30 bg-background text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2 cursor-pointer"
                checked={selectedBodies.includes(body.id)}
                onchange={() => toggleBody(body.id)}
              />
              {#if glyph.type === 'svg'}
                <span class="inline-block w-5 h-5" style="vertical-align: middle;">
                  {@html glyph.content}
                </span>
              {:else if glyph.type === 'file'}
                {#if failedGlyphFiles[`${body.id}:${glyph.content}`]}
                  <span class="text-base">{glyph.fallback || body.id.charAt(0).toUpperCase()}</span>
                {:else}
                  <img
                    src={glyph.content}
                    alt={body.name}
                    style={`width:${glyph.size}px;height:${glyph.size}px;vertical-align:middle;`}
                    onerror={() => {
                      failedGlyphFiles[`${body.id}:${glyph.content}`] = true;
                      failedGlyphFiles = { ...failedGlyphFiles };
                    }}
                  />
                {/if}
              {:else}
                <span class="text-base">
                  {glyph.content || body.id.charAt(0).toUpperCase()}
                </span>
              {/if}
              <span class="text-sm">{body.name}</span>
            </label>
          {/each}
        </div>
      {/if}
    </div>
  {/each}
</div>
