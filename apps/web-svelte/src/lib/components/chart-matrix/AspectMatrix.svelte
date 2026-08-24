<script lang="ts">
  import { DEFAULT_ASPECT_COLORS, type AspectRowId } from '$lib/astrology/aspects';
  import { getGlyphContent } from '$lib/stores/glyphs.svelte';
  import Table from '../ui/table/table.svelte';
  import TableBody from '../ui/table/table-body.svelte';
  import TableCell from '../ui/table/table-cell.svelte';
  import TableHead from '../ui/table/table-head.svelte';
  import TableHeader from '../ui/table/table-header.svelte';
  import TableRow from '../ui/table/table-row.svelte';
  import ChartMatrixGlyph from './ChartMatrixGlyph.svelte';

  interface AspectMatrixAspect {
    from: string;
    to: string;
    type: AspectRowId;
    orb: number;
    applying?: boolean;
  }

  interface Props {
    size?: number;
    planetPositions?: Record<string, { degrees: number; sign: string; house?: number }>;
    aspects?: AspectMatrixAspect[];
    aspectColors?: Record<string, string>;
  }

  let {
    size = 800,
    planetPositions = {},
    aspects = [],
    aspectColors = {}
  }: Props = $props();

  const planets = $derived<Record<string, { degrees: number; sign: string; house?: number }>>(
    planetPositions
  );
  const allAspects = $derived(aspects);
  const planetOrder = [
    'sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter',
    'saturn', 'uranus', 'neptune', 'pluto', 'meanNode', 'chiron'
  ];
  const visiblePlanets = $derived(planetOrder.filter((planet) => planets[planet]));

  function getAspectGlyph(type: AspectRowId) {
    return {
      glyph: getGlyphContent(type),
      color: aspectColors[type] ?? DEFAULT_ASPECT_COLORS[type] ?? 'var(--token-viz-2)'
    };
  }

  function getAspect(from: string, to: string): AspectMatrixAspect | null {
    return allAspects.find((aspect) =>
      (aspect.from === from && aspect.to === to) ||
      (aspect.from === to && aspect.to === from)
    ) ?? null;
  }

  function formatOrb(orb: number, applying?: boolean): string {
    const orbStr = Math.abs(orb).toFixed(0);
    const direction = applying === true ? 'A' : applying === false ? 'S' : '';
    return `${orbStr}${direction}`;
  }
</script>

<div class="h-full w-full overflow-auto p-4" style={`max-width:${size}px;`}>
  <div class="inline-block min-w-full">
    <Table class="w-full border-collapse text-sm">
      <TableHeader>
        <TableRow>
          <TableHead class="sticky left-0 top-0 z-20 h-12 w-12 border-b border-r bg-muted/50"></TableHead>
          {#each visiblePlanets as planetId}
            <TableHead class="sticky top-0 z-10 h-12 w-16 border-b bg-muted/50 px-2 text-center align-middle">
              <ChartMatrixGlyph glyphId={planetId} context="top" size={24} />
            </TableHead>
          {/each}
        </TableRow>
      </TableHeader>
      <TableBody>
        {#each visiblePlanets as fromPlanet, rowIndex}
          <TableRow>
            <TableHead class="sticky left-0 z-10 h-12 w-12 border-r bg-muted/50 px-2 text-center align-middle">
              <ChartMatrixGlyph glyphId={fromPlanet} context="left" size={24} />
            </TableHead>
            {#each visiblePlanets as toPlanet, colIndex}
              {#if colIndex < rowIndex}
                {@const aspect = getAspect(fromPlanet, toPlanet)}
                {#if aspect}
                  {@const aspectInfo = getAspectGlyph(aspect.type)}
                  <TableCell class="h-12 w-16 border-b border-r border-border/50 bg-[color:var(--token-surface-subtle)] px-1 text-center align-middle transition-colors hover:bg-accent/50">
                    <div class="flex flex-col items-center justify-center gap-0.5">
                      {#if aspectInfo.glyph.type === 'file'}
                        <span
                          class="inline-block h-4 w-4"
                          style={`background-color:${aspectInfo.color}; mask-image:url(${aspectInfo.glyph.content}); mask-repeat:no-repeat; mask-position:center; mask-size:contain; -webkit-mask-image:url(${aspectInfo.glyph.content}); -webkit-mask-repeat:no-repeat; -webkit-mask-position:center; -webkit-mask-size:contain;`}
                        ></span>
                      {:else if aspectInfo.glyph.type === 'svg'}
                        <span class="inline-block h-4 w-4" style={`color:${aspectInfo.color};`}>{@html aspectInfo.glyph.content}</span>
                      {:else}
                        <span class="text-base font-bold leading-none" style={`color:${aspectInfo.color};`}>
                          {aspectInfo.glyph.content}
                        </span>
                      {/if}
                      <span class="font-mono text-[10px] leading-tight opacity-70">
                        {formatOrb(aspect.orb, aspect.applying)}
                      </span>
                    </div>
                  </TableCell>
                {:else}
                  <TableCell class="h-12 w-16 border-b border-r border-border/30 px-1"></TableCell>
                {/if}
              {:else if colIndex === rowIndex}
                <TableCell class="h-12 w-16 border-b border-r border-border/30 bg-muted/20"></TableCell>
              {:else}
                <TableCell class="h-12 w-16 border-b border-r border-border/30"></TableCell>
              {/if}
            {/each}
          </TableRow>
        {/each}
      </TableBody>
    </Table>
  </div>
</div>
