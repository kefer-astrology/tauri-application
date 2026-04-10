<script lang="ts">
  import TopBar from '$lib/components/TopBar.svelte';
  import ExpandablePanel from '$lib/components/ExpandablePanel.svelte';
  import MiddleContent from '$lib/components/MiddleContent.svelte';
  import BottomTabs from '$lib/components/BottomTabs.svelte';
  import OpenExportDialog from '$lib/components/OpenExportDialog.svelte';
  import TimeNavigationPanel from '$lib/components/TimeNavigationPanel.svelte';
  import GlyphManager from '$lib/components/GlyphManager.svelte';
  import { layout, type Mode, showOpenExportOverlay, loadChartsFromWorkspace, updateChartComputation, getSelectedChart, chartDataToComputePayload, type ChartData, setMode, setWorkspaceDefaults } from '$lib/state/layout';
  import { invoke } from '@tauri-apps/api/core';
  import { reapplyCurrentPreset, preset, presets, applyPreset, getElementColors, setElementColor, type ElementColorKey } from '$lib/state/theme.svelte';
  import { timeNavigation } from '$lib/stores/timeNavigation.svelte';
  import { t, i18n, setLang } from '$lib/i18n/index.svelte';
  import * as Breadcrumb from '$lib/components/ui/breadcrumb/index.js';
  import * as Accordion from '$lib/components/ui/accordion/index.js';
  import * as Select from '$lib/components/ui/select/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import { Textarea } from '$lib/components/ui/textarea/index.js';
  import { getGlyphContent, signIdFromLongitude, glyphSettings, glyphSetOptions, setGlyphSet, hardResetGlyphStorage, type GlyphSetId } from '$lib/stores/glyphs.svelte';
  import BodySelector from '$lib/components/BodySelector.svelte';
  import PanelMenu from '$lib/components/PanelMenu.svelte';
  import * as Dialog from '$lib/components/ui/dialog/index.js';
  import { onMount } from 'svelte';
  import { stepForward, stepBackward } from '$lib/stores/timeNavigation.svelte';

  let rightExpanded = $state(true);
  let rightBottomExpanded = $state(true);
  // Left column has three panels with independent states
  let leftTopExpanded = $state(true);
  let leftMiddleExpanded = $state(true);
  // Third panel folded by default
  let leftBottomExpanded = $state(false);
  let failedGlyphFiles = $state<Record<string, boolean>>({});

  const mode = $derived(layout.mode as Mode);
  const isRadixLikeMode = $derived(mode === 'radix_view' || mode === 'new_radix');

  // New Radix form state
  let newChartType = $state<string>('NATAL');
  let newContextName = $state('');
  let newDate = $state('');
  let newTime = $state('');
  let newLocation = $state('');
  let newLatitude = $state('');
  let newLongitude = $state('');
  let newHouseSystem = $state('Placidus');
  let newZodiacType = $state('Tropical');
  let newTags = $state('');
  let editingChartId = $state<string | null>(null);
  let advancedExpanded = $state<string | undefined>(undefined);
  
  // Open Chart mode state
  let openMode = $state<'my_radixes' | 'database'>('my_radixes');
  let searchQuery = $state('');

  // Keep new radix type always selected (PanelMenu can clear on second click)
  $effect(() => {
    if (mode === 'new_radix' && (newChartType === undefined || newChartType === '')) {
      newChartType = 'NATAL';
    }
  });

  // Bootstrap a real "current sky" chart when app starts with no charts.
  // This avoids an empty Radix on fresh launch and triggers real computation.
  $effect(() => {
    if (layout.contexts.length > 0) return;

    const now = new Date();
    const dateTime = now.toISOString().slice(0, 19) + 'Z';
    const defaultTimezone = layout.workspaceDefaults.timezone || 'UTC';
    const defaultEngine = layout.workspaceDefaults.engine || 'swisseph';
    const defaultLat = Number.isFinite(layout.workspaceDefaults.locationLatitude)
      ? layout.workspaceDefaults.locationLatitude
      : 0;
    const defaultLon = Number.isFinite(layout.workspaceDefaults.locationLongitude)
      ? layout.workspaceDefaults.locationLongitude
      : 0;
    const defaultLocationName = layout.workspaceDefaults.locationName || 'Unknown';

    const initialChart: ChartData = {
      id: 'current-sky',
      name: 'Current Sky',
      chartType: 'EVENT',
      dateTime,
      // Keep location text numeric so Rust/Python parsers stay deterministic.
      location: `${defaultLocationName} (${defaultLat.toFixed(4)}, ${defaultLon.toFixed(4)})`,
      latitude: defaultLat,
      longitude: defaultLon,
      timezone: defaultTimezone,
      houseSystem: layout.workspaceDefaults.houseSystem,
      zodiacType: layout.workspaceDefaults.zodiacType,
      engine: defaultEngine,
      tags: ['auto'],
    };

    layout.contexts = [initialChart];
    layout.selectedContext = initialChart.id;
  });
  
  // Mock data for horoscopes table
  const horoscopes = $state([
    { name: 'John Doe', chartType: 'NATAL', dateTime: '1990-01-15 10:30', place: 'Prague', tags: 'personal, important' },
    { name: 'Jane Smith', chartType: 'EVENT', dateTime: '2020-05-20 14:00', place: 'Brno', tags: 'work' },
    { name: 'Test Chart', chartType: 'HORARY', dateTime: '2024-01-01 12:00', place: 'London', tags: 'test' }
  ]);
  
  // Export mode state
  let exportType = $state<'print' | 'pdf' | 'png'>('print');
  let exportIncludeLocation = $state(true);
  let exportIncludeAspects = $state(true);
  let exportIncludeInfo = $state(true);
  
  // Info mode state
  let selectedInfoItem = $state<string | undefined>(undefined);
  
  // Transits mode state
  let selectedTransitsSection = $state<string | undefined>('obecne');
  let transitingBodies = $state<string[]>(['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto']);
  let transitedBodies = $state<string[]>(['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto']);
  let selectedAspects = $state<string[]>(['conjunction', 'square', 'trine', 'opposition']);
  let transitSourceChartId = $state<string>('');
  let transitLoading = $state(false);
  let transitError = $state<string | null>(null);
  type TransitSeriesEntry = {
    datetime: string;
    transit_positions?: Record<string, unknown>;
    aspects?: Array<Record<string, unknown>>;
  };
  type TransitSeriesResult = {
    source_chart_id?: string;
    time_range?: { start: string; end: string };
    time_step?: string;
    results?: TransitSeriesEntry[];
  };
  let transitSeries = $state<TransitSeriesEntry[]>([]);
  let transitMeta = $state<TransitSeriesResult | null>(null);
  
  // Settings mode state
  let selectedSettingsSection = $state<string | undefined>('jazyk');
  let settingsChanged = $state(false);

  // Dynamic / Revolution mode state (left menu selection)
  let selectedDynamicSection = $state<string | undefined>(undefined);
  let selectedRevolutionSection = $state<string | undefined>(undefined);
  // Element colors (radix chart) – synced from theme store when opening Vzhled
  let elementColors = $state<Record<ElementColorKey, string>>({
    'element-fire': '#5a5a64',
    'element-earth': '#4a3f35',
    'element-air': '#1e3d38',
    'element-water': '#5c2a2a',
  });
  
  // Language and preset state for settings
  const languages = $derived(
    Object.keys(i18n.dicts).map((code) => ({
      value: code,
      label:
        ({ en: 'English', cs: 'Čeština', es: 'Español', fr: 'Français' } as Record<string, string>)[code] ?? code.toUpperCase()
    }))
  );

  $effect(() => {
    if (!transitSourceChartId && layout.contexts.length > 0) {
      transitSourceChartId = layout.contexts[0].id;
    }
  });

  function stepToSeconds() {
    const { unit, value } = timeNavigation.step;
    switch (unit) {
      case 'seconds':
        return value;
      case 'minutes':
        return value * 60;
      case 'hours':
        return value * 60 * 60;
      case 'days':
        return value * 60 * 60 * 24;
      default:
        return 3600;
    }
  }
  let langValue = $state(String(i18n.lang));
  const langTriggerContent = $derived(
    languages.find((l) => l.value === langValue)?.label ?? t('select_language', {}, 'Select language')
  );
  
  const presetItems = presets.map((p) => ({ value: p.id, label: p.name }));
  let presetValue = $state(String(preset.id));
  const presetTriggerContent = $derived(
    presetItems.find((p) => p.value === presetValue)?.label ?? t('select_preset', {}, 'Select preset')
  );
  let glyphSetValue = $state(String(glyphSettings.activeSet));
  const glyphSetTriggerContent = $derived(
    glyphSetOptions.find((s) => s.id === glyphSetValue)?.label ?? t('select_glyph_set', {}, 'Select glyph set')
  );
  
  // Sync language changes
  $effect(() => {
    if (langValue !== i18n.lang) {
      setLang(langValue as any);
      settingsChanged = true;
    }
  });
  
  // Sync preset changes
  $effect(() => {
    if (presetValue !== String(preset.id)) {
      applyPreset(presetValue);
      settingsChanged = true;
    }
  });

  $effect(() => {
    if (glyphSetValue !== glyphSettings.activeSet) {
      glyphSetValue = glyphSettings.activeSet;
    }
  });

  $effect(() => {
    if (glyphSetValue !== glyphSettings.activeSet && glyphSetOptions.some((s) => s.id === glyphSetValue)) {
      setGlyphSet(glyphSetValue as GlyphSetId);
      settingsChanged = true;
    }
  });

  $effect(() => {
    if (selectedSettingsSection === 'vzhled') {
      elementColors = { ...getElementColors() };
    }
  });

  // Info items structure (all labels translatable)
  const infoItems = $derived([
    {
      id: 'positive_dominances',
      label: t('info_positive_dominances', {}, 'Positive dominances'),
      children: [
        { id: 'dominance_mode_quality', label: t('info_dominance_mode_quality', {}, 'Sign mode/quality dominance') },
        { id: 'dominance_element', label: t('info_dominance_element', {}, 'Element dominance') },
        { id: 'dominance_houses', label: t('info_dominance_houses', {}, 'House dominance') },
        { id: 'dominance_aspects', label: t('info_dominance_aspects', {}, 'Aspect dominance') }
      ]
    },
    {
      id: 'negative_dynamics',
      label: t('info_negative_dynamics', {}, 'Negative dynamics'),
      children: [
        { id: 'negative_quality_signs', label: t('info_negative_quality_signs', {}, 'Sign quality') },
        { id: 'negative_elements', label: t('info_negative_elements', {}, 'Elements') },
        { id: 'negative_houses', label: t('info_negative_houses', {}, 'Houses') },
        { id: 'negative_aspects', label: t('info_negative_aspects', {}, 'Aspects') }
      ]
    },
    { id: 'quadrant_division', label: t('info_quadrant_division', {}, 'Quadrant division') },
    { id: 'sabian_symbols', label: t('info_sabian_symbols', {}, 'Sabian symbols') },
    { id: 'detailed_planet_positions', label: t('info_detailed_planet_positions', {}, 'Detailed planet positions') },
    { id: 'horoscope_shape_diagram', label: t('info_horoscope_shape_diagram', {}, 'Horoscope shape diagram') },
    { id: 'hemisphere_emphasis', label: t('info_hemisphere_emphasis', {}, 'Hemisphere emphasis') },
    { id: 'singleton_hemisphere', label: t('info_singleton_hemisphere', {}, 'Singleton in hemisphere') },
    { id: 'stellium', label: t('info_stellium', {}, 'Stellium') },
    { id: 'planetary_configuration', label: t('info_planetary_configuration', {}, 'Planetary configuration') },
    { id: 'lunar_phases', label: t('info_lunar_phases', {}, 'Lunar phases') },
    { id: 'sun_moon_horizon', label: t('info_sun_moon_horizon', {}, 'Sun and Moon (horizon)') },
    { id: 'mercury', label: t('info_mercury', {}, 'Mercury') },
    { id: 'venus', label: t('info_venus', {}, 'Venus') },
    { id: 'extroversion_introversion_ratio', label: t('info_extroversion_introversion_ratio', {}, 'Extraversion–introversion ratio') },
    {
      id: 'focal_planets',
      label: t('info_focal_planets', {}, 'Focal planets'),
      children: [
        { id: 'final_dispositor', label: t('info_final_dispositor', {}, 'Final dispositor') },
        { id: 'horoscope_ruler', label: t('info_horoscope_ruler', {}, 'Chart ruler') },
        { id: 'singleton', label: t('info_singleton', {}, 'Singleton') },
        { id: 'angular_planet', label: t('info_angular_planet', {}, 'Angular planet') },
        { id: 'by_position', label: t('info_by_position', {}, 'By position') },
        { id: 'unaspect_planets', label: t('info_unaspect_planets', {}, 'Unaspected planets') },
        { id: 'focal_planet', label: t('info_focal_planet', {}, 'Focal planet') },
        { id: 'trigger_planet', label: t('info_trigger_planet', {}, 'Trigger planet') },
        { id: 'planets_abstract_points', label: t('info_planets_abstract_points', {}, 'Planets and abstract points') }
      ]
    }
  ]);

  const settingsMenuItems = $derived([
    { id: 'jazyk', label: t('section_jazyk', {}, 'Language') },
    { id: 'lokace', label: t('section_lokace', {}, 'Location') },
    { id: 'system_domu', label: t('section_system_domu', {}, 'House system') },
    { id: 'nastaveni_aspektu', label: t('section_nastaveni_aspektu', {}, 'Aspect settings') },
    { id: 'vzhled', label: t('section_vzhled', {}, 'Appearance') },
    { id: 'manual', label: t('section_manual', {}, 'Manual') },
  ]);

  const transitsMenuItems = $derived([
    { id: 'obecne', label: t('transits_menu_general', {}, 'General') },
    { id: 'transiting', label: t('transits_menu_transiting', {}, 'Transiting bodies') },
    { id: 'transited', label: t('transits_menu_transited', {}, 'Transited bodies') },
    { id: 'aspects', label: t('transits_menu_aspects_used', {}, 'Aspects used') },
  ]);

  const newRadixMenuItems = $derived([
    { id: 'NATAL', label: t('new_type_radix', {}, 'Radix') },
    { id: 'EVENT', label: t('new_type_event', {}, 'Event') },
    { id: 'HORARY', label: t('new_type_horary', {}, 'Horary') },
    { id: 'COMPOSITE', label: t('new_type_composite', {}, 'Composite') },
  ]);

  const dynamicMenuItems = $derived([
    { id: 'overview', label: t('overview', {}, 'Overview') },
    { id: 'charts', label: t('charts', {}, 'Charts') },
  ]);

  const revolutionMenuItems = $derived([
    { id: 'solar', label: t('revolution_solar', {}, 'Solar') },
    { id: 'lunar', label: t('revolution_lunar', {}, 'Lunar') },
  ]);

  // Planet positions for right Radix table
  // Get planets from selected chart's computed data, or use defaults
  const selectedChart = $derived(getSelectedChart());
  const defaultBodyOrder = [
    'sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto',
    'asc', 'mc', 'ic', 'desc', 'north_node', 'south_node', 'lilith', 'chiron'
  ];
  const fullBodyOrder = $derived(
    layout.workspaceDefaults.defaultBodies.length > 0
      ? layout.workspaceDefaults.defaultBodies
      : defaultBodyOrder
  );

  function normalizeLongitude(value: number): number {
    return ((value % 360) + 360) % 360;
  }

  function toLongitude(position: unknown): number | null {
    if (typeof position === 'number') {
      return normalizeLongitude(position);
    }
    if (position && typeof position === 'object') {
      const lon = Number((position as Record<string, unknown>).longitude ?? NaN);
      if (!Number.isNaN(lon)) return normalizeLongitude(lon);
    }
    return null;
  }

  function getHouseCusps(computed: Record<string, unknown>): number[] {
    const cusps: number[] = [];
    for (let i = 1; i <= 12; i += 1) {
      const key = `house_${i}`;
      const lon = toLongitude(computed[key]);
      if (lon == null) return [];
      cusps.push(lon);
    }
    return cusps;
  }

  function locateHouse(longitude: number, cusps: number[]): { house: number; positionInHouse: number } {
    if (cusps.length !== 12) {
      return {
        house: Math.floor(longitude / 30) + 1,
        positionInHouse: longitude % 30,
      };
    }

    for (let i = 0; i < 12; i += 1) {
      const start = cusps[i];
      const end = cusps[(i + 1) % 12];
      const span = ((end - start) + 360) % 360 || 360;
      const dist = ((longitude - start) + 360) % 360;
      if (dist <= span) {
        return {
          house: i + 1,
          positionInHouse: dist,
        };
      }
    }

    return {
      house: Math.floor(longitude / 30) + 1,
      positionInHouse: longitude % 30,
    };
  }

  const planets = $derived.by(() => {
    const computed = selectedChart?.computed?.positions;
    if (!computed) {
      return {};
    }

    const result: Record<string, { longitude: number; signName: string; house: number; positionInHouse: number }> = {};
    const computedRecord = computed as Record<string, unknown>;
    const cusps = getHouseCusps(computedRecord);
    for (const [name, position] of Object.entries(computedRecord)) {
      if (/^house_\d+$/i.test(name)) continue;
      const longitude = toLongitude(position);
      if (longitude == null) continue;
      const { house, positionInHouse } = locateHouse(longitude, cusps);
      result[name] = {
        longitude,
        signName: signIdFromLongitude(longitude),
        house,
        positionInHouse,
      };
    }

    const orderedEntries = Object.entries(result).sort(([a], [b]) => {
      const ai = fullBodyOrder.indexOf(a.toLowerCase());
      const bi = fullBodyOrder.indexOf(b.toLowerCase());
      if (ai !== -1 || bi !== -1) {
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      }
      return a.localeCompare(b);
    });

    return Object.fromEntries(orderedEntries);
  });

  const planetRows = $derived.by(() => Object.entries(planets ?? {}));
  
  // Chart details for left expander: always show selected chart fields with sensible display defaults
  const chartDetails = $derived.by(() => {
    const chart = selectedChart;
    if (!chart) {
      return {
        chartType: 'NATAL' as const,
        date: '',
        time: '',
        location: '',
        latitude: '',
        longitude: '',
        timezone: '',
        houseSystem: '—',
        zodiacType: '—',
        engine: '—',
        model: '—',
        overrideEphemeris: '—',
        tags: '',
      };
    }
    const dateTime = chart.dateTime?.trim() ?? '';
    const dateTimeParts = dateTime.includes('T')
      ? dateTime.split('T')
      : dateTime.split(/\s+/);
    const date = dateTimeParts[0] ?? '';
    const timeRaw = (dateTimeParts[1] ?? '').split('.')[0] ?? '';
    const time = timeRaw.replace(/Z$/i, '').trim();
    return {
      chartType: (chart.chartType || 'NATAL') as 'NATAL' | 'EVENT' | 'HORARY' | 'COMPOSITE',
      date,
      time,
      location: chart.location ?? '',
      latitude: chart.latitude != null ? String(chart.latitude) : '',
      longitude: chart.longitude != null ? String(chart.longitude) : '',
      timezone: chart.timezone ?? '',
      houseSystem: chart.houseSystem && chart.houseSystem.trim() !== '' ? chart.houseSystem : 'Placidus',
      zodiacType: chart.zodiacType && chart.zodiacType.trim() !== '' ? chart.zodiacType : 'Tropical',
      engine: chart.engine && chart.engine.trim() !== '' ? chart.engine : '—',
      model: chart.model && chart.model.trim() !== '' ? chart.model : '—',
      overrideEphemeris: chart.overrideEphemeris && chart.overrideEphemeris.trim() !== '' ? chart.overrideEphemeris : '—',
      tags: Array.isArray(chart.tags) ? chart.tags.join(', ') : (chart.tags ?? ''),
    };
  });

  function parseDateTime(dateTime: string) {
    const trimmed = dateTime?.trim();
    if (!trimmed) {
      return { date: '', time: '' };
    }
    const parts = trimmed.includes('T') ? trimmed.split('T') : trimmed.split(' ');
    const date = parts[0] || '';
    const time = parts[1]?.split('.')[0]?.slice(0, 5) || '';
    return { date, time };
  }

  function populateFormFromChart(chart: ChartData) {
    const { date, time } = parseDateTime(chart.dateTime);
    newContextName = chart.name;
    newDate = date;
    newTime = time;
    newLocation = chart.location || '';
    newLatitude = chart.latitude?.toString() || '';
    newLongitude = chart.longitude?.toString() || '';
    newHouseSystem = chart.houseSystem || 'Placidus';
    newZodiacType = chart.zodiacType || 'Tropical';
    newTags = chart.tags.join(', ');
    newChartType = chart.chartType ?? 'NATAL';
  }

  function applyFormReset() {
    newContextName = '';
    newDate = '';
    newTime = '';
    newLocation = '';
    newLatitude = '';
    newLongitude = '';
    newTags = '';
    newChartType = 'NATAL';
    newHouseSystem = 'Placidus';
    newZodiacType = 'Tropical';
    editingChartId = null;
  }
  
  // Initialize time navigation when chart is selected
  $effect(() => {
    const chart = selectedChart;
    if (chart && chart.dateTime) {
      try {
        // Parse the chart's event time
        const chartDate = new Date(chart.dateTime);
        if (!isNaN(chartDate.getTime())) {
          // Set the current time to the chart's event time
          timeNavigation.currentTime = chartDate;
          // Set time range around the chart time (default: 1 day before/after)
          const oneDay = 24 * 60 * 60 * 1000;
          timeNavigation.startTime = new Date(chartDate.getTime() - oneDay);
          timeNavigation.endTime = new Date(chartDate.getTime() + oneDay);
        }
      } catch (err) {
        console.error('Failed to parse chart date:', err);
      }
    }
  });
  
  function normalizeChartId(name: string): string {
    return name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '_');
  }

  function nonEmptyOr(value: string, fallback: string): string {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : fallback;
  }

  function parseOptionalNumber(value: string): number | undefined {
    const normalized = value.trim();
    if (!normalized) return undefined;
    const num = Number(normalized);
    return Number.isFinite(num) ? num : undefined;
  }

  function buildChartFromForm(chartId: string): ChartData {
    const wsDefaults = layout.workspaceDefaults;
    const tags = newTags
      .split(',')
      .map(tag => tag.trim())
      .filter(Boolean);
    const dateTime = [newDate.trim(), newTime.trim()].filter(Boolean).join(' ');
    const latitude = parseOptionalNumber(newLatitude);
    const longitude = parseOptionalNumber(newLongitude);

    return {
      id: chartId,
      name: newContextName.trim(),
      chartType: newChartType as 'NATAL' | 'EVENT' | 'HORARY' | 'COMPOSITE',
      dateTime,
      location: nonEmptyOr(newLocation, wsDefaults.locationName),
      latitude,
      longitude,
      timezone: wsDefaults.timezone,
      houseSystem: nonEmptyOr(newHouseSystem, wsDefaults.houseSystem),
      zodiacType: nonEmptyOr(newZodiacType, wsDefaults.zodiacType),
      engine: wsDefaults.engine,
      model: null,
      overrideEphemeris: null,
      tags,
    };
  }

  async function submitNewContext(e?: Event) {
    e?.preventDefault?.();
    const n = newContextName.trim();
    if (!n) return;

    const chartId = editingChartId ?? normalizeChartId(n);
    const formChart = buildChartFromForm(chartId);

    if (layout.workspacePath) {
      const payload = chartDataToComputePayload(formChart);
      try {
        if (editingChartId) {
          await invoke<string>('update_chart', {
            workspacePath: layout.workspacePath,
            chartId: editingChartId,
            chart: payload,
          });
        } else {
          await invoke<string>('create_chart', {
            workspacePath: layout.workspacePath,
            chart: payload,
          });
        }
      } catch (err) {
        console.error('Failed to persist chart to workspace:', err);
        return;
      }
    }

    if (editingChartId) {
      layout.contexts = layout.contexts.map(chart =>
        chart.id === editingChartId
          ? { ...chart, ...formChart, id: editingChartId }
          : chart
      );
      layout.selectedContext = editingChartId;
      layout.selectedTab = 'Radix';
      setMode('radix_view');
    } else {
      if (layout.contexts.some((chart) => chart.id === chartId)) {
        console.error(`Chart with id ${chartId} already exists in memory`);
        return;
      }
      layout.contexts = [...layout.contexts, formChart];
      layout.selectedContext = chartId;
      layout.selectedTab = 'Radix';
      setMode('radix_view');
    }

    applyFormReset();
  }

  // Note: Keyboard navigation for timestamp navigation is now handled in MiddleContent.svelte
  // where the timestamp data is available

  // New mode should always create a fresh chart unless edit mode was explicitly set from Radix view.
  let prevMode = $state(layout.mode);
  $effect(() => {
    const currentMode = layout.mode;
    const justEnteredNewRadix = currentMode === 'new_radix' && prevMode !== 'new_radix';
    const justLeftNewRadix = prevMode === 'new_radix' && currentMode !== 'new_radix';

    if (justLeftNewRadix) {
      // Do not carry edit mode outside the form lifecycle.
      editingChartId = null;
    }

    if (justEnteredNewRadix) {
      // If edit mode wasn't explicitly activated (via Radix view edit action),
      // start with a clean "new chart" form.
      if (!editingChartId) {
        applyFormReset();
      }
    }

    prevMode = currentMode;
  });

  // Ensure current preset is applied at app start and when theme class changes externally
  onMount(() => {
    // Apply once on mount (in case no component called applyPreset yet)
    reapplyCurrentPreset();
    // If the <html> class toggles (e.g., system/theme toggle), re-apply the preset's vars
    const mo = new MutationObserver(() => reapplyCurrentPreset());
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  });
</script>

