<script lang="ts">
  import {
    DEFAULT_ASPECT_LINE_TIER_STYLE,
    DEFAULT_ASPECT_ORBS,
    type AspectLineTierStyleState
  } from '$lib/astrology/aspects';
  import { getGlyphContent } from '$lib/stores/glyphs.svelte';
  import { wheelStyleSettings } from '$lib/stores/wheel-style.svelte';

  interface Props {
    size?: number;
    planetPositions?: Record<string, { degrees: number; sign: string; house?: number }>;
    houseCusps?: number[];
    aspects?: Array<{
      from: string;
      to: string;
      type: 'conjunction' | 'sextile' | 'square' | 'trine' | 'quincunx' | 'opposition';
      orb?: number;
    }>;
    aspectColors?: Record<string, string>;
    aspectOrbs?: Record<string, number>;
    aspectLineTierStyle?: AspectLineTierStyleState;
  }

  let {
    size = 400,
    planetPositions = {},
    houseCusps = [],
    aspects = [],
    aspectColors = {},
    aspectOrbs = DEFAULT_ASPECT_ORBS,
    aspectLineTierStyle = DEFAULT_ASPECT_LINE_TIER_STYLE
  }: Props = $props();

  let failedGlyphFiles = $state<Record<string, boolean>>({});

  const VIEWBOX_SIZE = 800;
  const center = VIEWBOX_SIZE / 2;
  const outerRadius = 320;
  const innerRadius = 270;
  /** Outer boundary, inner boundary, sign dividers, and bold degree ticks share one weight. */
  const zodiacRingStrokeWidth = 2;
  const innerCenterRing = 184;
  const innerCenterCore = 152;
  const glyphRadialOutset = 3;
  const planetRadius = (innerRadius + innerCenterRing) / 2 - 8 + glyphRadialOutset;
  const radixAspectChordRadius = (innerCenterCore + innerCenterRing) / 2;
  const zodiacRadius = (innerRadius + outerRadius) / 2 + glyphRadialOutset;
  const angleMarkerRadius = outerRadius + 22;

  const zodiacSigns = [
    { id: 'aries', icon: '♈', angle: 0 },
    { id: 'taurus', icon: '♉', angle: 30 },
    { id: 'gemini', icon: '♊', angle: 60 },
    { id: 'cancer', icon: '♋', angle: 90 },
    { id: 'leo', icon: '♌', angle: 120 },
    { id: 'virgo', icon: '♍', angle: 150 },
    { id: 'libra', icon: '♎', angle: 180 },
    { id: 'scorpio', icon: '♏', angle: 210 },
    { id: 'sagittarius', icon: '♐', angle: 240 },
    { id: 'capricorn', icon: '♑', angle: 270 },
    { id: 'aquarius', icon: '♒', angle: 300 },
    { id: 'pisces', icon: '♓', angle: 330 }
  ] as const;

  const ANGLE_IDS = new Set(['asc', 'desc', 'dsc', 'mc', 'ic']);
  const ELEMENT_BY_SIGN: Record<string, 'fire' | 'earth' | 'air' | 'water'> = {
    aries: 'fire',
    leo: 'fire',
    sagittarius: 'fire',
    taurus: 'earth',
    virgo: 'earth',
    capricorn: 'earth',
    gemini: 'air',
    libra: 'air',
    aquarius: 'air',
    cancer: 'water',
    scorpio: 'water',
    pisces: 'water'
  };

  const fallbackBodies = {
    sun: { degrees: 249.7833, sign: 'sagittarius' },
    moon: { degrees: 48.3833, sign: 'taurus' },
    mercury: { degrees: 242.25, sign: 'sagittarius' },
    venus: { degrees: 236.1333, sign: 'scorpio' },
    mars: { degrees: 14.7, sign: 'aries' },
    jupiter: { degrees: 351.9333, sign: 'pisces' },
    saturn: { degrees: 298.5167, sign: 'capricorn' },
    uranus: { degrees: 71.3167, sign: 'gemini' },
    neptune: { degrees: 277.0667, sign: 'capricorn' },
    pluto: { degrees: 218.85, sign: 'scorpio' }
  };

  const normalizedPositions = $derived.by(() => {
    return Object.keys(planetPositions).length > 0 ? planetPositions : fallbackBodies;
  });

  const angleLongitudes = $derived.by(() => {
    const source = normalizedPositions as Record<string, unknown>;
    return {
      asc: normalizeLongitude(source.asc),
      dsc: normalizeLongitude(source.desc ?? source.dsc),
      mc: normalizeLongitude(source.mc),
      ic: normalizeLongitude(source.ic)
    };
  });

  const showAxisLines = $derived.by(
    () =>
      angleLongitudes.asc != null &&
      angleLongitudes.dsc != null &&
      angleLongitudes.mc != null &&
      angleLongitudes.ic != null
  );

  const bodies = $derived.by(() =>
    Object.entries(normalizedPositions)
      .filter(([id, value]) => !ANGLE_IDS.has(id) && normalizeLongitude(value?.degrees ?? value) != null)
      .map(([id, value]) => ({
        id,
        longitude: normalizeLongitude(value?.degrees ?? value) ?? 0
      }))
      .sort((a, b) => a.longitude - b.longitude)
  );

  function normalizeLongitude(value: unknown): number | null {
    const n =
      typeof value === 'number'
        ? value
        : value && typeof value === 'object' && 'degrees' in value
          ? Number((value as { degrees?: unknown }).degrees)
          : NaN;
    return Number.isFinite(n) ? ((n % 360) + 360) % 360 : null;
  }

  function longitudeToScreenRadians(eclipticDeg: number) {
    return ((180 - eclipticDeg) * Math.PI) / 180;
  }

  // Rotate the whole wheel so the Ascendant always sits at the 9 o'clock (left) point,
  // matching the React app's horoscope-wheel behavior.
  const wheelRotationOffset = $derived.by(() => {
    const asc = angleLongitudes.asc;
    return typeof asc === 'number' && Number.isFinite(asc) ? -asc : 0;
  });

  function displayLongitude(eclipticDeg: number): number {
    return ((eclipticDeg + wheelRotationOffset) % 360 + 360) % 360;
  }

  function polar(r: number, eclipticDeg: number) {
    const rad = longitudeToScreenRadians(displayLongitude(eclipticDeg));
    return {
      x: center + r * Math.cos(rad),
      y: center + r * Math.sin(rad)
    };
  }

  function elementColorForSign(signId: string): string {
    switch (ELEMENT_BY_SIGN[signId]) {
      case 'fire':
        return 'var(--element-fire)';
      case 'earth':
        return 'var(--element-earth)';
      case 'air':
        return 'var(--element-air)';
      case 'water':
        return 'var(--element-water)';
      default:
        return 'currentColor';
    }
  }

  function zodiacFilterId(signId: string): string {
    return `zodiac-tint-${signId}`;
  }

  function getAspectColor(type: string): string {
    return aspectColors[type] ?? 'var(--token-viz-2)';
  }

  type AspectOrbTier = 'tight' | 'medium' | 'loose' | 'outer';

  function getAspectOrbTier(type: string, orb: number | undefined): AspectOrbTier {
    const maxOrb = Math.max(
      aspectOrbs[type] ?? DEFAULT_ASPECT_ORBS[type as keyof typeof DEFAULT_ASPECT_ORBS] ?? 8,
      0.0001
    );
    const ratioPct = (Math.abs(orb ?? 0) / maxOrb) * 100;
    if (ratioPct <= aspectLineTierStyle.tightThresholdPct) return 'tight';
    if (ratioPct <= aspectLineTierStyle.mediumThresholdPct) return 'medium';
    if (ratioPct <= aspectLineTierStyle.looseThresholdPct) return 'loose';
    return 'outer';
  }

  function getAspectStrokeWidth(tier: AspectOrbTier): number {
    if (tier === 'tight') return aspectLineTierStyle.widthTight;
    if (tier === 'medium') return aspectLineTierStyle.widthMedium;
    if (tier === 'loose') return aspectLineTierStyle.widthLoose;
    return aspectLineTierStyle.widthOuter;
  }

  /** Tight/medium/loose aspects always render solid; only the outer (loosest) tier follows `outerLineStyle`. */
  function getAspectDasharray(tier: AspectOrbTier, strokeWidthPx: number): string | undefined {
    if (tier !== 'outer' || aspectLineTierStyle.outerLineStyle === 'solid') return undefined;
    if (aspectLineTierStyle.outerLineStyle === 'dotted') return `0.1 ${(strokeWidthPx * 2.4).toFixed(2)}`;
    return `${(strokeWidthPx * 3).toFixed(2)} ${(strokeWidthPx * 2).toFixed(2)}`;
  }

  function renderGlyph(
    id: string,
    x: number,
    y: number,
    sizePx: number,
    color = 'currentColor'
  ) {
    return {
      glyph: getGlyphContent(id),
      x,
      y,
      sizePx,
      color
    };
  }
