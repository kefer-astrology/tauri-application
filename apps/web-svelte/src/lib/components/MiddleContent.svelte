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
  import AspectGrid from '$lib/components/AspectGrid.svelte';
  import { effectiveTime, timeNavigation } from '$lib/stores/timeNavigation.svelte';
  import { getCurrentPositions, queryPositions, type Position } from '$lib/stores/data.svelte';
  import { signIdFromLongitude } from '$lib/stores/glyphs.svelte';
  import { DEFAULT_OBSERVABLE_OBJECT_IDS } from '$lib/astrology/observableObjects';
  import { invoke } from '@tauri-apps/api/core';

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

  // Language select value + trigger content (doc-compliant)
  // Make langValue reactive to i18n.lang changes
  let langValue = $state(String(i18n.lang));
  const langTriggerContent = $derived(
    languages.find((l) => l.value === langValue)?.label ?? t('select_language', {}, 'Select language')
  );

  // Sync langValue -> i18n.lang (when user changes select)
  $effect(() => {
    if (langValue !== i18n.lang) {
      setLang(langValue as any);
    }
  });

  // Sync i18n.lang -> langValue (when language changes elsewhere)
  $effect(() => {
    if (i18n.lang !== langValue) {
      langValue = String(i18n.lang);
    }
  });

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

  // square sizing logic
  let contentEl = $state<HTMLDivElement | undefined>(undefined);
  let square = $state(0);

  function recompute() {
    if (!contentEl) return;
    const rect = contentEl.getBoundingClientRect();
    // Keep a safety margin so SVG labels never clip at container edges.
    const size = Math.floor(Math.min(rect.width, rect.height) * 0.99);
    square = size > 0 ? size : 0;
  }

  function formatChartDateTimeUtc(date: Date): string {
    return date.toISOString().slice(0, 19) + 'Z';
  }

  $effect(() => {
    const el = contentEl;
    if (!el) return;
    const ro = new ResizeObserver(() => recompute());
    ro.observe(el);
    queueMicrotask(recompute);
    return () => ro.disconnect();
  });

  // Load positions from database for radix chart
  const selectedChart = $derived(getSelectedChart());
  const currentTime = $derived(effectiveTime());
  let loadedPositions = $state<Position[]>([]);
  let isLoadingPositions = $state(false);
  let positionError = $state<string | null>(null);
  
  // Timestamp navigation state
  let availableTimestamps = $state<string[]>([]);
  let currentTimestampIndex = $state<number>(-1);
  let zoomLevel = $state<number>(1); // 1 = every timestamp, 2 = every 2nd, etc.

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
        house: 1 // TODO: calculate house from position and house cusps
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
    
    console.log('Loaded positions:', loadedPositions.length, 'Mapped to:', Object.keys(ordered));
    
    return ordered;
  });

  // Load all available timestamps when chart changes
  $effect(() => {
    (async () => {
    const chart = selectedChart;
    
    if (!chart || !chart.id) {
      availableTimestamps = [];
      currentTimestampIndex = -1;
      return;
    }

    // In-memory mode (no workspace): use chart dateTime as single timestamp if we have computed data
    if (!layout.workspacePath) {
      if (chart.computed?.positions && Object.keys(chart.computed.positions).length > 0 && chart.dateTime) {
        const dt = chart.dateTime.includes('T') ? chart.dateTime : chart.dateTime.replace(' ', 'T') + 'Z';
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
      console.log(`Querying all positions for chart ${chart.id}...`);
      const allPositions = await queryPositions(chart.id, undefined, undefined, false);
      
      console.log(`Query returned ${allPositions.length} total positions for chart ${chart.id}`);
      
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
        
        // Log all unique timestamps found
        console.log(`Found ${sortedTimestamps.length} unique timestamps for chart ${chart.id}:`, sortedTimestamps);
        console.log(`Sample positions:`, allPositions.slice(0, 3).map(p => ({ 
          datetime: p.datetime, 
          object_id: p.object_id,
          is_radix: p.is_radix 
        })));
        
        if (sortedTimestamps.length === 1) {
          console.warn(`⚠️ Only 1 timestamp found for chart ${chart.id}. This means only the radix/base chart is stored.`);
          console.warn(`To enable time navigation, you need to compute a time series with multiple timestamps.`);
          console.warn(`Current timestamp: ${sortedTimestamps[0]}`);
        } else {
          console.log(`✅ Loaded ${sortedTimestamps.length} unique timestamps for chart ${chart.id}`);
        }
        
        // Find current timestamp index - compare timestamps
        // Helper to parse datetime assuming UTC if no timezone specified
        function parseTimestampAsUTC(dt: string): Date {
          if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(dt)) {
            return new Date(dt.replace(' ', 'T') + 'Z');
          }
          return new Date(dt);
        }
        
        const currentTimeMs = currentTime.getTime();
        const index = sortedTimestamps.findIndex(ts => {
          try {
            const tsDate = parseTimestampAsUTC(ts);
            // Compare within 1 second tolerance
            return Math.abs(tsDate.getTime() - currentTimeMs) < 1000;
          } catch {
            return false;
          }
        });
        if (index >= 0) {
          currentTimestampIndex = index;
          console.log(`Found current timestamp at index ${index}`);
        } else {
          // Find nearest timestamp
          let nearestIndex = 0;
          let minDiff = Math.abs(parseTimestampAsUTC(sortedTimestamps[0]).getTime() - currentTimeMs);
          for (let i = 1; i < sortedTimestamps.length; i++) {
            const diff = Math.abs(parseTimestampAsUTC(sortedTimestamps[i]).getTime() - currentTimeMs);
            if (diff < minDiff) {
              minDiff = diff;
              nearestIndex = i;
            }
          }
          currentTimestampIndex = nearestIndex;
          console.log(`No exact match, using nearest timestamp at index ${nearestIndex}`);
          // Update time to match the nearest timestamp (parse as UTC if needed)
          timeNavigation.currentTime = parseTimestampAsUTC(sortedTimestamps[nearestIndex]);
        }
      } else {
        console.log(`No positions found for chart ${chart.id}`);
        availableTimestamps = [];
        currentTimestampIndex = -1;
      }
    } catch (error) {
      console.error('Failed to load timestamps:', error);
      availableTimestamps = [];
      currentTimestampIndex = -1;
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
    const chart = selectedChart;
    const time = currentTime;
    
    if (!chart || !chart.id) {
      loadedPositions = [];
      return;
    }

    isLoadingPositions = true;
    positionError = null;
    
    try {
      // Load positions for current effective time
      const positions = await getCurrentPositions(chart.id);
      loadedPositions = positions;
    } catch (error) {
      console.error('Failed to load positions:', error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : typeof error === 'string'
        ? error
        : 'Failed to load positions';
      positionError = `Error: ${errorMessage}`;
      console.error('Position loading error details:', {
        chartId: chart?.id,
        workspacePath: layout.workspacePath,
        time: time.toISOString(),
        error
      });
      loadedPositions = [];
    } finally {
      isLoadingPositions = false;
    }
    })();
  });

  // In-memory mode: compute chart from data when no workspace and chart has dateTime + location but no computed positions
  $effect(() => {
    const chart = selectedChart;
    if (!chart?.id || layout.workspacePath) return;
    if (!chart.dateTime?.trim() || !chart.location?.trim()) return;
    if (chart.computed?.positions && Object.keys(chart.computed.positions).length > 0) return;
    const payload = chartDataToComputePayload(chart);
    invoke<{
      positions?: Record<string, unknown>;
      motion?: Record<string, { speed: number; retrograde: boolean }>;
      aspects?: unknown[];
      axes?: { asc: number; desc: number; mc: number; ic: number };
      house_cusps?: number[];
      chart_id?: string;
    }>('compute_chart_from_data', { chartJson: payload })
      .then((result) => {
        updateChartComputation(chart.id, {
          positions: result.positions ?? {},
          motion: result.motion ?? {},
          aspects: result.aspects ?? [],
          axes: result.axes,
          houseCusps: result.house_cusps
        });
      })
      .catch((err) => {
        console.warn('In-memory compute failed for chart', chart.id, err);
      });
  });

  // Recompute the selected chart whenever the effective astrolabe time changes.
  // This keeps stepping/backtracking functional even without a precomputed time series.
  $effect(() => {
    const chart = selectedChart;
    const time = currentTime;

    if (!chart?.id) return;
    if (!chart.location?.trim()) return;

    const targetDateTime = formatChartDateTimeUtc(time);
    const hasComputedPositions = Boolean(chart.computed?.positions && Object.keys(chart.computed.positions).length > 0);
    if (chart.dateTime === targetDateTime && hasComputedPositions) return;

    const chartAtTime = {
      ...chart,
      dateTime: targetDateTime
    };

    invoke<{
      positions?: Record<string, unknown>;
      motion?: Record<string, { speed: number; retrograde: boolean }>;
      aspects?: unknown[];
      axes?: { asc: number; desc: number; mc: number; ic: number };
      house_cusps?: number[];
      chart_id?: string;
    }>('compute_chart_from_data', { chartJson: chartDataToComputePayload(chartAtTime) })
      .then((result) => {
        updateChartComputationAtTime(chart.id, targetDateTime, {
          positions: result.positions ?? {},
          motion: result.motion ?? {},
          aspects: result.aspects ?? [],
          axes: result.axes,
          houseCusps: result.house_cusps
        });
      })
      .catch((err) => {
        console.warn('Astrolabe recompute failed for chart', chart.id, err);
      });
  });

  // Workspace mode: compute real positions when chart has no computed payload yet.
  $effect(() => {
    const chart = selectedChart;
    if (!chart?.id || !layout.workspacePath) return;
    if (chart.computed?.positions && Object.keys(chart.computed.positions).length > 0) return;

    invoke<{
      positions?: Record<string, unknown>;
      motion?: Record<string, { speed: number; retrograde: boolean }>;
      aspects?: unknown[];
      axes?: { asc: number; desc: number; mc: number; ic: number };
      house_cusps?: number[];
      chart_id?: string;
    }>('compute_chart', {
      workspacePath: layout.workspacePath,
      chartId: chart.id,
    })
      .then((result) => {
        updateChartComputation(chart.id, {
          positions: result.positions ?? {},
          motion: result.motion ?? {},
          aspects: result.aspects ?? [],
          axes: result.axes,
          houseCusps: result.house_cusps
        });
      })
      .catch((err) => {
        console.warn('Workspace compute failed for chart', chart.id, err);
      });
  });
  
  // Navigate to next/previous computed timestamp
  function navigateToTimestamp(direction: 'next' | 'prev') {
    console.log(`navigateToTimestamp called: direction=${direction}, availableTimestamps.length=${availableTimestamps.length}, currentIndex=${currentTimestampIndex}, zoomLevel=${zoomLevel}`);
    
    if (availableTimestamps.length === 0) {
      console.log('No timestamps available for navigation');
      return;
    }
    
    if (availableTimestamps.length === 1) {
      console.log('Only 1 timestamp available, cannot navigate');
      return;
    }
    
    if (currentTimestampIndex < 0) {
      console.log('Current timestamp index is invalid:', currentTimestampIndex);
      // Try to find the current time in available timestamps
      const currentTimeStr = currentTime.toISOString();
      const index = availableTimestamps.findIndex(ts => ts === currentTimeStr);
      if (index >= 0) {
        currentTimestampIndex = index;
        console.log(`Found current timestamp at index ${index}`);
      } else {
        // Use first timestamp as fallback
        currentTimestampIndex = 0;
        console.log('Using first timestamp as fallback');
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
      console.log(`Navigating to timestamp ${newIndex + 1}/${availableTimestamps.length}: ${timestamp}`);
      // Parse timestamp assuming UTC if no timezone specified (database format)
      function parseTimestampAsUTC(dt: string): Date {
        if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(dt)) {
          return new Date(dt.replace(' ', 'T') + 'Z');
        }
        return new Date(dt);
      }
      timeNavigation.currentTime = parseTimestampAsUTC(timestamp);
    } else {
      console.log(`Navigation blocked: newIndex=${newIndex}, currentIndex=${currentTimestampIndex}, total=${availableTimestamps.length}, step=${step}`);
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
        console.log('ArrowLeft pressed, navigating to previous timestamp');
        navigateToTimestamp('prev');
      }
      // Right arrow: navigate to next computed timestamp
      else if (e.key === 'ArrowRight' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        console.log('ArrowRight pressed, navigating to next timestamp');
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
      <div class="flex-1 min-h-0 flex items-center justify-center" bind:this={contentEl}>
        {#if square > 0}
          {#if isLoadingPositions}
            <div class="text-sm opacity-60">{t('loading_positions', {}, 'Loading positions…')}</div>
          {:else if positionError}
            <div class="text-sm text-destructive opacity-80">
              Error: {positionError}
            </div>
          {:else}
            <div class="relative w-full h-full flex items-center justify-center">
              <RadixChart size={square} planetPositions={planetPositions()} />
              <!-- Timestamp navigation indicator -->
              {#if availableTimestamps.length > 0}
                <div class="absolute top-2 left-2 text-xs opacity-75 bg-background/80 px-2 py-1 rounded">
                  {#if availableTimestamps.length === 1}
                    <span class="text-yellow-500">⚠️ Only 1 timestamp (compute time series to enable navigation)</span>
                  {:else}
                    {currentTimestampIndex + 1} / {availableTimestamps.length}
                    {#if zoomLevel > 1}
                      <span class="ml-1 opacity-60">(×{zoomLevel})</span>
                    {/if}
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
        <div class="h-full w-full rounded-md border bg-card text-card-foreground shadow-sm flex items-center justify-center" bind:this={contentEl}>
          {#if square > 0}
            <AspectGrid size={square} />
          {:else}
            <div class="text-sm opacity-60">{t('measuring_space', {}, 'Measuring available space…')}</div>
          {/if}
        </div>
      </div>
    {:else if tab === 'Settings'}
      <!-- Language selector lives in Settings -->
      <div class="mb-4 space-y-2">
        <label class="block text-sm font-medium opacity-90" for="settings-lang">{languageLabel}</label>
        <div class="min-w-[220px]">
          <Select.Root type="single" name="appLanguage" bind:value={langValue}>
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

      <div class="flex-1 min-h-0 flex items-center justify-center" bind:this={contentEl}>
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
