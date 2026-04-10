<!-- Aspect Grid Component - Triangular aspect table -->
<script lang="ts">
  import { effectiveTime } from '$lib/stores/timeNavigation.svelte';
  import { getGlyphContent } from '$lib/stores/glyphs.svelte';
  
  // Props
  interface Props {
    size?: number;
    planetPositions?: Record<string, { degrees: number; sign: string; house?: number }>;
    aspects?: Array<{
      from: string;
      to: string;
      type: 'conjunction' | 'sextile' | 'square' | 'trine' | 'quincunx' | 'opposition';
      orb: number;
      applying?: boolean;
    }>;
  }
  
  let { 
    size = 800,
    planetPositions = {},
    aspects = []
  }: Props = $props();
  
  // Default planet positions if not provided (sign = glyph id for settings-controlled display)
  const defaultPlanets = $derived({
    sun: { degrees: 258, sign: 'sagittarius', house: 12 },
    moon: { degrees: 253, sign: 'sagittarius', house: 12 },
    mercury: { degrees: 265, sign: 'sagittarius', house: 12 },
    venus: { degrees: 266, sign: 'sagittarius', house: 12 },
    mars: { degrees: 153, sign: 'virgo', house: 5 },
    jupiter: { degrees: 13, sign: 'aries', house: 9 },
    saturn: { degrees: 323, sign: 'aquarius', house: 1 },
    uranus: { degrees: 151, sign: 'virgo', house: 5 },
    neptune: { degrees: 223, sign: 'scorpio', house: 8 },
    pluto: { degrees: 159, sign: 'virgo', house: 5 },
    meanNode: { degrees: 112, sign: 'cancer', house: 4 },
    chiron: { degrees: 344, sign: 'pisces', house: 2 }
  });
  
  const planets = $derived<Record<string, { degrees: number; sign: string; house?: number }>>({
    ...defaultPlanets,
    ...planetPositions
  });
  
  // Default aspects if not provided
  const defaultAspects = $derived([
    { from: 'sun', to: 'moon', type: 'square' as const, orb: 3, applying: false },
    { from: 'sun', to: 'mars', type: 'square' as const, orb: 0, applying: true },
    { from: 'sun', to: 'jupiter', type: 'square' as const, orb: 4, applying: false },
    { from: 'moon', to: 'mars', type: 'square' as const, orb: 0, applying: true },
    { from: 'mars', to: 'jupiter', type: 'sextile' as const, orb: 2, applying: false },
    { from: 'jupiter', to: 'saturn', type: 'trine' as const, orb: 3, applying: true },
    { from: 'saturn', to: 'uranus', type: 'sextile' as const, orb: 1, applying: false },
    { from: 'uranus', to: 'pluto', type: 'square' as const, orb: 0, applying: true },
    { from: 'neptune', to: 'pluto', type: 'sextile' as const, orb: 1, applying: false },
    { from: 'mars', to: 'meanNode', type: 'quincunx' as const, orb: 0, applying: false },
    { from: 'jupiter', to: 'meanNode', type: 'square' as const, orb: 2, applying: true },
    { from: 'neptune', to: 'meanNode', type: 'trine' as const, orb: 2, applying: false },
    { from: 'sun', to: 'chiron', type: 'square' as const, orb: 1, applying: true },
    { from: 'moon', to: 'chiron', type: 'square' as const, orb: 1, applying: true }
  ]);
  
  const allAspects = $derived(aspects.length > 0 ? aspects : defaultAspects);
  
  // Planet order for display
  const planetOrder = [
    'sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 
    'saturn', 'uranus', 'neptune', 'pluto', 'meanNode', 'chiron'
  ];
  
  // Filter to only planets that have positions
  const visiblePlanets = $derived(planetOrder.filter(p => planets[p]));
  
  // Get aspect symbol and color
  function getAspectSymbol(type: string): { symbol: string; color: string; bgColor: string } {
    switch (type) {
      case 'conjunction':
        return { symbol: '☌', color: '#60a5fa', bgColor: 'bg-blue-500/10' };
      case 'sextile':
        return { symbol: '*', color: '#22c55e', bgColor: 'bg-green-500/10' };
      case 'square':
        return { symbol: '□', color: '#ef4444', bgColor: 'bg-red-500/10' };
      case 'trine':
        return { symbol: '△', color: '#22c55e', bgColor: 'bg-green-500/10' };
      case 'quincunx':
        return { symbol: '∠', color: '#f59e0b', bgColor: 'bg-amber-500/10' };
      case 'opposition':
        return { symbol: '☍', color: '#ef4444', bgColor: 'bg-red-500/10' };
      default:
        return { symbol: '', color: '#888', bgColor: '' };
    }
  }
  
  // Get aspect between two planets
  function getAspect(from: string, to: string): typeof allAspects[0] | null {
    return allAspects.find(a => 
      (a.from === from && a.to === to) || 
      (a.from === to && a.to === from)
    ) || null;
  }
  
  let failedGlyphFiles = $state<Record<string, boolean>>({});
  
  // Format orb display
  function formatOrb(orb: number, applying?: boolean): string {
    const orbStr = Math.abs(orb).toFixed(0);
    const direction = applying === true ? 'A' : applying === false ? 'S' : '';
    return `${orbStr}${direction}`;
  }
