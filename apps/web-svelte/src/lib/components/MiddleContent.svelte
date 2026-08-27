<!-- src/lib/components/MiddleContent.svelte -->
<script lang="ts">
  import { layout, getSelectedChart, updateChartComputation, updateChartComputationAtTime, chartDataToComputePayload } from '$lib/state/layout';
  import { t, i18n, setLang } from '$lib/i18n/index.svelte';
  import * as Select from '$lib/components/ui/select/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import { presets, preset, applyPreset } from '$lib/state/theme.svelte';
  import { showOpenExportOverlay } from '$lib/state/layout';
  import RadixChart from '$lib/components/RadixChart.svelte';
  import { AspectMatrix } from '$lib/components/chart-matrix';
  import { DEFAULT_ASPECT_COLORS } from '$lib/astrology/aspects';
  import { effectiveTime, timeNavigation } from '$lib/stores/timeNavigation.svelte';
  import { getCurrentPositions, queryPositions, type Position } from '$lib/stores/data.svelte';
  import { signIdFromLongitude } from '$lib/stores/glyphs.svelte';
  import { DEFAULT_OBSERVABLE_OBJECT_IDS } from '$lib/astrology/observableObjects';
  import { isTauriRuntime } from '$lib/tauri/runtime';
  import { computeChart, computeChartFromData, computeResultToComputed } from '$lib/tauri/workspace';

  // reactive references using runes
  const tab = $derived(layout.selectedTab);
  const ctx = $derived(layout.selectedContext);
  const languageLabel = $derived.by(() => t('language', {}, 'Language'));
  const viewLabel = $derived.by(() => {
    return tab === 'Radix'
      ? t('radix_chart_area', {}, 'Radix chart area')
      : tab === 'Aspects'
      ? t('aspects_table_area', {}, 'Aspects table area')
      : tab === 'Transits'
      ? t('transits_composite_area', {}, 'Transits composite area')
      : `${tab} view`;
  });

  // Languages as items: { value, label }
  const languages = $derived(
    Object.keys(i18n.dicts).map((code) => ({
      value: code,
      label:
        ({ en: 'English', cs: 'Čeština', es: 'Español', fr: 'Français' } as Record<string, string>)[code] ?? code.toUpperCase()
    }))
  );

  // Language selector is controlled directly from the global i18n state.
  const currentLangValue = $derived(String(i18n.lang));
  const langTriggerContent = $derived(
    languages.find((l) => l.value === currentLangValue)?.label ?? t('select_language', {}, 'Select language')
  );

  // Presets as items and trigger content
  const presetItems = presets.map((p) => ({ value: p.id, label: p.name }));
  let presetValue = $state(String(preset.id));
  const presetTriggerContent = $derived(
    presetItems.find((p) => p.value === presetValue)?.label ?? t('select_preset', {}, 'Select preset')
  );

  $effect(() => {
    // Only update if the value actually changed
    if (presetValue !== preset.id) {
      applyPreset(presetValue);
    }
  });

  // Toolbar state/actions
  let searchQuery = $state('');
  function openChart() { showOpenExportOverlay(true); }
  function selectContext(id: string) { layout.selectedContext = id; }

  let square = $state(0);

  function measureSquare(node: HTMLElement) {
    let frame = 0;
    const recompute = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = node.getBoundingClientRect();
        // Keep a safety margin so SVG labels never clip at container edges.
        const size = Math.floor(Math.min(rect.width, rect.height) * 0.99);
        square = size > 0 ? size : 0;
      });
    };
    const observer = new ResizeObserver(recompute);
    observer.observe(node);
    recompute();
    return {
      destroy() {
        cancelAnimationFrame(frame);
        observer.disconnect();
      }
    };
  }

  function normalizeLongitude(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return ((value % 360) + 360) % 360;
    }
    if (value && typeof value === 'object') {
      const longitude = (value as Record<string, unknown>).longitude;
      if (typeof longitude === 'number' && Number.isFinite(longitude)) {
        return ((longitude % 360) + 360) % 360;
      }
    }
    return null;
  }

  function getComputedHouseCusps(): number[] {
    if (Array.isArray(selectedChart?.computed?.houseCusps) && selectedChart.computed.houseCusps.length === 12) {
      return selectedChart.computed.houseCusps
        .map((value) => normalizeLongitude(value))
        .filter((value): value is number => value !== null);
    }

    const computed = (selectedChart?.computed?.positions ?? {}) as Record<string, unknown>;
    const cusps: number[] = [];
    for (let index = 1; index <= 12; index += 1) {
      const value = normalizeLongitude(computed[`house_${index}`]);
      if (value === null) return [];
      cusps.push(value);
    }
    return cusps;
  }

  /** Which of the 12 houses (1-12) a longitude falls in, given ascending house cusps. */
  function houseForLongitude(longitude: number, cusps: number[]): number {
    const lon = ((longitude % 360) + 360) % 360;
    for (let i = 0; i < 12; i++) {
      const start = ((cusps[i] % 360) + 360) % 360;
      const end = ((cusps[(i + 1) % 12] % 360) + 360) % 360;
      const inRange = start <= end ? lon >= start && lon < end : lon >= start || lon < end;
      if (inRange) return i + 1;
    }
    return 1;
  }

  function parseComputedAspect(raw: unknown):
    | {
        from: string;
        to: string;
        type: 'conjunction' | 'sextile' | 'square' | 'trine' | 'quincunx' | 'opposition';
        orb: number;
      }
    | null {
    if (!raw || typeof raw !== 'object') return null;
    const record = raw as Record<string, unknown>;
    const from = typeof record.from === 'string' ? record.from : null;
    const to = typeof record.to === 'string' ? record.to : null;
    const type = typeof record.type === 'string' ? record.type : null;
    const orb =
      typeof record.orb === 'number'
        ? record.orb
        : typeof record.orb === 'string'
          ? Number(record.orb)
          : NaN;
    if (
      !from ||
      !to ||
      !type ||
      !['conjunction', 'sextile', 'square', 'trine', 'quincunx', 'opposition'].includes(type) ||
      !Number.isFinite(orb)
    ) {
      return null;
    }
    return {
      from,
      to,
      type: type as 'conjunction' | 'sextile' | 'square' | 'trine' | 'quincunx' | 'opposition',
      orb
    };
  }

  // Load positions from database for radix chart
  const selectedChart = $derived(getSelectedChart());
  const currentTime = $derived(effectiveTime());
  const currentTimeIso = $derived(currentTime.toISOString());
  let loadedPositions = $state<Position[]>([]);
  let isLoadingPositions = $state(false);
  let positionError = $state<string | null>(null);
  
  // Timestamp navigation state
  let availableTimestamps = $state<string[]>([]);
  let currentTimestampIndex = $state<number>(-1);
  let zoomLevel = $state<number>(1); // 1 = every timestamp, 2 = every 2nd, etc.
  let astrolabeComputeInFlightFor = $state<string | null>(null);
  let timestampsLoadedFor = $state<string | null>(null);
  let positionsLoadedFor = $state<string | null>(null);
  let positionsRequestToken = 0;

  // Convert Position[] to RadixChart format (sign = glyph id for settings-controlled display)
  const planetPositions = $derived(() => {
    const result: Record<string, { degrees: number; sign: string; house?: number }> = {};
    const defaultBodyOrder = DEFAULT_OBSERVABLE_OBJECT_IDS;
    const fullBodyOrder = layout.workspaceDefaults.defaultBodies.length > 0
      ? layout.workspaceDefaults.defaultBodies
      : defaultBodyOrder;
    
    // Map common object_id variations to standard names
    const objectIdMap: Record<string, string> = {
      'true_north_node': 'north_node',
      'true_south_node': 'south_node',
      'mean_node': 'north_node',
      'mean_south_node': 'south_node',
      'true_node': 'north_node',
      'black_moon': 'lilith',
      'true_lilith': 'lilith',
      'chiron': 'chiron',
      'asc': 'asc',
      'desc': 'desc',
      'mc': 'mc',
      'ic': 'ic',
    };

    // House cusps: prefer the loaded (DB/in-memory) `house_N` entries, fall back to the
    // selected chart's computed house cusps array.
    const houseCusps: number[] = [];
    for (const pos of loadedPositions) {
      const match = /^house_(\d+)$/i.exec(pos.object_id);
      if (match) {
        const index = Number(match[1]) - 1;
        if (index >= 0 && index < 12) houseCusps[index] = pos.longitude;
      }
    }
    if (houseCusps.filter((cusp) => typeof cusp === 'number').length < 12) {
      selectedChart?.computed?.houseCusps?.forEach((cusp, index) => {
        if (typeof houseCusps[index] !== 'number') houseCusps[index] = cusp;
      });
    }
    const hasFullHouseCusps = houseCusps.filter((cusp) => typeof cusp === 'number').length === 12;

    const addPosition = (rawName: string, rawLongitude: number) => {
      if (/^house_\d+$/i.test(rawName)) return;
      const longitude = ((rawLongitude % 360) + 360) % 360;
      let planetName = rawName.toLowerCase()
        .replace(/^planet_/, '')
        .replace(/^body_/, '')
        .trim();
      planetName = objectIdMap[planetName] || planetName;
      result[planetName] = {
        degrees: longitude,
        sign: signIdFromLongitude(longitude),
        house: hasFullHouseCusps ? houseForLongitude(longitude, houseCusps) : 1
      };
    };

    // 1) Primary source: loaded positions (DB/in-memory query)
    for (const pos of loadedPositions) {
      addPosition(pos.object_id, pos.longitude);
    }

    // 2) Secondary source: currently selected chart computed payload
    const computed = selectedChart?.computed?.positions as Record<string, unknown> | undefined;
    if (computed) {
      for (const [name, value] of Object.entries(computed)) {
        if (result[name]) continue;
        const longitude = typeof value === 'number'
          ? value
          : Number((value as Record<string, unknown>)?.longitude ?? NaN);
        if (!Number.isNaN(longitude)) {
          addPosition(name, longitude);
        }
      }
    }

    // Keep deterministic draw order (major objects first)
    const ordered = Object.fromEntries(
      Object.entries(result).sort(([a], [b]) => {
        const ai = fullBodyOrder.indexOf(a);
        const bi = fullBodyOrder.indexOf(b);
        if (ai !== -1 || bi !== -1) {
          if (ai === -1) return 1;
          if (bi === -1) return -1;
          return ai - bi;
        }
        return a.localeCompare(b);
      })
    );

    if (Object.keys(ordered).length === 0) {
      return {};
    }
    
    return ordered;
  });

  const chartHouseCusps = $derived(getComputedHouseCusps());
  const chartAspects = $derived(
    (selectedChart?.computed?.aspects ?? [])
      .map(parseComputedAspect)
      .filter((aspect): aspect is NonNullable<ReturnType<typeof parseComputedAspect>> => aspect !== null)
      .filter((aspect) => layout.workspaceDefaults.defaultAspects.includes(aspect.type))
  );

  // Load all available timestamps when chart changes
  $effect(() => {
    (async () => {
    const chart = selectedChart;
    const chartId = chart?.id ?? '';
    const chartDateTime = chart?.dateTime ?? '';
    const hasComputedPositions = Boolean(chart?.computed?.positions && Object.keys(chart.computed.positions).length > 0);
    const workspacePath = layout.workspacePath;
    const requestKey = workspacePath
      ? `${workspacePath}:${chartId}`
      : `memory:${chartId}:${chartDateTime}:${hasComputedPositions ? 'computed' : 'empty'}`;
    
    if (!chartId) {
      availableTimestamps = [];
      currentTimestampIndex = -1;
      timestampsLoadedFor = null;
      return;
    }

    if (timestampsLoadedFor === requestKey) {
      return;
    }
    timestampsLoadedFor = requestKey;

    // In-memory mode (no workspace): use chart dateTime as single timestamp if we have computed data
    if (!workspacePath) {
      if (hasComputedPositions && chartDateTime) {
        const dt = chartDateTime.includes('T') ? chartDateTime : chartDateTime.replace(' ', 'T') + 'Z';
        availableTimestamps = [dt];
        currentTimestampIndex = 0;
      } else {
        availableTimestamps = [];
        currentTimestampIndex = -1;
      }
      return;
    }

    try {
      // Query all positions to get all available timestamps
      // Pass undefined to get ALL timestamps (no date filtering)
      const allPositions = await queryPositions(chart.id, undefined, undefined, false);
      
      if (allPositions.length > 0) {
        // Extract unique timestamps and sort them
        // Use original datetime strings from database as-is
        const timestampSet = new Set<string>();
        
        for (const pos of allPositions) {
          timestampSet.add(pos.datetime);
        }
        
        // Sort timestamps by parsing them as dates (treating database format as UTC if no timezone)
        const sortedTimestamps = Array.from(timestampSet).sort((a, b) => {
          // Helper to parse datetime assuming UTC if no timezone specified
          function parseAsUTC(dt: string): Date {
            // If format is "YYYY-MM-DD HH:MM:SS" (no timezone), treat as UTC
            if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(dt)) {
              return new Date(dt.replace(' ', 'T') + 'Z');
            }
            // Otherwise parse normally
            return new Date(dt);
          }
          
          try {
            const dateA = parseAsUTC(a);
            const dateB = parseAsUTC(b);
            return dateA.getTime() - dateB.getTime();
          } catch {
            return a.localeCompare(b);
          }
        });
        
        availableTimestamps = sortedTimestamps;
        currentTimestampIndex = -1;
      } else {
        availableTimestamps = [];
        currentTimestampIndex = -1;
      }
    } catch (error) {
      console.error('Failed to load timestamps:', error);
      availableTimestamps = [];
      currentTimestampIndex = -1;
      timestampsLoadedFor = null;
    }
    })();
  });

  // Sync currentTimestampIndex when time changes externally
  $effect(() => {
    if (availableTimestamps.length === 0) return;
    
    // Helper to parse datetime assuming UTC if no timezone specified
    function parseTimestampAsUTC(dt: string): Date {
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(dt)) {
        return new Date(dt.replace(' ', 'T') + 'Z');
      }
      return new Date(dt);
    }
    
    const currentTimeMs = currentTime.getTime();
    // Find exact or nearest timestamp
    let index = -1;
    let minDiff = Infinity;
    
    for (let i = 0; i < availableTimestamps.length; i++) {
      try {
        const tsDate = parseTimestampAsUTC(availableTimestamps[i]);
        const diff = Math.abs(tsDate.getTime() - currentTimeMs);
        if (diff < 1000) {
          // Exact match (within 1 second)
          index = i;
          break;
        }
        if (diff < minDiff) {
          minDiff = diff;
          index = i;
        }
      } catch {
        continue;
      }
    }
    
    if (index >= 0) {
      currentTimestampIndex = index;
    }
  });

  // Load positions when chart or time changes
  $effect(() => {
    (async () => {
    const chartId = selectedChart?.id ?? '';
    const timeIso = currentTimeIso;
    const workspacePath = layout.workspacePath ?? 'memory';
    const requestKey = `${workspacePath}:${chartId}:${timeIso}`;
    const requestToken = ++positionsRequestToken;
    const hasRenderedData =
      loadedPositions.length > 0 ||
      Boolean(selectedChart?.computed?.positions && Object.keys(selectedChart.computed.positions).length > 0);
    
    if (!chartId) {
      loadedPositions = [];
      positionsLoadedFor = null;
      return;
    }

    if (positionsLoadedFor === requestKey) {
      return;
    }
    positionsLoadedFor = requestKey;

    if (!hasRenderedData) {
      isLoadingPositions = true;
    }
    positionError = null;
    
    try {
      // Load positions for current effective time
      const positions = await getCurrentPositions(chartId);
      if (requestToken !== positionsRequestToken) {
        return;
      }
      loadedPositions = positions;
    } catch (error) {
      if (requestToken !== positionsRequestToken) {
        return;
      }
      console.error('Failed to load positions:', error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : typeof error === 'string'
        ? error
        : 'Failed to load positions';
      positionError = `Error: ${errorMessage}`;
      console.error('Position loading error details:', {
        chartId,
        workspacePath: layout.workspacePath,
        time: timeIso,
        error
      });
      loadedPositions = [];
      positionsLoadedFor = null;
    } finally {
      if (requestToken === positionsRequestToken) {
        isLoadingPositions = false;
      }
    }
    })();
  });

  // In-memory mode: compute chart from data when no workspace and chart has dateTime + location but no computed positions
  $effect(() => {
    const chart = selectedChart;
    if (!chart?.id || layout.workspacePath) return;
    if (!isTauriRuntime()) return;
    if (!chart.dateTime?.trim() || !chart.location?.trim()) return;
    if (chart.computed?.positions && Object.keys(chart.computed.positions).length > 0) return;
    const payload = chartDataToComputePayload(chart);
    computeChartFromData(payload)
      .then((result) => {
        updateChartComputation(chart.id, computeResultToComputed(result));
      })
      .catch((err) => {
        console.warn('In-memory compute failed for chart', chart.id, err);
      });
  });

  // Recompute the selected chart whenever the effective astrolabe time changes.
  // This keeps stepping/backtracking functional even without a precomputed time series.
  $effect(() => {
    const chart = selectedChart;
    const timeIso = currentTimeIso;
    const workspacePath = layout.workspacePath;

    if (!chart?.id) return;
    if (!chart.location?.trim()) return;
    if (!isTauriRuntime()) return;
    if (workspacePath && availableTimestamps.length > 1) return;

    const targetDateTime = timeIso.slice(0, 19) + 'Z';
    const requestKey = `${chart.id}:${targetDateTime}`;
    const hasComputedPositions = Boolean(chart.computed?.positions && Object.keys(chart.computed.positions).length > 0);
    if (chart.dateTime === targetDateTime && hasComputedPositions) return;
    if (astrolabeComputeInFlightFor === requestKey) return;

    const chartAtTime = {
      ...chart,
      dateTime: targetDateTime
    };
    astrolabeComputeInFlightFor = requestKey;

    computeChartFromData(chartDataToComputePayload(chartAtTime))
      .then((result) => {
        updateChartComputationAtTime(chart.id, targetDateTime, computeResultToComputed(result));
      })
      .catch((err) => {
        console.warn('Astrolabe recompute failed for chart', chart.id, err);
      })
      .finally(() => {
        if (astrolabeComputeInFlightFor === requestKey) {
          astrolabeComputeInFlightFor = null;
        }
      });
  });

  // Workspace mode: compute real positions when chart has no computed payload yet.
  $effect(() => {
    const chart = selectedChart;
    if (!chart?.id || !layout.workspacePath) return;
    if (!isTauriRuntime()) return;
    if (chart.computed?.positions && Object.keys(chart.computed.positions).length > 0) return;

    computeChart(layout.workspacePath, chart.id)
      .then((result) => {
        updateChartComputation(chart.id, computeResultToComputed(result));
      })
      .catch((err) => {
        console.warn('Workspace compute failed for chart', chart.id, err);
      });
  });
  
  // Navigate to next/previous computed timestamp
  function navigateToTimestamp(direction: 'next' | 'prev') {
    if (availableTimestamps.length === 0) {
      return;
    }
    
    if (availableTimestamps.length === 1) {
      return;
    }
    
    if (currentTimestampIndex < 0) {
      // Try to find the current time in available timestamps
      const currentTimeStr = currentTime.toISOString();
      const index = availableTimestamps.findIndex(ts => ts === currentTimeStr);
      if (index >= 0) {
        currentTimestampIndex = index;
      } else {
        // Use first timestamp as fallback
        currentTimestampIndex = 0;
      }
    }
    
    const step = zoomLevel;
    let newIndex = currentTimestampIndex;
    
    if (direction === 'next') {
      newIndex = Math.min(currentTimestampIndex + step, availableTimestamps.length - 1);
      // If we're at the end, don't navigate
      if (newIndex === currentTimestampIndex && currentTimestampIndex < availableTimestamps.length - 1) {
        newIndex = currentTimestampIndex + 1;
      }
    } else {
      newIndex = Math.max(currentTimestampIndex - step, 0);
      // If we're at the beginning, don't navigate
      if (newIndex === currentTimestampIndex && currentTimestampIndex > 0) {
        newIndex = currentTimestampIndex - 1;
      }
    }
    
    if (newIndex !== currentTimestampIndex && newIndex >= 0 && newIndex < availableTimestamps.length) {
      currentTimestampIndex = newIndex;
      const timestamp = availableTimestamps[newIndex];
      // Parse timestamp assuming UTC if no timezone specified (database format)
      function parseTimestampAsUTC(dt: string): Date {
        if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(dt)) {
          return new Date(dt.replace(' ', 'T') + 'Z');
        }
        return new Date(dt);
      }
      timeNavigation.currentTime = parseTimestampAsUTC(timestamp);
    }
  }
  
  // Zoom out (increase step size) - skip more timestamps
  function zoomOut() {
    const maxZoom = Math.max(1, Math.floor(availableTimestamps.length / 10));
    zoomLevel = Math.min(zoomLevel * 2, maxZoom);
  }
  
  // Zoom in (decrease step size) - skip fewer timestamps
  function zoomIn() {
    zoomLevel = Math.max(1, Math.floor(zoomLevel / 2));
  }
  
  // Keyboard navigation for timestamp navigation (only when Radix tab is active)
  $effect(() => {
    // Only enable keyboard navigation when Radix tab is active
    if (tab !== 'Radix') {
      return;
    }
    
    function handleKeyDown(e: KeyboardEvent) {
      // Only handle if not typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Left arrow: navigate to previous computed timestamp
      if (e.key === 'ArrowLeft' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        navigateToTimestamp('prev');
      }
      // Right arrow: navigate to next computed timestamp
      else if (e.key === 'ArrowRight' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        navigateToTimestamp('next');
      }
      // Plus/Equals: zoom in (finer granularity)
      else if ((e.key === '+' || e.key === '=') && !e.shiftKey) {
        e.preventDefault();
        zoomIn();
      }
      // Minus/Underscore: zoom out (coarser granularity)
      else if ((e.key === '-' || e.key === '_') && !e.shiftKey) {
        e.preventDefault();
        zoomOut();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });
</script>

<div class="w-full h-full min-h-0 p-2">
  <div class="h-full w-full min-h-0 rounded-md border border-transparent bg-transparent p-2 flex flex-col overflow-hidden">
    {#if tab === 'Radix'}
      <!-- Radix: Only SVG -->
      <div class="flex-1 min-h-0 flex items-center justify-center" use:measureSquare>
        {#if square > 0}
          {#if positionError}
            <div class="text-sm text-destructive opacity-80">
              Error: {positionError}
            </div>
          {:else}
            <div class="relative w-full h-full flex items-center justify-center">
              <RadixChart
                size={square}
                planetPositions={planetPositions()}
                houseCusps={chartHouseCusps}
                aspects={chartAspects}
                aspectColors={layout.workspaceDefaults.defaultAspectColors}
                aspectOrbs={layout.workspaceDefaults.defaultAspectOrbs}
                aspectLineTierStyle={layout.workspaceDefaults.aspectLineTierStyle}
              />
              {#if isLoadingPositions}
                <div class="absolute top-2 right-2 text-xs opacity-75 bg-background/80 px-2 py-1 rounded">
                  {t('loading_positions', {}, 'Loading positions…')}
                </div>
              {/if}
              {#if availableTimestamps.length > 1}
                <div class="absolute top-2 left-2 text-xs opacity-75 bg-background/80 px-2 py-1 rounded">
                  {currentTimestampIndex + 1} / {availableTimestamps.length}
                  {#if zoomLevel > 1}
                    <span class="ml-1 opacity-60">(×{zoomLevel})</span>
                  {/if}
                </div>
              {/if}
            </div>
          {/if}
        {:else}
          <div class="text-sm opacity-60">{t('measuring_space', {}, 'Measuring available space…')}</div>
        {/if}
      </div>
    {:else if tab === 'Aspects'}
      <!-- Aspects: Aspect grid SVG in a box -->
      <div class="flex-1 min-h-0 flex items-center justify-center p-4">
        <div class="h-full w-full rounded-md border bg-card text-card-foreground shadow-sm flex items-center justify-center" use:measureSquare>
          {#if square === 0}
            <div class="text-sm opacity-60">{t('measuring_space', {}, 'Measuring available space…')}</div>
          {:else if Object.keys(planetPositions()).length === 0}
            <div class="text-sm opacity-60">{t('no_positions_yet', {}, 'No positions computed yet.')}</div>
          {:else}
            <AspectMatrix
              size={square}
              planetPositions={planetPositions()}
              aspects={chartAspects}
              aspectColors={layout.workspaceDefaults.defaultAspectColors}
            />
          {/if}
        </div>
      </div>
    {:else if tab === 'Settings'}
      <!-- Language selector lives in Settings -->
      <div class="mb-4 space-y-2">
        <label class="block text-sm font-medium opacity-90" for="settings-lang">{languageLabel}</label>
        <div class="min-w-[220px]">
          <Select.Root
            type="single"
            name="appLanguage"
            value={currentLangValue}
            onValueChange={(value) => {
              if (value !== i18n.lang) {
                setLang(value as any);
              }
            }}
          >
            <Select.Trigger class="w-[220px]" id="settings-lang">
              {langTriggerContent}
            </Select.Trigger>
            <Select.Content>
              <Select.Group>
                <Select.Label>{t('label_languages', {}, 'Languages')}</Select.Label>
                {#each languages as lang (lang.value)}
                  <Select.Item value={lang.value} label={lang.label}>
                    {lang.label}
                  </Select.Item>
                {/each}
              </Select.Group>
            </Select.Content>
          </Select.Root>
        </div>
      </div>

      <!-- Color preset selector (from imported preset files) -->
      <div class="mb-4 space-y-2">
        <label class="block text-sm font-medium opacity-90" for="settings-preset">{t('label_color_preset', {}, 'Color preset')}</label>
        <div class="min-w-[220px]">
          <Select.Root type="single" name="appPreset" bind:value={presetValue}>
            <Select.Trigger class="w-[220px]" id="settings-preset">
              {presetTriggerContent}
            </Select.Trigger>
            <Select.Content>
              <Select.Group>
                <Select.Label>{t('label_themes', {}, 'Themes')}</Select.Label>
                {#each presetItems as item (item.value)}
                  <Select.Item value={item.value} label={item.label}>
                    {item.label}
                  </Select.Item>
                {/each}
              </Select.Group>
            </Select.Content>
          </Select.Root>
        </div>
      </div>
    {:else}
      <!-- Other tabs: Full layout with toolbar -->
      <div class="flex items-baseline justify-between gap-4 mb-2">
        <h2 class="text-lg font-semibold">{tab}</h2>
        <div class="text-sm opacity-80">{t('context_label', {}, 'Context')}: <span class="font-medium">{ctx}</span></div>
      </div>

      <!-- Top toolbar: search + open chart button -->
      <div class="flex items-center gap-2 mb-3">
        <Input
          type="text"
          class="h-9 px-3 rounded-md bg-background text-foreground border min-w-[220px]"
          placeholder={t('search_placeholder', {}, 'Search…')}
          bind:value={searchQuery}
        />
        <Button type="button" variant="outline" class="px-3 py-1.5 text-sm">
          {t('button_search', {}, 'Search')}
        </Button>
        <Button type="button" class="px-3 py-1.5 text-sm" onclick={openChart}>
          {t('button_open_chart', {}, 'Open chart')}
        </Button>
      </div>

      <!-- Example translated strings in non-settings views -->
      <div class="mb-3">
        <h2 class="text-base font-semibold">{t('new')}</h2>
        <p class="text-sm opacity-80">{t('new_location')}</p>
      </div>

      <!-- Opened contexts list -->
      <div class="mb-3">
        <div class="text-sm font-medium opacity-85 mb-1">{t('opened_contexts', {}, 'Opened contexts')}</div>
        <ul class="space-y-1 max-h-40 overflow-auto pr-1">
          {#each layout.contexts as c}
            <li class="flex items-center justify-between text-sm">
              <Button variant="ghost" class="h-auto p-0 text-left hover:underline" onclick={() => selectContext(c.id)}>
                <span class:font-semibold={layout.selectedContext === c.id}>{c.name}</span>
              </Button>
              {#if layout.selectedContext === c.id}
                <span class="text-xs opacity-70">{t('selected', {}, 'selected')}</span>
              {/if}
            </li>
          {/each}
        </ul>
      </div>

      <div class="flex-1 min-h-0 flex items-center justify-center" use:measureSquare>
        {#if square > 0}
          <div
            class="rounded-md border border-dashed bg-muted/40 text-muted-foreground flex items-center justify-center"
            style={`width:${square}px;height:${square}px`}
          >
            {viewLabel}
          </div>
        {:else}
          <div class="text-sm opacity-60">{t('measuring_space', {}, 'Measuring available space…')}</div>
        {/if}
      </div>
    {/if}
  </div>
</div>
