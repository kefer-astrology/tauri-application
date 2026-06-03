<script lang="ts">
  import { DEFAULT_ASPECT_COLORS, type AspectRowId } from '$lib/astrology/aspects';
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

  const defaultAspects = $derived<AspectMatrixAspect[]>([
    { from: 'sun', to: 'moon', type: 'square', orb: 3, applying: false },
    { from: 'sun', to: 'mars', type: 'square', orb: 0, applying: true },
    { from: 'sun', to: 'jupiter', type: 'square', orb: 4, applying: false },
    { from: 'moon', to: 'mars', type: 'square', orb: 0, applying: true },
    { from: 'mars', to: 'jupiter', type: 'sextile', orb: 2, applying: false },
    { from: 'jupiter', to: 'saturn', type: 'trine', orb: 3, applying: true },
    { from: 'saturn', to: 'uranus', type: 'sextile', orb: 1, applying: false },
    { from: 'uranus', to: 'pluto', type: 'square', orb: 0, applying: true },
    { from: 'neptune', to: 'pluto', type: 'sextile', orb: 1, applying: false },
    { from: 'mars', to: 'meanNode', type: 'quincunx', orb: 0, applying: false },
    { from: 'jupiter', to: 'meanNode', type: 'square', orb: 2, applying: true },
    { from: 'neptune', to: 'meanNode', type: 'trine', orb: 2, applying: false },
    { from: 'sun', to: 'chiron', type: 'square', orb: 1, applying: true },
    { from: 'moon', to: 'chiron', type: 'square', orb: 1, applying: true }
  ]);

  const planets = $derived<Record<string, { degrees: number; sign: string; house?: number }>>({
    ...defaultPlanets,
    ...planetPositions
  });
  const allAspects = $derived(aspects.length > 0 ? aspects : defaultAspects);
  const planetOrder = [
    'sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter',
    'saturn', 'uranus', 'neptune', 'pluto', 'meanNode', 'chiron'
  ];
  const visiblePlanets = $derived(planetOrder.filter((planet) => planets[planet]));

  const aspectSymbols: Record<AspectRowId, string> = {
    conjunction: '☌',
    sextile: '*',
    square: '□',
    trine: '△',
    quincunx: '∠',
    opposition: '☍'
  };

  function getAspectSymbol(type: AspectRowId): { symbol: string; color: string } {
    return {
      symbol: aspectSymbols[type],
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
                  {@const aspectInfo = getAspectSymbol(aspect.type)}
                  <TableCell class="h-12 w-16 border-b border-r border-border/50 bg-[color:var(--token-surface-subtle)] px-1 text-center align-middle transition-colors hover:bg-accent/50">
                    <div class="flex flex-col items-center justify-center gap-0.5">
                      <span class="text-base font-bold leading-none" style={`color:${aspectInfo.color};`}>
                        {aspectInfo.symbol}
                      </span>
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