</script>

<div class="w-full h-full overflow-auto p-4">
  <div class="inline-block min-w-full">
    <table class="w-full border-collapse text-sm">
      <thead>
        <tr>
          <!-- Empty corner cell -->
          <th class="sticky top-0 left-0 z-20 h-12 w-12 bg-muted/50 border-r border-b border-border"></th>
          <!-- Top header row (planet glyphs) -->
          {#each visiblePlanets as planetId}
            {@const glyph = getGlyphContent(planetId)}
            <th class="sticky top-0 z-10 h-12 w-16 bg-muted/50 border-b border-border px-2 text-center align-middle">
              {#if glyph.type === 'svg'}
                <span class="inline-block w-6 h-6" style="vertical-align: middle;">
                  {@html glyph.content}
                </span>
              {:else if glyph.type === 'file'}
                {#if failedGlyphFiles[`top:${planetId}:${glyph.content}`]}
                  <span class="text-lg font-medium">{glyph.fallback || planetId.charAt(0).toUpperCase()}</span>
                {:else}
                  <img
                    src={glyph.content}
                    alt={planetId}
                    style={`width:${glyph.size}px;height:${glyph.size}px;vertical-align:middle;`}
                    onerror={() => {
                      failedGlyphFiles[`top:${planetId}:${glyph.content}`] = true;
                      failedGlyphFiles = { ...failedGlyphFiles };
                    }}
                  />
                {/if}
              {:else}
                <span class="text-lg font-medium">
                  {glyph.content || planetId.charAt(0).toUpperCase()}
                </span>
              {/if}
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each visiblePlanets as fromPlanet, rowIndex}
          {@const fromGlyph = getGlyphContent(fromPlanet)}
          <tr>
            <!-- Left header column (planet glyph) -->
            <th class="sticky left-0 z-10 h-12 w-12 bg-muted/50 border-r border-border px-2 text-center align-middle">
              {#if fromGlyph.type === 'svg'}
                <span class="inline-block w-6 h-6" style="vertical-align: middle;">
                  {@html fromGlyph.content}
                </span>
              {:else if fromGlyph.type === 'file'}
                {#if failedGlyphFiles[`left:${fromPlanet}:${fromGlyph.content}`]}
                  <span class="text-lg font-medium">{fromGlyph.fallback || fromPlanet.charAt(0).toUpperCase()}</span>
                {:else}
                  <img
                    src={fromGlyph.content}
                    alt={fromPlanet}
                    style={`width:${fromGlyph.size}px;height:${fromGlyph.size}px;vertical-align:middle;`}
                    onerror={() => {
                      failedGlyphFiles[`left:${fromPlanet}:${fromGlyph.content}`] = true;
                      failedGlyphFiles = { ...failedGlyphFiles };
                    }}
                  />
                {/if}
              {:else}
                <span class="text-lg font-medium">
                  {fromGlyph.content || fromPlanet.charAt(0).toUpperCase()}
                </span>
              {/if}
            </th>
            
            <!-- Aspect cells (triangular - only show below diagonal) -->
            {#each visiblePlanets as toPlanet, colIndex}
              {#if colIndex < rowIndex}
                {@const aspect = getAspect(fromPlanet, toPlanet)}
                {#if aspect}
                  {@const aspectInfo = getAspectSymbol(aspect.type)}
                  <td class="h-12 w-16 border-b border-r border-border/50 px-1 text-center align-middle hover:bg-accent/50 transition-colors {aspectInfo.bgColor}">
                    <div class="flex flex-col items-center justify-center gap-0.5">
                      <span 
                        class="text-base font-bold leading-none"
                        style="color: {aspectInfo.color};"
                      >
                        {aspectInfo.symbol}
                      </span>
                      <span class="text-[10px] leading-tight opacity-70 font-mono">
                        {formatOrb(aspect.orb, aspect.applying)}
                      </span>
                    </div>
                  </td>
                {:else}
                  <td class="h-12 w-16 border-b border-r border-border/30 px-1"></td>
                {/if}
              {:else if colIndex === rowIndex}
                <!-- Diagonal cells (empty) -->
                <td class="h-12 w-16 border-b border-r border-border/30 bg-muted/20"></td>
              {:else}
                <!-- Above diagonal (empty) -->
                <td class="h-12 w-16 border-b border-r border-border/30"></td>
              {/if}
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
