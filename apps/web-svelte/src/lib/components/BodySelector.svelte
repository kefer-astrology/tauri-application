<!-- Body Selector Component - Grid of checkboxes with astrological bodies organized by categories -->
<script lang="ts">
  import { glyphs } from '$lib/stores/glyphs.svelte';
  import { getGlyphContent } from '$lib/stores/glyphs.svelte';
  import { Button } from '$lib/components/ui/button/index.js';
  
  interface Body {
    id: string;
    name: string;
    category: string;
  }
  
  interface Props {
    selectedBodies?: string[];
    onSelectionChange?: (selected: string[]) => void;
  }
  
  let { 
    selectedBodies = $bindable([]),
    onSelectionChange
  }: Props = $props();
  let failedGlyphFiles = $state<Record<string, boolean>>({});
  
  // Body definitions organized by category
  const bodyCategories = [
    {
      name: 'Luminaries',
      bodies: [
        { id: 'sun', name: 'Sun' },
        { id: 'moon', name: 'Moon' }
      ]
    },
    {
      name: 'Lunar Nodes',
      bodies: [
        { id: 'meanNode', name: 'Lunar Mean Nodes' },
        { id: 'trueNode', name: 'Lunar True Nodes' }
      ]
    },
    {
      name: 'Personal Planets',
      bodies: [
        { id: 'mercury', name: 'Mercury' },
        { id: 'venus', name: 'Venus' },
        { id: 'mars', name: 'Mars' }
      ]
    },
    {
      name: 'Lunar Apsides',
      bodies: [
        { id: 'blackMoonMean', name: 'Black Moon (Mean)' },
        { id: 'blackMoonNatural', name: 'Black Moon (Natural)' },
        { id: 'blackMoonOsculating', name: 'Black Moon (Osculating)' }
      ]
    },
    {
      name: 'Social Planets',
      bodies: [
        { id: 'jupiter', name: 'Jupiter' },
        { id: 'saturn', name: 'Saturn' }
      ]
    },
    {
      name: 'Centaurs',
      bodies: [
        { id: 'chiron', name: 'Chiron' },
        { id: 'pholus', name: 'Pholus' }
      ]
    },
    {
      name: 'Transpersonal Planets',
      bodies: [
        { id: 'uranus', name: 'Uranus' },
        { id: 'neptune', name: 'Neptune' },
        { id: 'pluto', name: 'Pluto' }
      ]
    },
    {
      name: 'Asteroids',
      bodies: [
        { id: 'ceres', name: 'Ceres' },
        { id: 'pallas', name: 'Pallas' },
        { id: 'juno', name: 'Juno' },
        { id: 'vesta', name: 'Vesta' }
      ]
    }
  ];
  
  // Category expanded state
  let categoryExpanded = $state<Record<string, boolean>>({
    'Luminaries': true,
    'Lunar Nodes': false,
    'Personal Planets': true,
    'Lunar Apsides': false,
    'Social Planets': true,
    'Centaurs': false,
    'Transpersonal Planets': true,
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