</script>

<svg
  width={size}
  height={size}
  viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
  class="radix-chart"
  xmlns="http://www.w3.org/2000/svg"
  preserveAspectRatio="xMidYMid meet"
>
  <defs>
    {#each zodiacSigns as sign}
      <filter
        id={zodiacFilterId(sign.id)}
        color-interpolation-filters="sRGB"
        x="-50%"
        y="-50%"
        width="200%"
        height="200%"
      >
        <feFlood flood-color={elementColorForSign(sign.id)} flood-opacity="1" result="zodiacColor" />
        <feComposite in="zodiacColor" in2="SourceGraphic" operator="in" result="zodiacTint" />
        <feMerge>
          <feMergeNode in="zodiacTint" />
        </feMerge>
      </filter>
    {/each}
  </defs>

  <circle cx={center} cy={center} r={outerRadius + 60} fill="var(--token-surface-subtle)" />

  <circle cx={center} cy={center} r={outerRadius} fill="none" stroke="currentColor" stroke-opacity="0.6" stroke-width={zodiacRingStrokeWidth} />
  <circle cx={center} cy={center} r={innerRadius} fill="none" stroke="currentColor" stroke-opacity="0.6" stroke-width={zodiacRingStrokeWidth} />

  {#each zodiacSigns as sign}
    {@const p1 = polar(innerRadius, sign.angle)}
    {@const p2 = polar(outerRadius, sign.angle)}
    <line
      x1={p1.x}
      y1={p1.y}
      x2={p2.x}
      y2={p2.y}
      stroke="currentColor"
      stroke-opacity="0.45"
      stroke-width={zodiacRingStrokeWidth}
    />
  {/each}

  {#if wheelStyleSettings.activeStyle === 'technical'}
    {@const ringWidth = outerRadius - innerRadius}
    {#each Array.from({ length: 360 }, (_, i) => i) as tick}
      {@const is10 = tick % 10 === 0}
      {@const is5 = tick % 5 === 0 && !is10}
      {@const tickLength = is10 ? ringWidth * 0.48 * 0.6 : ringWidth * 0.14}
      {@const tickWidth = is10 || is5 ? zodiacRingStrokeWidth : 0.6}
      {@const p1 = polar(innerRadius, tick)}
      {@const p2 = polar(innerRadius + tickLength, tick)}
      <line
        x1={p1.x}
        y1={p1.y}
        x2={p2.x}
        y2={p2.y}
        stroke="currentColor"
        stroke-opacity="0.35"
        stroke-width={tickWidth}
      />
    {/each}
  {/if}

  {#each zodiacSigns as sign}
    {@const pos = polar(zodiacRadius, sign.angle + 15)}
      {@const rendered = renderGlyph(sign.id, pos.x, pos.y, 28, elementColorForSign(sign.id))}
    <g transform={`translate(${rendered.x}, ${rendered.y})`} style={`color:${rendered.color}`}>
      {#if rendered.glyph.type === 'file'}
        {#if failedGlyphFiles[`zodiac:${sign.id}:${rendered.glyph.content}`]}
          <text
            x="0"
            y="0"
            text-anchor="middle"
            dominant-baseline="middle"
            font-size="20"
            fill={rendered.color}
          >
            {sign.icon}
          </text>
        {:else}
          <image
            href={rendered.glyph.content}
            x={-rendered.sizePx / 2}
            y={-rendered.sizePx / 2}
            width={rendered.sizePx}
            height={rendered.sizePx}
            opacity="0.95"
            style={`filter:url(#${zodiacFilterId(sign.id)})`}
            onerror={() => {
              failedGlyphFiles[`zodiac:${sign.id}:${rendered.glyph.content}`] = true;
              failedGlyphFiles = { ...failedGlyphFiles };
            }}
          />
        {/if}
      {:else if rendered.glyph.type === 'svg'}
        <g opacity="0.95">
          {@html rendered.glyph.content}
        </g>
      {:else}
        <text
          x="0"
          y="0"
          text-anchor="middle"
          dominant-baseline="middle"
          font-size="20"
          fill={rendered.color}
        >
          {sign.icon}
        </text>
      {/if}
    </g>
  {/each}

  <circle cx={center} cy={center} r={innerCenterRing} fill="none" stroke="currentColor" stroke-opacity="0.45" stroke-width="1.5" />
  <circle cx={center} cy={center} r={innerCenterCore} fill="none" stroke="currentColor" stroke-opacity="0.45" stroke-width="1.5" />

  {#if showAxisLines}
    {@const pAsc = polar(outerRadius + 4, angleLongitudes.asc!)}
    {@const pDsc = polar(outerRadius + 4, angleLongitudes.dsc!)}
    {@const pMc = polar(outerRadius + 4, angleLongitudes.mc!)}
    {@const pIc = polar(outerRadius + 4, angleLongitudes.ic!)}
    <g stroke="var(--token-wheel-axis)">
      <line x1={pAsc.x} y1={pAsc.y} x2={pDsc.x} y2={pDsc.y} stroke-width="1.25" stroke-dasharray="4 3" />
      <line x1={pMc.x} y1={pMc.y} x2={pIc.x} y2={pIc.y} stroke-width="1.25" stroke-dasharray="2 2" opacity="0.85" />
    </g>

    {#each [
      { id: 'asc', longitude: angleLongitudes.asc! },
      { id: 'desc', longitude: angleLongitudes.dsc! },
      { id: 'mc', longitude: angleLongitudes.mc! },
      { id: 'ic', longitude: angleLongitudes.ic! }
    ] as angle}
      {@const pos = polar(angleMarkerRadius, angle.longitude)}
      {@const rendered = renderGlyph(angle.id, pos.x, pos.y, 26)}
      <g transform={`translate(${rendered.x}, ${rendered.y})`}>
        {#if rendered.glyph.type === 'file'}
          {#if failedGlyphFiles[`angle:${angle.id}:${rendered.glyph.content}`]}
            <text x="0" y="0" text-anchor="middle" dominant-baseline="middle" font-size="11" font-weight="700" fill="currentColor">
              {rendered.glyph.fallback}
            </text>
          {:else}
            <image
              href={rendered.glyph.content}
              x={-rendered.sizePx / 2}
              y={-rendered.sizePx / 2}
              width={rendered.sizePx}
              height={rendered.sizePx}
              onerror={() => {
                failedGlyphFiles[`angle:${angle.id}:${rendered.glyph.content}`] = true;
                failedGlyphFiles = { ...failedGlyphFiles };
              }}
            />
          {/if}
        {:else if rendered.glyph.type === 'svg'}
          {@html rendered.glyph.content}
        {:else}
          <text x="0" y="0" text-anchor="middle" dominant-baseline="middle" font-size="11" font-weight="700" fill="currentColor">
            {rendered.glyph.content}
          </text>
        {/if}
      </g>
    {/each}
  {/if}

  <g opacity={aspects.length > 0 ? 0.55 : 0} style="pointer-events:none">
    {#each aspects as aspect, index}
      {@const fromBody = bodies.find((body) => body.id === aspect.from)}
      {@const toBody = bodies.find((body) => body.id === aspect.to)}
      {#if fromBody && toBody}
        {@const p1 = polar(radixAspectChordRadius, fromBody.longitude)}
        {@const p2 = polar(radixAspectChordRadius, toBody.longitude)}
        {@const orbTier = getAspectOrbTier(aspect.type, aspect.orb)}
        {@const strokeWidthPx = getAspectStrokeWidth(orbTier)}
        <line
          x1={p1.x}
          y1={p1.y}
          x2={p2.x}
          y2={p2.y}
          stroke={getAspectColor(aspect.type)}
          stroke-width={strokeWidthPx}
          stroke-dasharray={getAspectDasharray(orbTier, strokeWidthPx)}
          stroke-linecap="round"
        />
      {/if}
    {/each}
  </g>

  <g>
    {#each bodies as body}
      {@const pos = polar(planetRadius, body.longitude)}
      {@const rendered = renderGlyph(body.id, pos.x, pos.y, 28)}
      <g transform={`translate(${rendered.x}, ${rendered.y})`}>
        {#if rendered.glyph.type === 'file'}
          {#if failedGlyphFiles[`planet:${body.id}:${rendered.glyph.content}`]}
            <text x="0" y="0" text-anchor="middle" dominant-baseline="middle" font-size="18" font-weight="600" fill="currentColor">
              {rendered.glyph.fallback}
            </text>
          {:else}
            <image
              href={rendered.glyph.content}
              x={-rendered.sizePx / 2}
              y={-rendered.sizePx / 2}
              width={rendered.sizePx}
              height={rendered.sizePx}
              onerror={() => {
                failedGlyphFiles[`planet:${body.id}:${rendered.glyph.content}`] = true;
                failedGlyphFiles = { ...failedGlyphFiles };
              }}
            />
          {/if}
        {:else if rendered.glyph.type === 'svg'}
          {@html rendered.glyph.content}
        {:else}
          <text x="0" y="0" text-anchor="middle" dominant-baseline="middle" font-size="18" font-weight="600" fill="currentColor">
            {rendered.glyph.content}
          </text>
        {/if}
      </g>
    {/each}
  </g>
</svg>

<style>
  .radix-chart {
    max-width: 100%;
    max-height: 100%;
    display: block;
  }
</style>