<!-- Root layout: full viewport height, three rows by percentages -->
<div class="h-screen w-screen grid grid-rows-[15%_75%_10%] bg-gradient-to-br from-[#274f73] to-[#242460] text-foreground select-none box-border overflow-x-hidden">
  <!-- Top: 15% height -->
  <header class="row-span-1">
    <TopBar />
  </header>

  <!-- Middle: 75% height -->
  {#if mode === 'new_radix' || mode === 'open' || mode === 'info' || mode === 'dynamic' || mode === 'revolution' || mode === 'favorite' || mode === 'settings' || mode === 'export'}
    <!-- Left 20% + middle stretched to 80% -->
    <section class="row-span-1 grid gap-x-3 gap-y-3 px-3 pb-3 overflow-hidden w-full" style:grid-template-columns="minmax(0,20%) minmax(0,80%)">
      <!-- Left single panel -->
      <div class="h-full min-w-0 flex flex-col gap-2 min-h-0 bg-panel rounded-md overflow-hidden">
        <div class="min-h-0 flex-1">
          <ExpandablePanel 
            title={
              mode === 'settings' ? t('settings', {}, 'Settings')
              : mode === 'open' ? t('open_chart', {}, 'Open Chart')
              : mode === 'info' ? t('info', {}, 'Info')
              : mode === 'dynamic' ? t('dynamic', {}, 'Dynamic')
              : mode === 'revolution' ? t('revolution', {}, 'Revolution')
              : mode === 'favorite' ? t('favorite', {}, 'Favorite')
              : t('new', {}, 'New')
            } 
            editable={false}
          >
            {#snippet children()}
              {#if mode === 'new_radix'}
                <PanelMenu items={newRadixMenuItems} bind:selectedId={newChartType} />
              {:else if mode === 'open'}
                {@const openModes = [
                  { value: 'my_radixes', label: t('open_mode_my_radixes', {}, 'My Radixes') },
                  { value: 'database', label: t('open_mode_database', {}, 'Persons Database') }
                ]}
                <div class="space-y-3">
                  <Breadcrumb.Root>
                    <Breadcrumb.List class="flex flex-col gap-1.5">
                      {#each openModes as modeItem}
                        <Breadcrumb.Item>
                          {#if openMode === modeItem.value}
                            <Breadcrumb.Page 
                              class="px-2 py-1.5 text-sm font-semibold underline underline-offset-4 text-panel-foreground"
                            >
                              {modeItem.label}
                            </Breadcrumb.Page>
                          {:else}
                            <Breadcrumb.Link>
                              {#snippet child({ props })}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  class={`${props.class ?? ''} px-2 py-1.5 text-sm text-panel-foreground/80 bg-transparent hover:bg-transparent hover:underline transition-colors w-full text-left rounded-md`}
                                  onclick={() => openMode = modeItem.value as typeof openMode}
                                >
                                  {modeItem.label}
                                </Button>
                              {/snippet}
                            </Breadcrumb.Link>
                          {/if}
                        </Breadcrumb.Item>
                      {/each}
                    </Breadcrumb.List>
                  </Breadcrumb.Root>
                </div>
              {:else if mode === 'export'}
                {@const exportTypes = [
                  { value: 'print', label: t('export_type_print', {}, 'Print') },
                  { value: 'pdf', label: t('export_type_pdf', {}, 'Export PDF') },
                  { value: 'png', label: t('export_type_png', {}, 'Export PNG') }
                ]}
                <div class="space-y-3">
                  <Breadcrumb.Root>
                    <Breadcrumb.List class="flex flex-col gap-1.5">
                      {#each exportTypes as typeItem}
                        <Breadcrumb.Item>
                          {#if exportType === typeItem.value}
                            <Breadcrumb.Page 
                              class="px-2 py-1.5 text-sm font-semibold underline underline-offset-4 text-panel-foreground"
                            >
                              {typeItem.label}
                            </Breadcrumb.Page>
                          {:else}
                            <Breadcrumb.Link>
                              {#snippet child({ props })}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  class={`${props.class ?? ''} px-2 py-1.5 text-sm text-panel-foreground/80 bg-transparent hover:bg-transparent hover:underline transition-colors w-full text-left rounded-md`}
                                  onclick={() => exportType = typeItem.value as typeof exportType}
                                >
                                  {typeItem.label}
                                </Button>
                              {/snippet}
                            </Breadcrumb.Link>
                          {/if}
                        </Breadcrumb.Item>
                      {/each}
                    </Breadcrumb.List>
                  </Breadcrumb.Root>
                </div>
              {:else if mode === 'info'}
                <PanelMenu items={infoItems} bind:selectedId={selectedInfoItem} />
              {:else if mode === 'settings'}
                <PanelMenu items={settingsMenuItems} bind:selectedId={selectedSettingsSection} />
              {:else if mode === 'dynamic'}
                <PanelMenu items={dynamicMenuItems} bind:selectedId={selectedDynamicSection} />
              {:else if mode === 'revolution'}
                <PanelMenu items={revolutionMenuItems} bind:selectedId={selectedRevolutionSection} />
              {:else}
                <div class="text-sm opacity-85">{t('mode_view_description', { mode: t(mode, {}, mode) }, 'Use the center panel for {mode} view.')}</div>
                <div class="mt-4">
                  <div class="text-sm font-medium opacity-85 mb-2">{t('list_items', {}, 'Contexts')}</div>
                  <ul class="space-y-1 max-h-40 overflow-auto pr-1">
                    {#each layout.contexts as c}
                      <li class="flex items-center justify-between text-sm">
                        <span class:font-semibold={layout.selectedContext === c.id}>{c.name}</span>
                        {#if layout.selectedContext === c.id}
                          <span class="text-xs opacity-70">{t('selected', {}, 'selected')}</span>
                        {/if}
                      </li>
                    {/each}
                  </ul>
                </div>
              {/if}
            {/snippet}
          </ExpandablePanel>
        </div>
      </div>

      <!-- Middle content spans remaining width -->
      <div class="h-full min-w-0">
        {#if mode === 'new_radix'}
          <div class="h-full w-full rounded-md border bg-card text-card-foreground shadow-sm p-4 flex flex-col overflow-y-auto">
            <h2 class="text-lg font-semibold mb-4">{t('new', {}, 'New')}</h2>
            <form class="space-y-4 w-full max-w-2xl" onsubmit={submitNewContext}>
              <!-- Name -->
              <div class="space-y-1">
                <label class="block text-sm font-medium opacity-85" for="ctxNameCenter">
                  {t('new_name', {}, 'Name')}
                </label>
                <Input
                  id="ctxNameCenter"
                  type="text"
                  class="w-full h-9 px-3 rounded-md bg-background text-foreground border"
                  bind:value={newContextName}
                  placeholder={t('new_context_placeholder', {}, 'e.g. John Doe')}
                />
              </div>
              
              <!-- Date and Time -->
              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-1">
                  <label class="block text-sm font-medium opacity-85" for="new-date">
                    {t('new_date', {}, 'Date')}
                  </label>
                  <Input
                    id="new-date"
                    type="date"
                    class="w-full h-9 px-3 rounded-md bg-background text-foreground border"
                    bind:value={newDate}
                  />
                </div>
                <div class="space-y-1">
                  <label class="block text-sm font-medium opacity-85" for="new-time">
                    {t('new_time', {}, 'Time')}
                  </label>
                  <Input
                    id="new-time"
                    type="time"
                    class="w-full h-9 px-3 rounded-md bg-background text-foreground border"
                    bind:value={newTime}
                  />
                </div>
              </div>
              
              <!-- Location -->
              <div class="space-y-1">
                <label class="block text-sm font-medium opacity-85" for="new-location">
                  {t('new_location', {}, 'Location')}
                </label>
                <div class="flex gap-2">
                  <Input
                    id="new-location"
                    type="text"
                    class="flex-1 h-9 px-3 rounded-md bg-background text-foreground border"
                    bind:value={newLocation}
                    placeholder={t('new_location_search', {}, 'Search')}
                  />
                  <Button 
                    type="button" 
                    class="px-3 py-1.5 rounded-md bg-transparent border hover:bg-white/10 text-sm"
                    title={t('new_location_search', {}, 'Search')}
                  >
                    🔍
                  </Button>
                </div>
              </div>
              
              <!-- Tags -->
              <div class="space-y-1">
                <label class="block text-sm font-medium opacity-85" for="new-tags">
                  {t('new_tags', {}, 'Tags')}
                </label>
                <Input
                  id="new-tags"
                  type="text"
                  class="w-full h-9 px-3 rounded-md bg-background text-foreground border"
                  bind:value={newTags}
                  placeholder={t('placeholder_tags_example', {}, 'e.g. personal, important')}
                />
              </div>
              
              <!-- Advanced Settings -->
              <Accordion.Root bind:value={advancedExpanded} type="single">
                <Accordion.Item value="advanced">
                  <Accordion.Trigger class="text-sm font-medium opacity-85">
                    {t('new_advanced', {}, 'Advanced')}
                  </Accordion.Trigger>
                  <Accordion.Content>
                    <div class="space-y-3 pt-2">
                      <div class="space-y-1">
                        <div class="block text-xs font-medium opacity-75">
                          {t('new_advanced_coords', {}, 'Coords')}
                        </div>
                        <div class="grid grid-cols-2 gap-2">
                          <Input
                            type="text"
                            class="w-full h-8 px-2 rounded-md bg-background text-foreground border text-xs"
                            placeholder={t('placeholder_latitude', {}, 'Latitude')}
                            bind:value={newLatitude}
                          />
                          <Input
                            type="text"
                            class="w-full h-8 px-2 rounded-md bg-background text-foreground border text-xs"
                            placeholder={t('placeholder_longitude', {}, 'Longitude')}
                            bind:value={newLongitude}
                          />
                        </div>
                      </div>
                      <div class="space-y-1">
                        <div class="block text-xs font-medium opacity-75">
                          {t('house_system', {}, 'House System')}
                        </div>
                        <Select.Root type="single" bind:value={newHouseSystem}>
                          <Select.Trigger class="w-full h-8 px-2 text-xs">{newHouseSystem}</Select.Trigger>
                          <Select.Content>
                            <Select.Group>
                              <Select.Item value="Placidus" label="Placidus">Placidus</Select.Item>
                              <Select.Item value="Whole Sign" label="Whole Sign">Whole Sign</Select.Item>
                              <Select.Item value="Campanus" label="Campanus">Campanus</Select.Item>
                              <Select.Item value="Koch" label="Koch">Koch</Select.Item>
                              <Select.Item value="Equal" label="Equal">Equal</Select.Item>
                              <Select.Item value="Regiomontanus" label="Regiomontanus">Regiomontanus</Select.Item>
                              <Select.Item value="Vehlow" label="Vehlow">Vehlow</Select.Item>
                              <Select.Item value="Porphyry" label="Porphyry">Porphyry</Select.Item>
                              <Select.Item value="Alcabitius" label="Alcabitius">Alcabitius</Select.Item>
                            </Select.Group>
                          </Select.Content>
                        </Select.Root>
                      </div>
                      <div class="space-y-1">
                        <div class="block text-xs font-medium opacity-75">
                          {t('zodiac_type', {}, 'Zodiac Type')}
                        </div>
                        <Select.Root type="single" bind:value={newZodiacType}>
                          <Select.Trigger class="w-full h-8 px-2 text-xs">{newZodiacType}</Select.Trigger>
                          <Select.Content>
                            <Select.Group>
                              <Select.Item value="Tropical" label="Tropical">Tropical</Select.Item>
                              <Select.Item value="Sidereal" label="Sidereal">Sidereal</Select.Item>
                            </Select.Group>
                          </Select.Content>
                        </Select.Root>
                      </div>
                      <div class="space-y-1">
                        <div class="block text-xs font-medium opacity-75">
                          {t('new_advanced_date', {}, 'Date')}
                        </div>
                        <div class="flex gap-2">
                          <Button type="button" class="flex-1 px-2 py-1 text-xs rounded border hover:bg-white/10">
                            {t('new_advanced_date_gregorian', {}, 'Gregorian')}
                          </Button>
                          <Button type="button" class="flex-1 px-2 py-1 text-xs rounded border hover:bg-white/10">
                            {t('new_advanced_date_julian', {}, 'Julian')}
                          </Button>
                        </div>
                      </div>
                      <div class="space-y-1">
                        <div class="block text-xs font-medium opacity-75">
                          {t('new_advanced_timezone', {}, 'Timezone')}
                        </div>
                        <Input
                          type="text"
                          class="w-full h-8 px-2 rounded-md bg-background text-foreground border text-xs"
                          placeholder={t('placeholder_utc_offset', {}, 'UTC offset')}
                        />
                      </div>
                      <div class="space-y-1">
                        <div class="block text-xs font-medium opacity-75">
                          {t('new_notes', {}, 'Notes')}
                        </div>
                        <Textarea
                          class="w-full min-h-20 px-2 py-1 text-xs resize-none"
                          placeholder={t('placeholder_notes', {}, 'Additional notes...')}
                        ></Textarea>
                      </div>
                    </div>
                  </Accordion.Content>
                </Accordion.Item>
              </Accordion.Root>
              
              <!-- Submit buttons -->
              <div class="flex gap-2 pt-2">
                <Button type="submit" class="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90">
                  {editingChartId ? t('save', {}, 'Save') : t('add', {}, 'Add')}
                </Button>
                <Button 
                  type="button" 
                  class="px-4 py-2 rounded-md bg-transparent border hover:bg-white/10"
                  onclick={() => {
                    applyFormReset();
                  }}
                >
                  {t('clear', {}, 'Clear')}
                </Button>
              </div>
            </form>
          </div>
        {:else if mode === 'open'}
          <div class="h-full w-full rounded-md border bg-card text-card-foreground shadow-sm p-4 flex flex-col overflow-hidden">
            {#if openMode === 'my_radixes'}
              <!-- My Radixes: Table view -->
              <div class="flex flex-col h-full">
                <!-- Top toolbar: Open buttons + Search -->
                <div class="flex items-center gap-2 mb-4">
                  <Button 
                    class="px-4 py-2"
                    onclick={async () => {
                      try {
                        const folderPath = await invoke<string | null>('open_folder_dialog');
                        if (folderPath) {
                          const workspace = await invoke<{
                            path: string;
                            owner: string;
                            active_model: string | null;
                            charts: Array<{
                              id: string;
                              name: string;
                              chart_type: string;
                              date_time: string;
                              location: string;
                              tags: string[];
                            }>;
                          }>('load_workspace', { workspacePath: folderPath });

                          try {
                            const workspaceDefaults = await invoke<{
                              default_house_system?: string | null;
                              default_timezone?: string | null;
                              default_location_name?: string | null;
                              default_location_latitude?: number | null;
                              default_location_longitude?: number | null;
                              default_engine?: string | null;
                              default_bodies?: string[] | null;
                              default_aspects?: string[] | null;
                            }>('get_workspace_defaults', { workspacePath: folderPath });

                            setWorkspaceDefaults({
                              houseSystem: workspaceDefaults.default_house_system ?? undefined,
                              timezone: workspaceDefaults.default_timezone ?? undefined,
                              locationName: workspaceDefaults.default_location_name ?? undefined,
                              locationLatitude: workspaceDefaults.default_location_latitude ?? undefined,
                              locationLongitude: workspaceDefaults.default_location_longitude ?? undefined,
                              engine: workspaceDefaults.default_engine ?? undefined,
                              defaultBodies: workspaceDefaults.default_bodies ?? undefined,
                              defaultAspects: workspaceDefaults.default_aspects ?? undefined,
                            });
                          } catch (defaultsErr) {
                            console.warn('Failed to load workspace defaults, using current defaults:', defaultsErr);
                          }
                          
                          // Load full chart data to get all settings
                          const charts: ChartData[] = [];
                          for (const ch of workspace.charts) {
                            // Get full chart data from Rust
                            try {
                              const fullChart = await invoke<{
                                id: string;
                                subject: {
                                  id: string;
                                  name: string;
                                  event_time: string | null;
                                  location: {
                                    name: string;
                                    latitude: number;
                                    longitude: number;
                                    timezone: string;
                                  };
                                };
                                config: {
                                  mode: string;
                                  house_system: string | null;
                                  zodiac_type: string;
                                  engine: string | null;
                                  model: string | null;
                                  override_ephemeris: string | null;
                                };
                                tags: string[];
                              }>('get_chart_details', {
                                workspacePath: folderPath,
                                chartId: ch.id
                              });
                              
                              charts.push({
                                id: fullChart.id,
                                name: fullChart.subject.name,
                                chartType: fullChart.config.mode,
                                dateTime: fullChart.subject.event_time || '',
                                location: fullChart.subject.location.name,
                                latitude: fullChart.subject.location.latitude,
                                longitude: fullChart.subject.location.longitude,
                                timezone: fullChart.subject.location.timezone,
                                houseSystem: fullChart.config.house_system,
                                zodiacType: fullChart.config.zodiac_type,
                                engine: fullChart.config.engine,
                                model: fullChart.config.model,
                                overrideEphemeris: fullChart.config.override_ephemeris,
                                tags: fullChart.tags,
                              });
                            } catch (err) {
                              console.error(`Failed to load full chart data for ${ch.id}:`, err);
                              // Fallback to summary data
                              charts.push({
                                id: ch.id,
                                name: ch.name,
                                chartType: ch.chart_type,
                                dateTime: ch.date_time,
                                location: ch.location,
                                tags: ch.tags,
                              });
                            }
                          }
                          
                          loadChartsFromWorkspace(charts);
                          layout.workspacePath = workspace.path;
                          await invoke<string>('init_storage', { workspacePath: workspace.path });
                          
                          // Trigger computation for all charts
                          for (const chart of charts) {
                            try {
                              const result = await invoke<{
                                positions: Record<string, number>;
                                aspects: any[];
                                chart_id: string;
                              }>('compute_chart', {
                                workspacePath: workspace.path,
                                chartId: chart.id
                              });
                              
                              updateChartComputation(chart.id, {
                                positions: result.positions,
                                aspects: result.aspects
                              });
                            } catch (err) {
                              console.error(`Failed to compute chart ${chart.id}:`, err);
                            }
                          }
                        }
                      } catch (err) {
                        console.error('Failed to load workspace:', err);
                      }
                    }}
                  >
                    {t('open_workspace', {}, 'Open Workspace')}
                  </Button>
                  <Button
                    variant="outline"
                    class="px-4 py-2"
                    onclick={async () => {
                      try {
                        if (layout.contexts.length === 0) {
                          console.warn('No charts to save');
                          return;
                        }
                        let folderPath: string | null = layout.workspacePath;
                        if (!folderPath) {
                          folderPath = await invoke<string | null>('open_folder_dialog');
                        }
                        if (folderPath) {
                          const chartsPayload = layout.contexts.map((c) => chartDataToComputePayload(c));
                          await invoke<string>('save_workspace', {
                            workspacePath: folderPath,
                            owner: 'User',
                            charts: chartsPayload,
                          });
                          await invoke<string>('init_storage', { workspacePath: folderPath });
                          layout.workspacePath = folderPath;
                        }
                      } catch (err) {
                        console.error('Failed to save workspace:', err);
                      }
                    }}
                  >
                    {t('save_workspace', {}, 'Save Workspace')}
                  </Button>
                  <Button
                    variant="outline"
                    class="px-4 py-2"
                    onclick={async () => {
                      // TODO: Implement single radix file opening
                      console.log('Open Radix - to be implemented');
                    }}
                  >
                    {t('open_radix', {}, 'Open Radix')}
                  </Button>
                  <Input
                    type="text"
                    class="flex-1 max-w-md"
                    bind:value={searchQuery}
                    placeholder={t('search_fulltext', {}, 'Fulltext search')}
                  />
                </div>
                
                <!-- Table -->
                <div class="flex-1 overflow-auto">
                  <table class="w-full border-collapse text-sm">
                    <thead class="sticky top-0 bg-background border-b">
                      <tr>
                        <th class="text-left p-2 font-semibold opacity-85">{t('table_name', {}, 'Name')}</th>
                        <th class="text-left p-2 font-semibold opacity-85">{t('table_chart_type', {}, 'Chart Type')}</th>
                        <th class="text-left p-2 font-semibold opacity-85">{t('table_date_time', {}, 'Date & Time')}</th>
                        <th class="text-left p-2 font-semibold opacity-85">{t('table_place', {}, 'Place')}</th>
                        <th class="text-left p-2 font-semibold opacity-85">{t('table_tags', {}, 'Tags')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#each layout.contexts as chart}
                        <tr 
                          class="border-b hover:bg-accent/50 transition-colors cursor-pointer"
                          onclick={() => {
                            layout.selectedContext = chart.id;
                            layout.selectedTab = 'Radix';
                            setMode('radix_view');
                          }}
                        >
                          <td class="p-2">{chart.name}</td>
                          <td class="p-2 opacity-75">
                            {chart.chartType === 'NATAL' ? t('new_type_radix', {}, 'Radix')
                              : chart.chartType === 'EVENT' ? t('new_type_event', {}, 'Event')
                              : chart.chartType === 'HORARY' ? t('new_type_horary', {}, 'Horary')
                              : chart.chartType}
                          </td>
                          <td class="p-2 opacity-75">{chart.dateTime}</td>
                          <td class="p-2 opacity-75">{chart.location}</td>
                          <td class="p-2 opacity-75">{chart.tags.join(', ')}</td>
                        </tr>
                      {/each}
                      {#if layout.contexts.length === 0}
                        <tr>
                          <td colspan="5" class="p-4 text-center opacity-60">
                            {t('no_charts_loaded', {}, 'No charts loaded. Click "Open Workspace" to load charts.')}
                          </td>
                        </tr>
                      {/if}
                    </tbody>
                  </table>
                </div>
              </div>
            {:else}
              <!-- Persons Database: Placeholder -->
              <div class="flex-1 flex items-center justify-center">
                <div class="text-center space-y-2 opacity-60">
                  <p class="text-lg font-medium">{t('open_mode_database', {}, 'Persons Database')}</p>
                  <p class="text-sm">{t('database_placeholder', {}, 'Custom layout for fetching specific persons')}</p>
                </div>
              </div>
            {/if}
          </div>
        {:else if mode === 'export'}
          <div class="h-full w-full rounded-md border bg-card text-card-foreground shadow-sm p-4 flex flex-col overflow-y-auto">
            <h2 class="text-lg font-semibold mb-4">{t('export', {}, 'Export')}</h2>
            <div class="space-y-4 w-full max-w-2xl">
              <div class="text-sm font-medium opacity-85 mb-3">
                {t('export_include', {}, 'Include in export')}
              </div>
              
              <!-- Include Options -->
              <div class="space-y-3">
                <label class="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={exportIncludeLocation}
                    onchange={(event) => {
                      exportIncludeLocation = (event.currentTarget as HTMLInputElement).checked;
                    }}
                    class="w-4 h-4 rounded border border-foreground/30 bg-background text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
                  />
                  <span class="text-sm opacity-85 group-hover:opacity-100 transition-opacity">
                    {t('export_include_location', {}, 'Location')}
                  </span>
                </label>
                
                <label class="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={exportIncludeAspects}
                    onchange={(event) => {
                      exportIncludeAspects = (event.currentTarget as HTMLInputElement).checked;
                    }}
                    class="w-4 h-4 rounded border border-foreground/30 bg-background text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
                  />
                  <span class="text-sm opacity-85 group-hover:opacity-100 transition-opacity">
                    {t('export_include_aspects', {}, 'Aspects')}
                  </span>
                </label>
                
                <label class="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={exportIncludeInfo}
                    onchange={(event) => {
                      exportIncludeInfo = (event.currentTarget as HTMLInputElement).checked;
                    }}
                    class="w-4 h-4 rounded border border-foreground/30 bg-background text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
                  />
                  <span class="text-sm opacity-85 group-hover:opacity-100 transition-opacity">
                    {t('export_include_info', {}, 'Info')}
                  </span>
                </label>
              </div>
              
              <!-- Export Button -->
              <div class="pt-4 border-t mt-6">
                <Button 
                  class="w-full sm:w-auto px-6 py-2"
                  onclick={() => showOpenExportOverlay(true)}
                >
                  {t('export', {}, 'Export')}
                </Button>
              </div>
            </div>
          </div>
        {:else if mode === 'info' || mode === 'dynamic' || mode === 'revolution' || mode === 'favorite'}
          <div class="h-full w-full rounded-md border bg-card text-card-foreground shadow-sm p-4 flex flex-col items-start justify-start">
            <h2 class="text-lg font-semibold mb-3">{t(mode, {}, mode.charAt(0).toUpperCase() + mode.slice(1))}</h2>
            <div class="text-sm opacity-85">{t('mode_view_placeholder', { mode: t(mode, {}, mode) }, 'Content for {mode} view will be displayed here.')}</div>
          </div>
        {:else if mode === 'settings'}
          <div class="h-full min-w-0 rounded-md border bg-card text-card-foreground shadow-sm p-4 flex flex-col overflow-hidden">
            <div class="flex-1 min-h-0 overflow-y-auto">
              {#if selectedSettingsSection === 'jazyk'}
                <h3 class="text-sm font-semibold mb-4">{t('section_jazyk', {}, 'Language')}</h3>
                <div class="space-y-4 max-w-md">
                  <div class="space-y-2">
                    <label class="block text-sm font-medium opacity-90" for="settings-lang">{t('language', {}, 'Language')}</label>
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
                </div>
              {:else if selectedSettingsSection === 'lokace'}
                <h3 class="text-sm font-semibold mb-4">{t('section_lokace', {}, 'Location')}</h3>
                <div class="space-y-4 max-w-md">
                  <div class="space-y-2">
                    <div class="block text-sm font-medium opacity-90">{t('default_location', {}, 'Default location')}</div>
                    <Input
                      type="text"
                      class="w-full h-9 px-3 rounded-md bg-background text-foreground border"
                      placeholder={t('placeholder_default_location', {}, 'Enter default location...')}
                    />
                  </div>
                  <div class="space-y-2">
                    <div class="block text-sm font-medium opacity-90">{t('current_info_latitude', {}, 'Latitude')}</div>
                    <Input
                      type="text"
                      class="w-full h-9 px-3 rounded-md bg-background text-foreground border"
                      placeholder={t('placeholder_latitude', {}, 'Latitude')}
                    />
                  </div>
                  <div class="space-y-2">
                    <div class="block text-sm font-medium opacity-90">{t('current_info_longitude', {}, 'Longitude')}</div>
                    <Input
                      type="text"
                      class="w-full h-9 px-3 rounded-md bg-background text-foreground border"
                      placeholder={t('placeholder_longitude', {}, 'Longitude')}
                    />
                  </div>
                </div>
              {:else if selectedSettingsSection === 'system_domu'}
                <h3 class="text-sm font-semibold mb-4">{t('section_system_domu', {}, 'House system')}</h3>
                <div class="space-y-4 max-w-md">
                  <div class="space-y-2">
                    <div class="block text-sm font-medium opacity-90">{t('house_system', {}, 'House System')}</div>
                    <Select.Root type="single" value="Placidus">
                      <Select.Trigger class="w-full h-9 px-3">Placidus</Select.Trigger>
                      <Select.Content>
                        <Select.Group>
                          <Select.Item value="Placidus" label="Placidus">Placidus</Select.Item>
                          <Select.Item value="Whole Sign" label="Whole Sign">Whole Sign</Select.Item>
                          <Select.Item value="Campanus" label="Campanus">Campanus</Select.Item>
                          <Select.Item value="Koch" label="Koch">Koch</Select.Item>
                          <Select.Item value="Equal" label="Equal">Equal</Select.Item>
                          <Select.Item value="Regiomontanus" label="Regiomontanus">Regiomontanus</Select.Item>
                          <Select.Item value="Vehlow" label="Vehlow">Vehlow</Select.Item>
                          <Select.Item value="Porphyry" label="Porphyry">Porphyry</Select.Item>
                          <Select.Item value="Alcabitius" label="Alcabitius">Alcabitius</Select.Item>
                        </Select.Group>
                      </Select.Content>
                    </Select.Root>
                  </div>
                </div>
              {:else if selectedSettingsSection === 'nastaveni_aspektu'}
                <h3 class="text-sm font-semibold mb-4">{t('section_nastaveni_aspektu', {}, 'Aspect settings')}</h3>
                <div class="space-y-4 max-w-md">
                  <div class="space-y-2">
                    <div class="block text-sm font-medium opacity-90">{t('default_aspects', {}, 'Default aspects')}</div>
                    <div class="space-y-2">
                      {#each [
                        { id: 'conjunction', labelKey: 'aspect_conjunction', defaultOrb: 8 },
                        { id: 'sextile', labelKey: 'aspect_sextile', defaultOrb: 6 },
                        { id: 'square', labelKey: 'aspect_square', defaultOrb: 8 },
                        { id: 'trine', labelKey: 'aspect_trine', defaultOrb: 8 },
                        { id: 'quincunx', labelKey: 'aspect_quincunx', defaultOrb: 3 },
                        { id: 'opposition', labelKey: 'aspect_opposition', defaultOrb: 8 }
                      ] as aspect}
                        <div class="flex items-center justify-between">
                          <label class="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              class="w-4 h-4 rounded border border-foreground/30 bg-background text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2 cursor-pointer"
                              checked={true}
                            />
                            <span class="text-sm">{t(aspect.labelKey, {}, aspect.labelKey)}</span>
                          </label>
                          <Input
                            type="number"
                            class="w-20 h-8 px-2 rounded-md bg-background text-foreground border text-xs"
                            value={aspect.defaultOrb}
                            min="0"
                            max="30"
                            step="0.5"
                          />
                        </div>
                      {/each}
                    </div>
                  </div>
                </div>
              {:else if selectedSettingsSection === 'vzhled'}
                <h3 class="text-sm font-semibold mb-4">{t('section_vzhled', {}, 'Appearance')}</h3>
                <div class="flex flex-wrap items-start gap-6">
                  <div class="space-y-2 w-full sm:w-auto sm:min-w-[240px]">
                    <label class="block text-sm font-medium opacity-90" for="settings-preset">Color preset</label>
                    <div class="min-w-[220px]">
                      <Select.Root type="single" name="appPreset" bind:value={presetValue}>
                        <Select.Trigger class="w-[220px]" id="settings-preset">
                          {presetTriggerContent}
                        </Select.Trigger>
                        <Select.Content>
                          <Select.Group>
                            <Select.Label>Themes</Select.Label>
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
                  <div class="space-y-2 w-full sm:w-auto sm:min-w-[240px]">
                    <label class="block text-sm font-medium opacity-90" for="settings-glyph-set">Glyph image set</label>
                    <div class="min-w-[220px]">
                      <Select.Root type="single" name="glyphSet" bind:value={glyphSetValue}>
                        <Select.Trigger class="w-[220px]" id="settings-glyph-set">
                          {glyphSetTriggerContent}
                        </Select.Trigger>
                        <Select.Content>
                          <Select.Group>
                            <Select.Label>Image sets</Select.Label>
                            {#each glyphSetOptions as setOpt (setOpt.id)}
                              <Select.Item value={setOpt.id} label={setOpt.label}>
                                {setOpt.label}
                              </Select.Item>
                            {/each}
                          </Select.Group>
                        </Select.Content>
                      </Select.Root>
                    </div>
                    <div class="text-xs text-muted-foreground max-w-[260px]">
                      {glyphSetOptions.find((s) => s.id === glyphSetValue)?.description}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      class="mt-2"
                      onclick={() => {
                        hardResetGlyphStorage();
                        settingsChanged = true;
                      }}
                    >
                      Reset glyph cache
                    </Button>
                  </div>
                  <div class="space-y-2 w-full sm:w-auto sm:min-w-[240px]">
                    <div class="block text-sm font-medium opacity-90">Radix chart – element colors</div>
                    <p class="text-xs text-muted-foreground max-w-[260px]">Water, Air, Earth, Fire (zodiac/house ring)</p>
                    <div class="flex flex-wrap gap-3 items-center">
                      {#each [
                        { key: 'element-fire' as ElementColorKey, labelKey: 'element_fire' },
                        { key: 'element-earth' as ElementColorKey, labelKey: 'element_earth' },
                        { key: 'element-air' as ElementColorKey, labelKey: 'element_air' },
                        { key: 'element-water' as ElementColorKey, labelKey: 'element_water' }
                      ] as elem}
                        <div class="flex items-center gap-2">
                          <label class="text-xs opacity-90" for={`element-color-${elem.key}`}>{t(elem.labelKey, {}, elem.labelKey)}</label>
                          <input
                            id={`element-color-${elem.key}`}
                            type="color"
                            value={elementColors[elem.key]}
                            oninput={(e) => {
                              const v = (e.currentTarget as HTMLInputElement).value;
                              elementColors = { ...elementColors, [elem.key]: v };
                              setElementColor(elem.key, v);
                              settingsChanged = true;
                            }}
                            class="w-9 h-9 rounded border border-border cursor-pointer"
                            aria-label={t(elem.labelKey, {}, elem.labelKey)}
                          />
                        </div>
                      {/each}
                    </div>
                  </div>
                  <div class="w-full min-w-0 flex-1 mt-4 sm:mt-0">
                    <GlyphManager embedded={true} />
                  </div>
                </div>
              {:else if selectedSettingsSection === 'manual'}
                <h3 class="text-sm font-semibold mb-4">{t('section_manual', {}, 'Manual')}</h3>
                <div class="space-y-4 max-w-2xl">
                  <div class="prose prose-sm dark:prose-invert max-w-none">
                    <p class="text-sm opacity-85">
                      Dokumentace a nápověda k aplikaci bude zobrazena zde.
                    </p>
                  </div>
                </div>
              {/if}
            </div>
            <!-- Cancel/Confirm buttons at bottom -->
            <div class="pt-4 mt-4 border-t border-border/60 flex-shrink-0 flex gap-2">
              <Button 
                variant="outline"
                class="flex-1"
                onclick={() => {
                  // TODO: Reset settings to original values
                  settingsChanged = false;
                }}
              >
                {t('cancel', {}, 'Cancel')}
              </Button>
              <Button 
                class="flex-1"
                onclick={() => {
                  // TODO: Save settings
                  settingsChanged = false;
                }}
              >
                {t('confirm', {}, 'Confirm')}
              </Button>
            </div>
          </div>
        {:else}
          <MiddleContent />
        {/if}
      </div>
    </section>
  {:else if mode === 'radix_table'}
    <!-- Left 20% (1 panel) + middle stretched to 80% -->
    <section class="row-span-1 grid gap-x-3 gap-y-3 px-3 pb-3 overflow-hidden w-full" style:grid-template-columns="minmax(0,20%) minmax(0,80%)">
      <div class="h-full min-w-0 flex flex-col gap-2 min-h-0 bg-panel rounded-md overflow-hidden">
        <div class="min-h-0" class:flex-1={leftTopExpanded}>
          <ExpandablePanel title={t('table_tools', {}, 'Table Tools')} bind:expanded={leftTopExpanded}>
            {#snippet children()}
              <div class="space-y-2 text-sm">
                <p>{t('table_tools_description', {}, 'Table filters and helpers.')}</p>
                <div class="h-24 rounded border border-dashed bg-muted/40"></div>
              </div>
            {/snippet}
          </ExpandablePanel>
        </div>
      </div>
      <div class="h-full min-w-0">
        <MiddleContent />
      </div>
    </section>
  {:else}
    <!-- radix_view and radix_transits: fixed split 20% / 60% / 20% (or 20% / 80% for Aspects, or 20% / 80% for Transits) -->
    {@const isAspectsView = layout.selectedTab === 'Aspects'}
    {@const isTransitsView = mode === 'radix_transits'}
    <section 
      class="row-span-1 grid gap-x-3 gap-y-3 px-3 pb-3 overflow-hidden w-full" 
      style:grid-template-columns={(isAspectsView || isTransitsView) ? "minmax(0,20%) minmax(0,80%)" : "minmax(0,20%) minmax(0,60%) minmax(0,20%)"}
    >
      <!-- Left column: stack two panels (removed Transits panel) -->
      {#if isTransitsView}
        <!-- Transits mode: only show transits selector -->
        <div class="h-full min-w-0 flex flex-col gap-2 min-h-0 bg-panel rounded-md overflow-hidden">
          <div class="min-h-0" class:flex-1={leftMiddleExpanded}>
            <ExpandablePanel title={t('transits', {}, 'Transits')} bind:expanded={leftMiddleExpanded}>
              {#snippet children()}
                <PanelMenu items={transitsMenuItems} bind:selectedId={selectedTransitsSection} />
              {/snippet}
            </ExpandablePanel>
          </div>
        </div>
      {:else}
        <!-- Normal radix view: show chart details and astrolab -->
        <div class="h-full min-w-0 flex flex-col gap-2 min-h-0 bg-panel rounded-md overflow-hidden">
          <!-- Panel 1: title is current context name -->
          <div class="min-h-0" class:flex-1={leftTopExpanded}>
            <ExpandablePanel 
              title={selectedChart?.name || t('no_chart_selected', {}, 'No chart selected')} 
              bind:expanded={leftTopExpanded}
              editable={true}
              onEdit={() => {
                if (!selectedChart) {
                  return;
                }
                editingChartId = selectedChart.id;
                populateFormFromChart(selectedChart);
                setMode('new_radix');
              }}
            >
              {#snippet children()}
                <!-- Complete compact: name, type+date+time+place, zodiac+house+engine+tz, tags -->
                <div class="space-y-1.5 text-xs">
                  <!-- Row 0: Chart name (when different from header or for completeness) -->
                  {#if selectedChart?.name}
                    <div class="font-medium opacity-95 truncate" title={selectedChart.name}>
                      {selectedChart.name}
                    </div>
                  {/if}
                  <!-- Row 1: Type · Date · Time · Place (always show all) -->
                  <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 opacity-90">
                    <span class="font-semibold">
                      {chartDetails.chartType === 'NATAL' ? t('new_type_radix', {}, 'Radix')
                        : chartDetails.chartType === 'EVENT' ? t('new_type_event', {}, 'Event')
                        : chartDetails.chartType === 'HORARY' ? t('new_type_horary', {}, 'Horary')
                        : t('new_type_composite', {}, 'Composite')}
                    </span>
                    <span class="opacity-60">·</span>
                    <span class="font-mono">{chartDetails.date || '—'}</span>
                    <span class="opacity-60">·</span>
                    <span class="font-mono">{chartDetails.time || '—'}</span>
                    <span class="opacity-60">·</span>
                    <span class="truncate min-w-0" title={chartDetails.location || ''}>
                      {chartDetails.location || (chartDetails.latitude && chartDetails.longitude ? `(${chartDetails.latitude}, ${chartDetails.longitude})` : '—')}
                    </span>
                  </div>
                  <!-- Row 2: Zodiac · House · Engine · Timezone -->
                  <div class="flex flex-wrap items-baseline gap-x-2 opacity-75">
                    <span>{chartDetails.zodiacType || '—'}</span>
                    <span class="opacity-60">·</span>
                    <span>{chartDetails.houseSystem || '—'}</span>
                    {#if chartDetails.engine && chartDetails.engine !== '—'}
                      <span class="opacity-60">·</span>
                      <span>{chartDetails.engine}</span>
                    {/if}
                    {#if chartDetails.timezone}
                      <span class="opacity-60">·</span>
                      <span>{chartDetails.timezone}</span>
                    {/if}
                  </div>
                  <!-- Row 3: Tags as small labels (always show row; pills or "—") -->
                  {#if true}
                    {@const tagList = (chartDetails.tags || '').split(',').map((t: string) => t.trim()).filter(Boolean)}
                    <div class="flex flex-wrap gap-1 pt-0.5">
                      {#if tagList.length > 0}
                        {#each tagList as tag}
                          <span class="inline-flex items-center px-1.5 py-0.5 rounded bg-muted/70 text-[10px] opacity-85">
                            {tag}
                          </span>
                        {/each}
                      {:else}
                        <span class="text-[10px] opacity-50">—</span>
                      {/if}
                    </div>
                  {/if}
                </div>
              {/snippet}
            </ExpandablePanel>
          </div>
          <!-- Panel 2: Astrolab -->
          <div class="min-h-0" class:flex-1={leftMiddleExpanded}>
            <ExpandablePanel title={t('astrolabe', {}, 'Astrolab')} bind:expanded={leftMiddleExpanded}>
              {#snippet children()}
                <TimeNavigationPanel />
              {/snippet}
            </ExpandablePanel>
          </div>
        </div>
      {/if}

      <!-- Middle content -->
      {#if mode === 'radix_transits' && selectedTransitsSection}
        <div class="h-full min-w-0 rounded-md border bg-card text-card-foreground shadow-sm p-4 flex flex-col overflow-hidden">
          <div class="flex-1 min-h-0 overflow-y-auto">
            {#if selectedTransitsSection === 'obecne'}
              <h3 class="text-sm font-semibold mb-4">Obecné nastavení tranzitů</h3>
              <div class="space-y-4 max-w-md">
                <div class="space-y-2">
                  <div class="text-sm font-medium">Z graf</div>
                  <Select.Root type="single" bind:value={transitSourceChartId}>
                    <Select.Trigger class="w-full h-9 px-3">
                      {layout.contexts.find((chart) => chart.id === transitSourceChartId)?.name ?? 'Vyberte graf...'}
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Group>
                        {#if layout.contexts.length === 0}
                          <Select.Item value="" label="Vyberte graf...">Vyberte graf...</Select.Item>
                        {:else}
                          {#each layout.contexts as chart}
                            <Select.Item value={chart.id} label={chart.name}>{chart.name}</Select.Item>
                          {/each}
                        {/if}
                      </Select.Group>
                    </Select.Content>
                  </Select.Root>
                </div>
                <div class="space-y-2">
                  <div class="text-sm font-medium">Do grafu</div>
                  <Select.Root type="single" bind:value={transitSourceChartId}>
                    <Select.Trigger class="w-full h-9 px-3">
                      {layout.contexts.find((chart) => chart.id === transitSourceChartId)?.name ?? 'Vyberte graf...'}
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Group>
                        {#if layout.contexts.length === 0}
                          <Select.Item value="" label="Vyberte graf...">Vyberte graf...</Select.Item>
                        {:else}
                          {#each layout.contexts as chart}
                            <Select.Item value={chart.id} label={chart.name}>{chart.name}</Select.Item>
                          {/each}
                        {/if}
                      </Select.Group>
                    </Select.Content>
                  </Select.Root>
                </div>
                <div class="space-y-2">
                  <div class="text-sm font-medium">{t('time_range', {}, 'Time range')}</div>
                  <div class="grid grid-cols-2 gap-2">
                    <Input
                      type="date"
                      class="h-9 px-3 rounded-md bg-background text-foreground border"
                      value={timeNavigation.startTime.toISOString().slice(0, 10)}
                      onchange={(event) => {
                        const value = (event.currentTarget as HTMLInputElement).value;
                        if (value) {
                          timeNavigation.startTime = new Date(`${value}T00:00:00`);
                          if (timeNavigation.currentTime < timeNavigation.startTime) {
                            timeNavigation.currentTime = new Date(timeNavigation.startTime);
                          }
                        }
                      }}
                    />
                    <Input
                      type="date"
                      class="h-9 px-3 rounded-md bg-background text-foreground border"
                      value={timeNavigation.endTime.toISOString().slice(0, 10)}
                      onchange={(event) => {
                        const value = (event.currentTarget as HTMLInputElement).value;
                        if (value) {
                          timeNavigation.endTime = new Date(`${value}T23:59:59`);
                          if (timeNavigation.currentTime > timeNavigation.endTime) {
                            timeNavigation.currentTime = new Date(timeNavigation.endTime);
                          }
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            {:else if selectedTransitsSection === 'transiting'}
              <h3 class="text-sm font-semibold mb-3">{t('transits_menu_transiting', {}, 'Transiting bodies')}</h3>
              <BodySelector bind:selectedBodies={transitingBodies} />
            {:else if selectedTransitsSection === 'transited'}
              <h3 class="text-sm font-semibold mb-3">{t('transits_menu_transited', {}, 'Transited bodies')}</h3>
              <BodySelector bind:selectedBodies={transitedBodies} />
            {:else if selectedTransitsSection === 'aspects'}
              <h3 class="text-sm font-semibold mb-3">{t('transits_menu_aspects_used', {}, 'Aspects used')}</h3>
              <div class="space-y-2">
                {#each [
                  { id: 'conjunction', labelKey: 'aspect_conjunction' },
                  { id: 'sextile', labelKey: 'aspect_sextile' },
                  { id: 'square', labelKey: 'aspect_square' },
                  { id: 'trine', labelKey: 'aspect_trine' },
                  { id: 'quincunx', labelKey: 'aspect_quincunx' },
                  { id: 'opposition', labelKey: 'aspect_opposition' }
                ] as aspect}
                  <label class="flex items-center gap-2 cursor-pointer group hover:opacity-80 transition-opacity">
                    <input
                      type="checkbox"
                      class="w-4 h-4 rounded border border-foreground/30 bg-background text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2 cursor-pointer"
                      checked={selectedAspects.includes(aspect.id)}
                      onchange={() => {
                        if (selectedAspects.includes(aspect.id)) {
                          selectedAspects = selectedAspects.filter(id => id !== aspect.id);
                        } else {
                          selectedAspects = [...selectedAspects, aspect.id];
                        }
                      }}
                    />
                    <span class="text-sm">{t(aspect.labelKey, {}, aspect.labelKey)}</span>
                  </label>
                {/each}
              </div>
            {/if}
          </div>
          {#if transitLoading}
            <div class="mt-4 text-xs opacity-80">{t('transit_loading', {}, 'Computing transits…')}</div>
          {/if}
          {#if transitError}
            <div class="mt-4 text-xs text-destructive">{transitError}</div>
          {/if}
          {#if transitSeries.length > 0}
            <div class="mt-4 border-t border-border/60 pt-4">
              <div class="text-xs font-medium opacity-80 mb-2">
                {t('transit_results_count', { count: String(transitSeries.length) }, `Results: ${transitSeries.length} entries`)}
              </div>
              <div class="overflow-auto max-h-64 border rounded-md">
                <table class="w-full text-xs border-collapse">
                  <thead class="sticky top-0 bg-background border-b">
                    <tr>
                      <th class="text-left p-2 font-semibold opacity-85">{t('column_time', {}, 'Time')}</th>
                      <th class="text-left p-2 font-semibold opacity-85">{t('column_bodies', {}, 'Bodies')}</th>
                      <th class="text-left p-2 font-semibold opacity-85">{t('aspects', {}, 'Aspects')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each transitSeries.slice(0, 50) as entry}
                      <tr class="border-b hover:bg-accent/50 transition-colors">
                        <td class="p-2">{entry.datetime}</td>
                        <td class="p-2">{Object.keys(entry.transit_positions ?? {}).length}</td>
                        <td class="p-2">{(entry.aspects ?? []).length}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
              {#if transitSeries.length > 50}
                <div class="text-xs opacity-70 mt-2">{t('transit_showing_first_50', {}, 'Showing first 50 entries.')}</div>
              {/if}
            </div>
          {/if}
          <!-- Calculate button at bottom -->
          <div class="pt-4 mt-4 border-t border-border/60 flex-shrink-0">
            <Button 
              class="w-full"
              onclick={async () => {
                if (!layout.workspacePath) {
                  transitError = 'Open a workspace to compute transits, or save your charts to a folder first.';
                  return;
                }
                const chartId = transitSourceChartId || getSelectedChart()?.id;
                if (!chartId) {
                  transitError = 'No chart selected for transit computation.';
                  return;
                }
                transitLoading = true;
                transitError = null;
                transitSeries = [];
                transitMeta = null;

                try {
                  const result = await invoke<TransitSeriesResult>('compute_transit_series', {
                    workspacePath: layout.workspacePath,
                    chartId: chartId,
                    startDatetime: timeNavigation.startTime.toISOString(),
                    endDatetime: timeNavigation.endTime.toISOString(),
                    timeStepSeconds: stepToSeconds(),
                    transitingObjects: transitingBodies,
                    transitedObjects: transitedBodies,
                    aspectTypes: selectedAspects,
                  });

                  transitMeta = result;
                  transitSeries = result.results ?? [];
                } catch (err) {
                  console.error('Failed to compute transits:', err);
                  transitError = err instanceof Error ? err.message : 'Transit computation failed.';
                } finally {
                  transitLoading = false;
                }
              }}
            >
              {t('calculate', {}, 'Calculate')}
            </Button>
          </div>
        </div>
      {:else}
        <div class="h-full min-h-0 min-w-0 overflow-hidden">
          <MiddleContent />
        </div>
      {/if}

      <!-- Right panel (hidden for Aspects view and Transits view) -->
      {#if !isAspectsView && !isTransitsView}
        <div class="h-full min-w-0 flex flex-col gap-2 min-h-0 bg-panel rounded-md overflow-hidden">
          <!-- Poloha: radix view = single column list; other = placeholder -->
          <div class="min-h-0 flex-1 min-w-0">
            <ExpandablePanel title={t('right_panel', {}, 'Poloha')} bind:expanded={rightExpanded}>
              {#snippet children()}
                {#if isRadixLikeMode}
                  <!-- Radix: object glyph, degrees, house sign glyph, minutes -->
                  <ul class="space-y-0.5 text-[11px] max-h-full overflow-auto pr-1">
                    {#each planetRows as [planetName, planetData]}
                      {@const planetGlyph = getGlyphContent(planetName)}
                      {@const signGlyph = getGlyphContent(planetData.signName)}
                      {@const deg = Math.floor(planetData.positionInHouse)}
                      {@const minutes = Math.floor((planetData.positionInHouse % 1) * 60)}
                      <li class="flex items-center gap-1.5 py-0.5 border-b border-border/30 last:border-0">
                        <!-- Object glyph -->
                        {#if planetGlyph.type === 'svg'}
                          <span class="inline-block flex-shrink-0" style="width: 0.9em; height: 0.9em; vertical-align: middle;">{@html planetGlyph.content}</span>
                        {:else if planetGlyph.type === 'file'}
                          {#if failedGlyphFiles[`p:${planetName}:${planetGlyph.content}`]}
                            <span class="flex-shrink-0 w-[0.9em] text-center">{planetGlyph.fallback || planetName.charAt(0).toUpperCase()}</span>
                          {:else}
                            <img src={planetGlyph.content} alt={planetName} class="w-[0.9em] h-[0.9em] flex-shrink-0 object-contain" onerror={() => { failedGlyphFiles[`p:${planetName}:${planetGlyph.content}`] = true; failedGlyphFiles = { ...failedGlyphFiles }; }} />
                          {/if}
                        {:else}
                          <span class="flex-shrink-0 w-[0.9em] text-center">{planetGlyph.content || planetName.charAt(0).toUpperCase()}</span>
                        {/if}
                        <span class="font-mono opacity-90 flex-shrink-0">{deg}°</span>
                        <!-- House sign glyph -->
                        {#if signGlyph.type === 'svg'}
                          <span class="inline-block flex-shrink-0" style="width: 0.9em; height: 0.9em; vertical-align: middle;">{@html signGlyph.content}</span>
                        {:else if signGlyph.type === 'file'}
                          {#if failedGlyphFiles[`s:${planetName}:${planetData.signName}:${signGlyph.content}`]}
                            <span class="flex-shrink-0 w-[0.9em] text-center">{signGlyph.fallback}</span>
                          {:else}
                            <img src={signGlyph.content} alt={planetData.signName} class="w-[0.9em] h-[0.9em] flex-shrink-0 object-contain" onerror={() => { failedGlyphFiles[`s:${planetName}:${planetData.signName}:${signGlyph.content}`] = true; failedGlyphFiles = { ...failedGlyphFiles }; }} />
                          {/if}
                        {:else}
                          <span class="flex-shrink-0 w-[0.9em] text-center">{signGlyph.content || planetData.signName.slice(0, 2)}</span>
                        {/if}
                        <span class="font-mono opacity-90 flex-shrink-0">{minutes}'</span>
                      </li>
                    {/each}
                    {#if planetRows.length === 0}
                      <li class="py-1.5 opacity-60 text-[10px]">No computed positions yet.</li>
                    {/if}
                  </ul>
                {:else}
                  <div class="space-y-2 text-sm">
                    <p class="text-xs">{t('right_panel_description', {}, 'Expandable content (right).')}</p>
                    <div class="h-24 rounded border border-dashed bg-muted/40"></div>
                  </div>
                {/if}
              {/snippet}
            </ExpandablePanel>
          </div>
          <!-- Right bottom: expandable tiny positions summary (like table view, compact) -->
          {#if isRadixLikeMode}
            <div class="flex-shrink-0 min-h-0 min-w-0">
              <ExpandablePanel title={t('positions_summary', {}, 'Positions summary')} bind:expanded={rightBottomExpanded} editable={false}>
                {#snippet children()}
                  {#if planetRows.length > 0}
                    <div class="p-1 overflow-x-auto">
                      <table class="w-full text-[10px] border-collapse min-w-max">
                        <thead>
                          <tr class="border-b border-border/30">
                            {#each planetRows.slice(0, 10) as [planetName]}
                              <th class="px-1 py-0.5 text-left font-normal opacity-85 capitalize truncate max-w-[3rem]">{planetName.replaceAll('_', ' ')}</th>
                            {/each}
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            {#each planetRows.slice(0, 10) as [planetName, planetData]}
                              {@const deg = Math.floor(planetData.positionInHouse)}
                              {@const min = Math.floor((planetData.positionInHouse % 1) * 60)}
                              <td class="px-1 py-0.5 font-mono opacity-90">{deg}°{min}'</td>
                            {/each}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  {:else}
                    <p class="text-[10px] opacity-60 px-1 py-1.5">No computed positions yet.</p>
                  {/if}
                {/snippet}
              </ExpandablePanel>
            </div>
          {/if}
        </div>
      {/if}
    </section>
  {/if}

  <!-- Bottom: 10% height -->
  <footer class="row-span-1">
    <BottomTabs />
  </footer>

  {#if layout.overlay.openExport}
    <OpenExportDialog />
  {/if}
</div>
