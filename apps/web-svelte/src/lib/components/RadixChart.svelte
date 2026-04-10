<!-- Radix Chart Component - Interactive SVG polar chart -->
<script lang="ts">
  import { effectiveTime } from '$lib/stores/timeNavigation.svelte';
  import { glyphs, getGlyphContent } from '$lib/stores/glyphs.svelte';
  
  // Props
  interface Props {
    size?: number;
    planetPositions?: Record<string, { degrees: number; sign: string; house?: number }>; // planet -> position data
    houseCusps?: number[]; // 12 house cusp positions in degrees (0-360)
    aspects?: Array<{ from: string; to: string; type: 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition' }>;
    infoBlobs?: Array<{ degrees: number; content: string }>; // 3 information blobs
  }
  
  let { 
    size = 400,
    planetPositions = {},
    houseCusps = [],
    aspects = [],
    infoBlobs = []
  }: Props = $props();
  let failedGlyphFiles = $state<Record<string, boolean>>({});
  
  // Default info blobs if not provided (3 blobs at 120-degree intervals)
  const defaultInfoBlobs = $derived(
    infoBlobs.length > 0
      ? infoBlobs
      : [
          { degrees: 0, content: 'Info 1' },
          { degrees: 120, content: 'Info 2' },
          { degrees: 240, content: 'Info 3' }
        ]
  );
  
  // Reactive to time changes
  const currentTime = $derived(effectiveTime());
  
  // Chart dimensions – percentage from outer to center: 9% houses, 3% second circle, 40% dark blue, rest inner
  const centerX = $derived(size / 2);
  const centerY = $derived(size / 2);
  const maxRadius = $derived(size * 0.48);

  // Radii as % of maxRadius: ~11% house ring, 4% second circle, dark blue, rest inner
  const outerBorderRadius = $derived(maxRadius);
  const housesOuter = $derived(maxRadius);
  const housesInner = $derived(maxRadius * 0.89);   // 11% house ring (wider)
  const zodiacStripOuter = $derived(maxRadius * 0.89);
  const zodiacStripInner = $derived(maxRadius * 0.85);  // 4% strip: 89% → 85%
  const darkBlueOuter = $derived(maxRadius * 0.85);
  const darkBlueInner = $derived(maxRadius * 0.54);
  const innerCircleRadius = $derived(maxRadius * 0.54);
  const centerDarkOuter = $derived(maxRadius * 0.18);
  const centerDarkInner = $derived(0);
  const aspectRadius = $derived(maxRadius * 0.14);
  const planetGlyphRadius = $derived(maxRadius * 0.76);
  const angleTextRadius = $derived(maxRadius * 0.65);
  const degreeTextRadius = $derived(maxRadius * 0.60); // kept for compatibility (single label uses angleTextRadius)
  const partSize = $derived(maxRadius * 0.04);
  // House sign glyphs: sized for readability, placed just inside dark blue (so they’re visible)
  const zodiacStripGlyphSize = $derived(Math.max(14, partSize * 2));
  const zodiacStripGlyphRadius = $derived(housesOuter - partSize * 1.15);

  // Outer circle: 4 elements (fire, earth, air, water) – colors from CSS vars (Settings > Vzhled)
  const ELEMENT_VARS = ['var(--element-fire)', 'var(--element-earth)', 'var(--element-air)', 'var(--element-water)'] as const;
  const ringColorIndex = (segmentIndex: number) => segmentIndex % 4;
  const zodiacColor = (signIndex: number) => ELEMENT_VARS[ringColorIndex(signIndex)];
  const houseColor = (houseIndex: number) => ELEMENT_VARS[ringColorIndex(houseIndex)];

  // Zodiac sign names in order (Aries 0° = index 1)
  const zodiacSignNames = ['pisces', 'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius'];
  const signNameFromDegree = (deg: number) => zodiacSignNames[(Math.floor(((deg % 360) + 360) % 360 / 30) + 1) % 12];

  // Default house cusps (every 30 degrees if not provided)
  const defaultHouseCusps = $derived(
    houseCusps.length === 12 
      ? houseCusps 
      : Array.from({ length: 12 }, (_, i) => i * 30)
  );
  
  // Default planet positions if not provided (fallback only)
  const defaultPlanets = $derived({
    sun: { degrees: 120, sign: 'aquarius', house: 12 },
    moon: { degrees: 45, sign: 'aquarius', house: 10 },
    mercury: { degrees: 100, sign: 'aquarius', house: 8 },
    venus: { degrees: 200, sign: 'aquarius', house: 6 },
    mars: { degrees: 300, sign: 'aquarius', house: 4 },
    jupiter: { degrees: 40, sign: 'aquarius', house: 2 }
  });
  
  // Use provided positions if available, otherwise use defaults
  const planets = $derived<Record<string, { degrees: number; sign: string; house?: number }>>(
    Object.keys(planetPositions).length > 0
      ? planetPositions
      : defaultPlanets
  );
  
  // Convert degrees to radians
  function degToRad(deg: number): number {
    return (deg - 90) * (Math.PI / 180); // -90 to start at top
  }
  
  // Convert degrees to SVG coordinates
  function polarToCartesian(radius: number, degrees: number): { x: number; y: number } {
    const rad = degToRad(degrees);
    return {
      x: centerX + radius * Math.cos(rad),
      y: centerY + radius * Math.sin(rad)
    };
  }
  
  // Create arc path for zodiac sections
  function createArc(startDeg: number, endDeg: number, innerR: number, outerR: number): string {
    const startRad = degToRad(startDeg);
    const endRad = degToRad(endDeg);
    const startInner = polarToCartesian(innerR, startDeg);
    const endInner = polarToCartesian(innerR, endDeg);
    const startOuter = polarToCartesian(outerR, startDeg);
    const endOuter = polarToCartesian(outerR, endDeg);
    
    const largeArc = endDeg - startDeg > 180 ? 1 : 0;
    
    return `M ${startInner.x} ${startInner.y} 
            L ${startOuter.x} ${startOuter.y} 
            A ${outerR} ${outerR} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y}
            L ${endInner.x} ${endInner.y}
            A ${innerR} ${innerR} 0 ${largeArc} 0 ${startInner.x} ${startInner.y} Z`;
  }
  
  
  // Get aspect line color
  function getAspectColor(type: string): string {
    switch (type) {
      case 'square':
      case 'opposition':
        return '#ef4444'; // red - challenging
      case 'trine':
      case 'sextile':
        return '#22c55e'; // green - harmonious
      case 'conjunction':
      default:
        return '#60a5fa'; // light blue - minor
    }
  }
  
  // Format planet degree display (precise angle)
  function formatPreciseAngle(planet: { degrees: number; sign: string }): string {
    const signDeg = planet.degrees % 30;
    const minutes = Math.floor((signDeg % 1) * 60);
    return `${Math.floor(signDeg)}° ${minutes}'`;
  }

  // SVG element reference
  let svgElement: SVGElement | undefined;
</script>

<svg
  bind:this={svgElement}
  width={size}
  height={size}
  viewBox={`0 0 ${size} ${size}`}
  class="radix-chart"
  xmlns="http://www.w3.org/2000/svg"
>
  <!-- Part 1: Outer border (narrow) -->
  <circle
    cx={centerX}
    cy={centerY}
    r={outerBorderRadius}
    fill="none"
    stroke="rgba(135, 206, 235, 0.65)"
    stroke-width={partSize * 0.15}
  />

  <!-- 5% Houses ring (outermost) -->
  {#each defaultHouseCusps as cusp, i}
    {@const nextCusp = defaultHouseCusps[(i + 1) % 12] ?? cusp + 30}
    {@const startDeg = cusp}
    {@const endDeg = nextCusp < cusp ? nextCusp + 360 : nextCusp}
    {@const span = endDeg - startDeg}
    {@const color = houseColor(i)}
    {@const sub1 = startDeg}
    {@const sub2 = startDeg + span / 3}
    {@const sub3 = startDeg + (span * 2) / 3}
    {@const sub4 = endDeg}
    <path d={createArc(sub1, sub2, housesInner, housesOuter)} fill={color} fill-opacity="0.85" stroke="rgba(135, 206, 235, 0.4)" stroke-width="0.25" />
    <path d={createArc(sub2, sub3, housesInner, housesOuter)} fill={color} fill-opacity="0.85" stroke="rgba(135, 206, 235, 0.4)" stroke-width="0.25" />
    <path d={createArc(sub3, sub4, housesInner, housesOuter)} fill={color} fill-opacity="0.85" stroke="rgba(135, 206, 235, 0.4)" stroke-width="0.25" />
  {/each}

  <!-- 40% Dark blue band (main chart area) -->
  <defs>
    <mask id="darkBlueRingMask">
      <rect width={size} height={size} fill="white"/>
      <circle cx={centerX} cy={centerY} r={darkBlueInner} fill="black"/>
    </mask>
  </defs>
  <circle cx={centerX} cy={centerY} r={darkBlueOuter} fill="rgba(30, 58, 95, 0.8)" stroke="none" mask="url(#darkBlueRingMask)" />

  <!-- Second outer circle – divided into 3 parts per house, signed I. II. III. -->
  {#each defaultHouseCusps as cusp, i}
    {@const nextCusp = defaultHouseCusps[(i + 1) % 12] ?? cusp + 30}
    {@const startDeg = cusp}
    {@const endDeg = nextCusp < cusp ? nextCusp + 360 : nextCusp}
    {@const span = endDeg - startDeg}
    {@const signIdx = (Math.floor(((cusp % 360) + 360) % 360 / 30) + 1) % 12}
    {@const sub1 = startDeg}
    {@const sub2 = startDeg + span / 3}
    {@const sub3 = startDeg + (span * 2) / 3}
    {@const sub4 = endDeg}
    {@const segmentColor = houseColor(i)}
    <path d={createArc(sub1, sub2, zodiacStripInner, zodiacStripOuter)} fill={segmentColor} fill-opacity="1" stroke="rgba(135, 206, 235, 0.5)" stroke-width="0.6" />
    <path d={createArc(sub2, sub3, zodiacStripInner, zodiacStripOuter)} fill={segmentColor} fill-opacity="1" stroke="rgba(135, 206, 235, 0.5)" stroke-width="0.6" />
    <path d={createArc(sub3, sub4, zodiacStripInner, zodiacStripOuter)} fill={segmentColor} fill-opacity="1" stroke="rgba(135, 206, 235, 0.5)" stroke-width="0.6" />
    {@const partLabels = ['I.', 'II.', 'III.']}
    {#each [sub1, sub2, sub3] as subStart, partIndex}
      {@const subEnd = partIndex === 0 ? sub2 : partIndex === 1 ? sub3 : sub4}
      {@const partCenterDeg = subStart + (subEnd - subStart) / 2}
      {@const labelPos = polarToCartesian((zodiacStripInner + zodiacStripOuter) / 2, partCenterDeg)}
      <text
        x={labelPos.x}
        y={labelPos.y}
        text-anchor="middle"
        dominant-baseline="middle"
        font-size={Math.max(8, partSize * 0.55)}
        fill="currentColor"
        opacity="0.95"
      >
        {partLabels[partIndex]}
      </text>
    {/each}
    {@const centerDeg = startDeg + span / 2}
    {@const signName = signNameFromDegree(cusp)}
    {@const pos = polarToCartesian(zodiacStripGlyphRadius, centerDeg)}
    {@const glyphData = getGlyphContent(signName)}
    <g transform={`translate(${pos.x}, ${pos.y}) rotate(${centerDeg})`}>
      {#if glyphData.type === 'svg'}
        {@html glyphData.content}
      {:else if glyphData.type === 'file'}
        {#if failedGlyphFiles[`zstrip:${signName}:${glyphData.content}`]}
          <text x="0" y="0" text-anchor="middle" dominant-baseline="middle" font-size={zodiacStripGlyphSize} fill="currentColor" opacity="0.9">
            {glyphData.fallback || signName.slice(0, 2).toUpperCase()}
          </text>
        {:else}
          <image
            href={glyphData.content}
            x={-zodiacStripGlyphSize / 2}
            y={-zodiacStripGlyphSize / 2}
            width={zodiacStripGlyphSize}
            height={zodiacStripGlyphSize}
            opacity="0.95"
            onerror={() => {
              failedGlyphFiles[`zstrip:${signName}:${glyphData.content}`] = true;
              failedGlyphFiles = { ...failedGlyphFiles };
            }}
          />
        {/if}
      {:else}
        <text x="0" y="0" text-anchor="middle" dominant-baseline="middle" font-size={zodiacStripGlyphSize} fill="currentColor" opacity="0.9">
          {glyphData.content || signName.charAt(0).toUpperCase()}
        </text>
      {/if}
    </g>
  {/each}

  <!-- House cusp lines (from center to outer) -->
  {#each defaultHouseCusps as cusp}
    {@const outerPos = polarToCartesian(outerBorderRadius, cusp)}
    {@const innerPos = polarToCartesian(centerDarkOuter, cusp)}
    <line
      x1={innerPos.x}
      y1={innerPos.y}
      x2={outerPos.x}
      y2={outerPos.y}
      stroke="rgba(135, 206, 235, 0.5)"
      stroke-width="0.5"
    />
  {/each}
  
  <!-- Planets with all information (positions 3-6) -->
  {#each Object.entries(planets) as [planetName, planetData]}
    <!-- Position 3: Glyph of object (planet) -->
    {@const planetPos = polarToCartesian(planetGlyphRadius, planetData.degrees)}
    {@const planetGlyphData = getGlyphContent(planetName)}
    <g transform={`translate(${planetPos.x}, ${planetPos.y})`}>
      {#if planetGlyphData.type === 'svg'}
        <g class="planet-glyph" data-planet={planetName}>
          {@html planetGlyphData.content}
        </g>
      {:else if planetGlyphData.type === 'file'}
        {#if failedGlyphFiles[`planet:${planetName}:${planetGlyphData.content}`]}
          <text
            x="0"
            y="0"
            text-anchor="middle"
            dominant-baseline="middle"
            font-size={partSize * 0.7}
            fill="currentColor"
            class="planet-glyph"
            data-planet={planetName}
          >
            {planetGlyphData.fallback || planetName.slice(0, 2).toUpperCase()}
          </text>
        {:else}
          <image
            href={planetGlyphData.content}
            x={-planetGlyphData.size / 2}
            y={-planetGlyphData.size / 2}
            width={planetGlyphData.size}
            height={planetGlyphData.size}
            class="planet-glyph"
            data-planet={planetName}
            onerror={() => {
              failedGlyphFiles[`planet:${planetName}:${planetGlyphData.content}`] = true;
              failedGlyphFiles = { ...failedGlyphFiles };
            }}
          />
        {/if}
      {:else}
        <text
          x="0"
          y="0"
          text-anchor="middle"
          dominant-baseline="middle"
          font-size={partSize * 1.2}
          fill="currentColor"
          class="planet-glyph"
          data-planet={planetName}
        >
          {planetGlyphData.content || planetName.charAt(0).toUpperCase()}
        </text>
      {/if}
    </g>
    
    <!-- Degree/minute label (single line per planet) -->
    {@const anglePos = polarToCartesian(angleTextRadius, planetData.degrees)}
    <text
      x={anglePos.x}
      y={anglePos.y}
      text-anchor="middle"
      dominant-baseline="middle"
      font-size={Math.max(11, partSize * 1.35)}
      fill="currentColor"
      opacity="0.8"
    >
      {formatPreciseAngle(planetData)}
    </text>
  {/each}
  
  <!-- Rest: Inner circle (54% → 0) – single color -->
  <circle
    cx={centerX}
    cy={centerY}
    r={innerCircleRadius}
    fill="rgba(80, 80, 95, 0.55)"
    stroke="rgba(135, 206, 235, 0.45)"
    stroke-width="1"
  />

  <!-- Dark center (aspects) -->
  <circle
    cx={centerX}
    cy={centerY}
    r={centerDarkOuter}
    fill="rgba(0, 0, 0, 0.45)"
    stroke="rgba(135, 206, 235, 0.55)"
    stroke-width="1"
    opacity="0.6"
  />
  
  <!-- Aspect/Transit lines (inside dark center) -->
  {#each aspects as aspect}
    {@const fromPlanet = planets[aspect.from]}
    {@const toPlanet = planets[aspect.to]}
    {#if fromPlanet && toPlanet}
      {@const fromPos = polarToCartesian(aspectRadius, fromPlanet.degrees)}
      {@const toPos = polarToCartesian(aspectRadius, toPlanet.degrees)}
      <line
        x1={fromPos.x}
        y1={fromPos.y}
        x2={toPos.x}
        y2={toPos.y}
        stroke={getAspectColor(aspect.type)}
        stroke-width={partSize * 0.1}
        opacity="0.8"
      />
    {/if}
  {/each}
  
  <!-- Center point -->
  <circle
    cx={centerX}
    cy={centerY}
    r={partSize * 0.2}
    fill="currentColor"
    opacity="0.6"
  />
</svg>

<style>
  .radix-chart {
    max-width: 100%;
    max-height: 100%;
  }
  
  .planet-glyph {
    cursor: pointer;
    transition: opacity 0.2s;
  }
  
  .planet-glyph:hover {
    opacity: 0.7;
  }
</style>
