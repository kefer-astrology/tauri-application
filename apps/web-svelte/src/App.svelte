<script lang="ts">
  import TopBar from '$lib/components/TopBar.svelte';
  import ExpandablePanel from '$lib/components/ExpandablePanel.svelte';
  import MiddleContent from '$lib/components/MiddleContent.svelte';
  import BottomTabs from '$lib/components/BottomTabs.svelte';
  import OpenExportDialog from '$lib/components/OpenExportDialog.svelte';
  import OpenWorkspaceView from '$lib/components/OpenWorkspaceView.svelte';
  import ExportWorkspaceView from '$lib/components/ExportWorkspaceView.svelte';
  import SettingsView from '$lib/components/SettingsView.svelte';
  import TimeNavigationPanel from '$lib/components/TimeNavigationPanel.svelte';
  import InformationView from '$lib/components/InformationView.svelte';
  import RevolutionView from '$lib/components/RevolutionView.svelte';
  import SynastryView from '$lib/components/SynastryView.svelte';
  import SpecGatedModeView from '$lib/components/SpecGatedModeView.svelte';
  import LocationSelector from '$lib/components/LocationSelector.svelte';
  import ModeSwitcher from '$lib/components/ModeSwitcher.svelte';
  import { layout, type Mode, showOpenExportOverlay, getSelectedChart, chartDataToComputePayload, type ChartData, setMode } from '$lib/state/layout';
  import { isTauriRuntime } from '$lib/tauri/runtime';
  import { computeTransitSeries, createChart, resolveLocation, resolveTimezone, searchLocations, updateChart } from '$lib/tauri/workspace';
  import type { ResolvedLocation, TransitSeriesEntry, TransitSeriesResult } from '$lib/tauri/types';
  import { parseDate } from '@internationalized/date';
  import * as Popover from '$lib/components/ui/popover/index.js';
  import { Calendar as CalendarWidget } from '$lib/components/ui/calendar/index.js';
  import CalendarIcon from '@lucide/svelte/icons/calendar';
  import ClockIcon from '@lucide/svelte/icons/clock';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import PencilIcon from '@lucide/svelte/icons/pencil';
  import XIcon from '@lucide/svelte/icons/x';
  import { tagColor, tagDefaultColor, parseTags, mergeTags } from '$lib/astrology/chartTags';
  import {
    supportedTimeSystem,
    utcDateToJulianDay,
    julianDayToUtcIso,
    julianCalendarDateToGregorianWallDate,
    gregorianWallDateToJulianCalendarDate,
    wallTimeToUtcIso,
    parseDateTimeString,
    formatCoordinateMagnitude,
    signedCoordinate,
    TIMEZONES,
    TIMEZONE_REGIONS,
    UTC_OFFSETS,
    timezoneRegion,
    timezoneMatchesRegion,
    type TimeSystem,
    type LatDir,
    type LonDir
  } from '$lib/astrology/timeConversion';
  import { reapplyCurrentPreset } from '$lib/state/theme.svelte';
  import { timeNavigation } from '$lib/stores/timeNavigation.svelte';
  import { t } from '$lib/i18n/index.svelte';
  import * as Select from '$lib/components/ui/select/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import { Checkbox } from '$lib/components/ui/checkbox/index.js';
  import { getGlyphContent, signIdFromLongitude } from '$lib/stores/glyphs.svelte';
  import { DEFAULT_OBSERVABLE_OBJECT_IDS } from '$lib/astrology/observableObjects';
  import BodySelector from '$lib/components/BodySelector.svelte';
  import PanelMenu from '$lib/components/PanelMenu.svelte';
  import OptionListMenu from '$lib/components/OptionListMenu.svelte';
  import * as Dialog from '$lib/components/ui/dialog/index.js';
  import * as Sheet from '$lib/components/ui/sheet/index.js';
  import { onMount } from 'svelte';
  import { stepForward, stepBackward } from '$lib/stores/timeNavigation.svelte';
  import LocateFixed from '@lucide/svelte/icons/locate-fixed';
  import WindowTitlebar from '$lib/components/WindowTitlebar.svelte';

  let rightExpanded = $state(true);
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
  let newTimeSystem = $state<TimeSystem>('gregorian');
  let newDate = $state('');
  let newTime = $state('');
  let newJulianDay = $state('');
  let newJulianCalendarDate = $state('');
  let newTimeRegime = $state<'auto' | 'manual'>('auto');
  let newTimezoneRegion = $state('');
  let newTimezone = $state('');
  let newUtcOffset = $state('auto');
  let newLocationRegime = $state<'auto' | 'manual'>('auto');
  let newLocation = $state('');
  let newLatitude = $state('');
  let newLongitude = $state('');
  let newLatitudeDir = $state<LatDir>('north');
  let newLongitudeDir = $state<LonDir>('east');
  let newHouseSystem = $state(layout.workspaceDefaults.houseSystem);
  let newZodiacType = $state(layout.workspaceDefaults.zodiacType);
  let newTags = $state('');
  let newRodenRating = $state('');
  let newFormError = $state<string | null>(null);
  let editingChartId = $state<string | null>(null);
  let editSheetOpen = $state(false);
  let isResolvingNewLocation = $state(false);
  let newLocationStatus = $state<string | null>(null);
  const timezonesInRegion = $derived(TIMEZONES.filter((tz) => timezoneMatchesRegion(tz, newTimezoneRegion)));
  let newDatePopoverOpen = $state(false);
  const newDateCalendarValue = $derived.by(() => {
    try {
      return newDate ? parseDate(newDate) : undefined;
    } catch {
      return undefined;
    }
  });
  let newTagDraft = $state('');
  let newTagColors = $state<Record<string, string>>({});
  let advancedTagSheetOpen = $state(false);
  let advancedTagDraft = $state('');
  let advancedTagNameDrafts = $state<Record<string, string>>({});
  let newTimePopoverOpen = $state(false);
  const timeSystemOptions = [
    { id: 'gregorian', labelKey: 'new_time_system_gregorian' },
    { id: 'julian_calendar', labelKey: 'new_time_system_julian_calendar' },
    { id: 'julian_day', labelKey: 'new_time_system_julian_day' }
  ] as const;
  const latDirOptions = [
    { id: 'north', labelKey: 'new_dir_north' },
    { id: 'south', labelKey: 'new_dir_south' }
  ] as const;
  const lonDirOptions = [
    { id: 'east', labelKey: 'new_dir_east' },
    { id: 'west', labelKey: 'new_dir_west' }
  ] as const;
  const rodenRatingOptions = [
    { id: 'AA', labelKey: 'new_roden_rating_aa' },
    { id: 'A', labelKey: 'new_roden_rating_a' },
    { id: 'B', labelKey: 'new_roden_rating_b' },
    { id: 'C', labelKey: 'new_roden_rating_c' },
    { id: 'DD', labelKey: 'new_roden_rating_dd' },
    { id: 'X', labelKey: 'new_roden_rating_x' }
  ] as const;
  const newLocationOptions = $derived(
    [
      layout.workspaceDefaults.locationName,
      'Prague, Czech Republic',
      'Brno, Czech Republic',
      'Pardubice, Czech Republic',
      'Bratislava, Slovakia',
      'Vienna, Austria'
    ].filter(Boolean)
  );
  
  // Open Chart mode state
  let openMode = $state<'my_radixes' | 'database'>('my_radixes');

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
      location: defaultLocationName,
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

  let exportType = $state<'print' | 'pdf' | 'png'>('print');
  
  // Info mode state
  let selectedInfoItem = $state<string | undefined>(undefined);
  
  // Transits mode state
  let selectedTransitsSection = $state<string | undefined>('obecne');
  let transitingBodies = $state<string[]>([...layout.workspaceDefaults.defaultBodies]);
  let transitedBodies = $state<string[]>([...layout.workspaceDefaults.defaultBodies]);
  let selectedAspects = $state<string[]>([...layout.workspaceDefaults.defaultAspects]);
  let transitSourceChartId = $state<string>('');
  let transitLoading = $state(false);
  let transitError = $state<string | null>(null);
  let transitSeries = $state<TransitSeriesEntry[]>([]);
  let transitMeta = $state<TransitSeriesResult | null>(null);
  
  // Settings mode state
  let selectedSettingsSection = $state<string | undefined>('jazyk');

  // Revolution mode state (left menu selection)
  let selectedRevolutionSection = $state<string | undefined>(undefined);
  let timeNavigationSeededChartId = $state<string | null>(null);
  
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
    { id: 'pozorovane_objekty', label: t('section_observable_objects', {}, 'Observable objects') },
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

  const dynamicTransitsMenuItems = $derived(
    transitsMenuItems.filter((item) => item.id !== 'transited')
  );

  $effect(() => {
    if (mode === 'dynamic' && selectedTransitsSection === 'transited') {
      selectedTransitsSection = 'obecne';
    }
  });

  const newRadixMenuItems = $derived([
    { id: 'NATAL', label: t('new_type_radix', {}, 'Nativity') },
    { id: 'EVENT', label: t('new_type_event', {}, 'Event') },
    { id: 'HORARY', label: t('new_type_horary', {}, 'Horary') },
  ]);

  const revolutionMenuItems = $derived([
    { id: 'solar', label: t('revolution_solar', {}, 'Solar') },
    { id: 'lunar', label: t('revolution_lunar', {}, 'Lunar') },
  ]);

  // Planet positions for right Radix table
  // Get planets from selected chart's computed data, or use defaults
  const selectedChart = $derived(getSelectedChart());
  const defaultBodyOrder = DEFAULT_OBSERVABLE_OBJECT_IDS;
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

  function getHouseCusps(
    computed: Record<string, unknown>,
    explicitCusps?: number[] | null
  ): number[] {
    if (Array.isArray(explicitCusps) && explicitCusps.length === 12) {
      return explicitCusps
        .map((value) => (typeof value === 'number' ? normalizeLongitude(value) : null))
        .filter((value): value is number => value != null);
    }
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

    const motion = selectedChart?.computed?.motion ?? {};
    const result: Record<string, {
      longitude: number;
      signName: string;
      house: number;
      positionInHouse: number;
      retrograde: boolean;
    }> = {};
    const computedRecord = computed as Record<string, unknown>;
    const cusps = getHouseCusps(computedRecord, selectedChart?.computed?.houseCusps);
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
        retrograde: Boolean(motion[name]?.retrograde),
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

  function splitSignArc(positionInHouse: number) {
    const totalSeconds = Math.round(positionInHouse * 3600);
    const degrees = Math.floor(totalSeconds / 3600) % 30;
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return { degrees, minutes, seconds };
  }

  function formatSignArc(positionInHouse: number) {
    const { degrees, minutes, seconds } = splitSignArc(positionInHouse);
    return `${degrees}°${minutes}'${seconds}"`;
  }
  
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

  const chartDateLabel = $derived.by(() => {
    const parsed = selectedChart?.dateTime ? parseChartDateTimeValue(selectedChart.dateTime) : null;
    return parsed
      ? parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
      : (chartDetails.date || '—');
  });

  const chartTimeLabel = $derived.by(() => {
    const parsed = selectedChart?.dateTime ? parseChartDateTimeValue(selectedChart.dateTime) : null;
    return parsed
      ? parsed.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : (chartDetails.time || '—');
  });

  const chartLocationLabel = $derived.by(() => chartDetails.location || layout.workspaceDefaults.locationName || '—');
  const chartCoordsLabel = $derived.by(() => {
    const lat = chartDetails.latitude;
    const lon = chartDetails.longitude;
    if (lat && lon) return `${lat}, ${lon}`;
    return '—';
  });
  const chartMetaLabel = $derived.by(() =>
    [chartDetails.zodiacType, chartDetails.houseSystem, chartDetails.engine !== '—' ? chartDetails.engine : '']
      .filter(Boolean)
      .join(' / ')
  );
  const chartTagsList = $derived.by(() =>
    (chartDetails.tags || '').split(',').map((tag: string) => tag.trim()).filter(Boolean)
  );

  function formatDateInput(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function formatTimeInput(date: Date): string {
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${min}`;
  }

  /** Wall-clock Date built from the plain <input type="date">/<input type="time"> fields. */
  function wallDateFromInputs(dateStr: string, timeStr: string): Date | null {
    const d = dateStr.trim();
    if (!d) return null;
    const [y, mo, da] = d.split('-').map(Number);
    const [h, mi] = (timeStr.trim() || '00:00').split(':').map(Number);
    if (![y, mo, da, h, mi].every((n) => Number.isFinite(n))) return null;
    return new Date(y, mo - 1, da, h, mi, 0);
  }

  /** Keep date/Julian-day/Julian-calendar fields in sync when the time system changes. */
  function handleTimeSystemChange(next: TimeSystem) {
    try {
      const currentTimezone = newTimeRegime === 'manual' ? nonEmptyOr(newTimezone, layout.workspaceDefaults.timezone) : layout.workspaceDefaults.timezone;
      const currentUtcOffset = newTimeRegime === 'manual' && newUtcOffset !== 'auto' ? newUtcOffset : undefined;

      if (next === 'julian_day') {
        let instant: Date;
        if (newTimeSystem === 'julian_day') {
          instant = new Date(julianDayToUtcIso(newJulianDay));
        } else {
          const wallDate =
            newTimeSystem === 'julian_calendar'
              ? julianCalendarDateToGregorianWallDate(newJulianCalendarDate, wallDateFromInputs(newDate, newTime) ?? new Date())
              : (wallDateFromInputs(newDate, newTime) ?? new Date());
          instant = new Date(wallTimeToUtcIso(wallDate, currentTimezone, currentUtcOffset));
        }
        newJulianDay = utcDateToJulianDay(instant).toFixed(8);
      } else if (newTimeSystem === 'julian_day') {
        const wallDate = parseDateTimeString(julianDayToUtcIso(newJulianDay), currentTimezone, currentUtcOffset);
        newDate = formatDateInput(wallDate);
        newTime = formatTimeInput(wallDate);
        if (next === 'julian_calendar') {
          newJulianCalendarDate = gregorianWallDateToJulianCalendarDate(wallDate);
        }
      } else if (next === 'julian_calendar') {
        newJulianCalendarDate = gregorianWallDateToJulianCalendarDate(wallDateFromInputs(newDate, newTime) ?? new Date());
      } else if (newTimeSystem === 'julian_calendar') {
        const wallDate = julianCalendarDateToGregorianWallDate(newJulianCalendarDate, wallDateFromInputs(newDate, newTime) ?? new Date());
        newDate = formatDateInput(wallDate);
        newTime = formatTimeInput(wallDate);
      }
      newTimeSystem = next;
      newFormError = null;
    } catch (err) {
      newFormError = err instanceof Error ? err.message : String(err);
    }
  }

  function parseChartDateTimeValue(value: string): Date | null {
    const trimmed = value?.trim();
    if (!trimmed) return null;

    const direct = new Date(trimmed);
    if (!isNaN(direct.getTime())) return direct;

    const normalized = trimmed.includes('T')
      ? trimmed
      : /^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}(?::\d{2})?)$/.test(trimmed)
        ? trimmed.replace(' ', 'T') + 'Z'
        : trimmed;
    const normalizedDate = new Date(normalized);
    if (!isNaN(normalizedDate.getTime())) return normalizedDate;

    const legacy = trimmed.match(
      /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/
    );
    if (!legacy) return null;

    const [, dd, mm, yyyy, hh = '00', min = '00', ss = '00'] = legacy;
    return new Date(
      Number(yyyy),
      Number(mm) - 1,
      Number(dd),
      Number(hh),
      Number(min),
      Number(ss)
    );
  }

  function populateFormFromChart(chart: ChartData) {
    const wsDefaults = layout.workspaceDefaults;
    newContextName = chart.name;
    newChartType = chart.chartType ?? 'NATAL';
    newTags = chart.tags.join(', ');
    newTagColors = chart.tagColors ?? {};
    newRodenRating = chart.rodenRating ?? '';

    newTimeRegime = chart.timeRegime ?? (chart.timezone ? 'manual' : 'auto');
    newTimezone = chart.timezone || wsDefaults.timezone;
    newTimezoneRegion = timezoneRegion(newTimezone);
    newUtcOffset = chart.utcOffset ?? 'auto';
    newTimeSystem = supportedTimeSystem(chart.timeSystem);

    const wallDate = chart.dateTime
      ? parseDateTimeString(chart.dateTime, newTimezone, chart.utcOffset ?? undefined)
      : new Date();
    newDate = formatDateInput(wallDate);
    newTime = formatTimeInput(wallDate);
    newJulianDay = utcDateToJulianDay(chart.dateTime ? new Date(chart.dateTime) : new Date()).toFixed(8);
    newJulianCalendarDate = gregorianWallDateToJulianCalendarDate(wallDate);

    newLocation = chart.location || '';
    newLocationRegime = chart.locationRegime ?? (chart.latitude != null ? 'manual' : 'auto');
    newLatitude = formatCoordinateMagnitude(chart.latitude ?? wsDefaults.locationLatitude);
    newLongitude = formatCoordinateMagnitude(chart.longitude ?? wsDefaults.locationLongitude);
    newLatitudeDir = (chart.latitude ?? wsDefaults.locationLatitude) >= 0 ? 'north' : 'south';
    newLongitudeDir = (chart.longitude ?? wsDefaults.locationLongitude) >= 0 ? 'east' : 'west';

    newHouseSystem = chart.houseSystem || 'Placidus';
    newZodiacType = chart.zodiacType || 'Tropical';
    newLocationStatus = null;
    newFormError = null;
  }

  function applyFormReset() {
    const wsDefaults = layout.workspaceDefaults;
    const now = new Date();
    newContextName = '';
    newChartType = 'NATAL';
    newTags = '';
    newTagColors = {};
    newRodenRating = '';

    newTimeSystem = 'gregorian';
    newDate = formatDateInput(now);
    newTime = formatTimeInput(now);
    newJulianDay = utcDateToJulianDay(now).toFixed(8);
    newJulianCalendarDate = gregorianWallDateToJulianCalendarDate(now);
    newTimeRegime = 'auto';
    newTimezone = wsDefaults.timezone;
    newTimezoneRegion = timezoneRegion(wsDefaults.timezone);
    newUtcOffset = 'auto';

    newLocation = '';
    newLocationRegime = 'auto';
    newLatitude = formatCoordinateMagnitude(wsDefaults.locationLatitude);
    newLongitude = formatCoordinateMagnitude(wsDefaults.locationLongitude);
    newLatitudeDir = wsDefaults.locationLatitude >= 0 ? 'north' : 'south';
    newLongitudeDir = wsDefaults.locationLongitude >= 0 ? 'east' : 'west';

    newHouseSystem = wsDefaults.houseSystem || 'Placidus';
    newZodiacType = wsDefaults.zodiacType || 'Tropical';
    newLocationStatus = null;
    newFormError = null;
    editingChartId = null;
  }
  
  // Initialize time navigation when chart is selected
  $effect(() => {
    const chart = selectedChart;
    if (!chart?.id || !chart.dateTime) {
      timeNavigationSeededChartId = null;
      return;
    }

    const hasComputedPositions = Boolean(
      chart.computed?.positions && Object.keys(chart.computed.positions).length > 0
    );
    const shouldSeedNavigation =
      timeNavigationSeededChartId !== chart.id || !hasComputedPositions;

    if (shouldSeedNavigation) {
      try {
        // Accept the same canonical chart timestamp contract as React/Rust.
        const chartDate = parseChartDateTimeValue(chart.dateTime);
        if (chartDate && !isNaN(chartDate.getTime())) {
          const chartTimeMs = chartDate.getTime();
          const currentTimeMs = timeNavigation.currentTime?.getTime?.() ?? NaN;
          if (currentTimeMs !== chartTimeMs) {
            timeNavigation.currentTime = chartDate;
          }
          // Set time range around the chart time (default: 1 day before/after)
          const oneDay = 24 * 60 * 60 * 1000;
          const nextStart = chartTimeMs - oneDay;
          const nextEnd = chartTimeMs + oneDay;
          if ((timeNavigation.startTime?.getTime?.() ?? NaN) !== nextStart) {
            timeNavigation.startTime = new Date(nextStart);
          }
          if ((timeNavigation.endTime?.getTime?.() ?? NaN) !== nextEnd) {
            timeNavigation.endTime = new Date(nextEnd);
          }
          timeNavigationSeededChartId = chart.id;
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

  function currentTagList(): string[] {
    return newTags.split(',').map((tag) => tag.trim()).filter(Boolean);
  }

  function applyTags(nextTags: string[]) {
    const uniqueTags = mergeTags([], nextTags);
    newTags = uniqueTags.join(', ');
    const nextColors: Record<string, string> = {};
    uniqueTags.forEach((tag, index) => {
      nextColors[tag] = newTagColors[tag] ?? tagDefaultColor(index);
    });
    newTagColors = nextColors;
  }

  function addTagsFromRawInput(raw: string) {
    const next = parseTags(raw);
    if (next.length > 0) applyTags([...currentTagList(), ...next]);
  }

  function removeTag(tag: string) {
    applyTags(currentTagList().filter((t) => t !== tag));
  }

  function renameTag(tag: string, nextNameRaw: string) {
    const nextName = nextNameRaw.trim();
    if (!nextName || nextName === tag) return;
    const existing = currentTagList();
    const nextTags = existing.reduce<string[]>((acc, current) => {
      const value = current === tag ? nextName : current;
      if (!acc.includes(value)) acc.push(value);
      return acc;
    }, []);
    const nextColors: Record<string, string> = { ...newTagColors };
    if (nextColors[tag] != null) {
      nextColors[nextName] = nextColors[tag];
      delete nextColors[tag];
    }
    newTags = nextTags.join(', ');
    newTagColors = nextColors;
  }

  function setTagColor(tag: string, color: string) {
    newTagColors = { ...newTagColors, [tag]: color };
  }

  function applyResolvedNewLocation(location: ResolvedLocation) {
    newLocation = location.display_name;
    newLatitude = formatCoordinateMagnitude(location.latitude);
    newLongitude = formatCoordinateMagnitude(location.longitude);
    newLatitudeDir = location.latitude >= 0 ? 'north' : 'south';
    newLongitudeDir = location.longitude >= 0 ? 'east' : 'west';
    newLocationStatus = `${t('toast_location_resolved', {}, 'Location resolved')}: ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
  }

  async function resolveNewLocation(): Promise<ResolvedLocation | null> {
    const query = newLocation.trim();
    if (!query) {
      newLocationStatus = t('toast_location_required', {}, 'Enter a location first.');
      return null;
    }
    if (!isTauriRuntime()) {
      newLocationStatus = t('toast_location_resolve_failed', {}, 'Failed to resolve location');
      return null;
    }

    isResolvingNewLocation = true;
    newLocationStatus = null;
    try {
      const resolved = await resolveLocation(query);
      applyResolvedNewLocation(resolved);
      return resolved;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      newLocationStatus = `${t('toast_location_resolve_failed', {}, 'Failed to resolve location')}: ${message}`;
      return null;
    } finally {
      isResolvingNewLocation = false;
    }
  }

  async function submitNewContext(e?: Event) {
    e?.preventDefault?.();
    const name = newContextName.trim();
    if (!name) return;
    newFormError = null;

    const wsDefaults = layout.workspaceDefaults;
    const chartId = editingChartId ?? normalizeChartId(name);

    let resolvedLocation = newLocation.trim();
    let latitudeValue: number | null = null;
    let longitudeValue: number | null = null;
    let resolvedTimezone = newTimeRegime === 'manual' ? nonEmptyOr(newTimezone, wsDefaults.timezone) : wsDefaults.timezone;

    if (newLocationRegime === 'manual') {
      latitudeValue = signedCoordinate(newLatitude, 'north', newLatitudeDir);
      longitudeValue = signedCoordinate(newLongitude, 'east', newLongitudeDir);
    } else if (resolvedLocation && isTauriRuntime()) {
      const resolved = await resolveNewLocation();
      if (!resolved) return;
      resolvedLocation = resolved.display_name;
      latitudeValue = resolved.latitude;
      longitudeValue = resolved.longitude;
    }

    if (
      (latitudeValue != null && Math.abs(latitudeValue) > 90) ||
      (longitudeValue != null && Math.abs(longitudeValue) > 180)
    ) {
      newFormError = t('toast_coordinates_invalid', {}, 'Coordinates are invalid.');
      return;
    }

    if (newTimeRegime === 'auto' && isTauriRuntime() && latitudeValue != null && longitudeValue != null) {
      try {
        resolvedTimezone = await resolveTimezone(latitudeValue, longitudeValue);
      } catch (err) {
        newFormError = err instanceof Error ? err.message : String(err);
        return;
      }
    }

    const utcOffsetArg = newTimeRegime === 'manual' && newUtcOffset !== 'auto' ? newUtcOffset : undefined;

    let dateTime: string;
    try {
      if (newTimeSystem === 'julian_day') {
        dateTime = julianDayToUtcIso(newJulianDay);
      } else {
        const wallDate =
          newTimeSystem === 'julian_calendar'
            ? julianCalendarDateToGregorianWallDate(newJulianCalendarDate, wallDateFromInputs(newDate, newTime) ?? new Date())
            : (wallDateFromInputs(newDate, newTime) ?? new Date());
        dateTime = wallTimeToUtcIso(wallDate, resolvedTimezone, utcOffsetArg);
      }
    } catch (err) {
      newFormError = err instanceof Error ? err.message : String(err);
      return;
    }

    const formChart: ChartData = {
      id: chartId,
      name,
      chartType: newChartType as 'NATAL' | 'EVENT' | 'HORARY' | 'COMPOSITE',
      dateTime,
      location: resolvedLocation || wsDefaults.locationName,
      latitude: latitudeValue ?? undefined,
      longitude: longitudeValue ?? undefined,
      timezone: resolvedTimezone,
      utcOffset: utcOffsetArg,
      locationRegime: newLocationRegime,
      timeRegime: newTimeRegime,
      timeSystem: newTimeSystem,
      rodenRating: newRodenRating || undefined,
      houseSystem: nonEmptyOr(newHouseSystem, wsDefaults.houseSystem),
      zodiacType: nonEmptyOr(newZodiacType, wsDefaults.zodiacType),
      engine: wsDefaults.engine,
      model: null,
      overrideEphemeris: null,
      tags: currentTagList(),
      tagColors: Object.keys(newTagColors).length > 0 ? newTagColors : undefined,
    };

    if (layout.workspacePath && isTauriRuntime()) {
      const payload = chartDataToComputePayload(formChart);
      try {
        if (editingChartId) {
          await updateChart(layout.workspacePath, editingChartId, payload);
        } else {
          await createChart(layout.workspacePath, payload);
        }
      } catch (err) {
        console.error('Failed to persist chart to workspace:', err);
        newFormError = err instanceof Error ? err.message : String(err);
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
        newFormError = `Chart with id ${chartId} already exists`;
        return;
      }
      layout.contexts = [...layout.contexts, formChart];
      layout.selectedContext = chartId;
      layout.selectedTab = 'Radix';
      setMode('radix_view');
    }

    editSheetOpen = false;
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

<!-- Root layout: the Tauri titlebar inherits the same canvas gradient. -->
<div class="h-screen w-screen flex flex-col bg-gradient-to-br from-[var(--panel)] to-[var(--panel-header)] text-foreground select-none box-border overflow-x-hidden">
  <WindowTitlebar />
  <div class="min-h-0 flex-1 grid grid-rows-[15%_75%_10%]">
  <!-- Top: 15% height -->
  <header class="row-span-1">
    <TopBar />
  </header>

  <!-- Middle: 75% height -->
      {#snippet chartFormPanel()}
        <div class="h-full w-full rounded-md border bg-card text-card-foreground shadow-sm p-4 flex flex-col overflow-hidden">
          <h2 class="text-lg font-semibold mb-4 flex-shrink-0">
            {editingChartId ? t('edit_radix_title', {}, 'Edit Radix') : t('new', {}, 'New')}
          </h2>
          <div class="flex-1 min-h-0 overflow-y-auto">
          <form class="space-y-4 w-full" onsubmit={submitNewContext}>
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

              <!-- Chart Type -->
              <div class="space-y-1">
                <label class="block text-sm font-medium opacity-85" for="new-chart-type">
                  {t('new_type', {}, 'Type')}
                </label>
                <Select.Root type="single" bind:value={newChartType}>
                  <Select.Trigger id="new-chart-type" class="w-full h-9 px-3">
                    {newRadixMenuItems.find((item) => item.id === newChartType)?.label ?? t('new_type_radix', {}, 'Nativity')}
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Group>
                      {#each newRadixMenuItems as item}
                        <Select.Item value={item.id} label={item.label}>{item.label}</Select.Item>
                      {/each}
                    </Select.Group>
                  </Select.Content>
                </Select.Root>
              </div>
              
              <!-- Date, Time and Time Regime: one row, matching the React app -->
              <div class="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-4">
                <div class="space-y-1">
                  <label class="block text-sm font-medium opacity-85" for="new-date">
                    {newTimeSystem === 'julian_day'
                      ? t('new_julian_day', {}, 'Julian Day')
                      : newTimeSystem === 'julian_calendar'
                        ? t('new_julian_calendar_date', {}, 'Julian calendar date')
                        : t('new_date', {}, 'Date')}
                  </label>
                  {#if newTimeSystem === 'julian_day'}
                    <Input
                      id="new-date"
                      type="text"
                      inputmode="decimal"
                      class="w-full h-9 px-3 rounded-md bg-background text-foreground border"
                      bind:value={newJulianDay}
                      placeholder="2451545.0"
                    />
                  {:else if newTimeSystem === 'julian_calendar'}
                    <Input
                      id="new-date"
                      type="text"
                      inputmode="numeric"
                      class="w-full h-9 px-3 rounded-md bg-background text-foreground border"
                      bind:value={newJulianCalendarDate}
                      placeholder="YYYY-MM-DD"
                    />
                  {:else}
                    <Popover.Root bind:open={newDatePopoverOpen}>
                      <div class="relative">
                        <Input
                          id="new-date"
                          type="text"
                          readonly
                          value={newDate}
                          class="w-full h-9 pl-3 pr-9 rounded-md bg-background text-foreground border cursor-pointer"
                          onclick={() => (newDatePopoverOpen = true)}
                        />
                        <Popover.Trigger
                          class="absolute inset-y-0 right-0 flex items-center px-2.5 text-muted-foreground hover:text-foreground"
                          aria-label={t('new_date', {}, 'Date')}
                        >
                          <CalendarIcon class="h-4 w-4" />
                        </Popover.Trigger>
                      </div>
                      <Popover.Content class="w-auto p-0" align="start">
                        <CalendarWidget
                          type="single"
                          value={newDateCalendarValue}
                          onValueChange={(value) => {
                            if (value) {
                              newDate = value.toString();
                            }
                            newDatePopoverOpen = false;
                          }}
                        />
                      </Popover.Content>
                    </Popover.Root>
                  {/if}
                </div>
                <div class="space-y-1" class:hidden={newTimeSystem === 'julian_day'}>
                  <label class="block text-sm font-medium opacity-85" for="new-time">
                    {t('new_time', {}, 'Time')}
                  </label>
                  <Popover.Root bind:open={newTimePopoverOpen}>
                    <div class="relative">
                      <Input
                        id="new-time"
                        type="text"
                        inputmode="numeric"
                        placeholder="HH:MM"
                        class="w-full h-9 pl-3 pr-9 rounded-md bg-background text-foreground border"
                        bind:value={newTime}
                        onkeydown={(e) => {
                          if (e.key === 'Enter') newTimePopoverOpen = false;
                        }}
                      />
                      <Popover.Trigger
                        class="absolute inset-y-0 right-0 flex items-center px-2.5 text-muted-foreground hover:text-foreground"
                        aria-label={t('new_time', {}, 'Time')}
                      >
                        <ClockIcon class="h-4 w-4" />
                      </Popover.Trigger>
                    </div>
                    <Popover.Content class="w-[220px] p-3" align="end">
                      {@const [hourStr, minuteStr] = (newTime || '00:00').split(':')}
                      {@const selectedHour = Number(hourStr) || 0}
                      {@const selectedMinute = Number(minuteStr) || 0}
                      <div class="grid grid-cols-2 gap-3">
                        <div class="space-y-2">
                          <div class="text-center text-xs font-medium uppercase tracking-wide opacity-60">
                            {t('new_time_hour', {}, 'Hour')}
                          </div>
                          <div class="h-48 overflow-y-auto rounded-md border p-1 space-y-1">
                            {#each Array.from({ length: 24 }, (_, i) => i) as h}
                              <Button
                                type="button"
                                variant={h === selectedHour ? 'default' : 'ghost'}
                                class="h-8 w-full justify-center font-mono"
                                onclick={() => {
                                  newTime = `${String(h).padStart(2, '0')}:${String(selectedMinute).padStart(2, '0')}`;
                                }}
                              >
                                {String(h).padStart(2, '0')}
                              </Button>
                            {/each}
                          </div>
                        </div>
                        <div class="space-y-2">
                          <div class="text-center text-xs font-medium uppercase tracking-wide opacity-60">
                            {t('new_time_minute', {}, 'Minute')}
                          </div>
                          <div class="h-48 overflow-y-auto rounded-md border p-1 space-y-1">
                            {#each Array.from({ length: 60 }, (_, i) => i) as m}
                              <Button
                                type="button"
                                variant={m === selectedMinute ? 'default' : 'ghost'}
                                class="h-8 w-full justify-center font-mono"
                                onclick={() => {
                                  newTime = `${String(selectedHour).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                                }}
                              >
                                {String(m).padStart(2, '0')}
                              </Button>
                            {/each}
                          </div>
                        </div>
                      </div>
                      <div class="flex justify-end pt-2">
                        <Button type="button" size="sm" onclick={() => (newTimePopoverOpen = false)}>
                          {t('done', {}, 'Done')}
                        </Button>
                      </div>
                    </Popover.Content>
                  </Popover.Root>
                </div>
                <div class="space-y-1">
                  <div class="block text-sm font-medium opacity-85">
                    {t('new_time_regime', {}, 'Time regime')}
                  </div>
                  <ModeSwitcher
                    bind:value={newTimeRegime}
                    class="min-w-[11rem]"
                    options={[
                      { value: 'auto', label: t('new_time_regime_auto', {}, 'Auto') },
                      { value: 'manual', label: t('new_time_regime_manual', {}, 'Manual') }
                    ]}
                    ariaLabel={t('new_time_regime', {}, 'Time regime')}
                  />
                </div>
              </div>

              {#if newTimeRegime === 'manual'}
                <div class="space-y-3 rounded-xl bg-muted/40 p-4">
                  <div class="space-y-1">
                    <div class="text-xs font-medium opacity-75">{t('new_timezone_region', {}, 'Timezone region')}</div>
                    <Select.Root
                      type="single"
                      value={newTimezoneRegion}
                      onValueChange={(region) => {
                        if (!region) return;
                        newTimezoneRegion = region;
                        if (!timezoneMatchesRegion(newTimezone, region)) {
                          newTimezone = TIMEZONES.find((tz) => timezoneMatchesRegion(tz, region)) ?? newTimezone;
                        }
                      }}
                    >
                      <Select.Trigger class="w-full h-9 px-3 text-xs">
                        {newTimezoneRegion || t('new_timezone_region', {}, 'Timezone region')}
                      </Select.Trigger>
                      <Select.Content>
                        <Select.Group>
                          {#each TIMEZONE_REGIONS as region}
                            <Select.Item value={region} label={region}>{region}</Select.Item>
                          {/each}
                        </Select.Group>
                      </Select.Content>
                    </Select.Root>
                  </div>
                  <div class="space-y-1">
                    <div class="text-xs font-medium opacity-75">{t('new_timezone', {}, 'Timezone')}</div>
                    <Select.Root type="single" bind:value={newTimezone}>
                      <Select.Trigger class="w-full h-9 px-3 text-xs">
                        {newTimezone || t('new_timezone_placeholder', {}, 'Select a timezone')}
                      </Select.Trigger>
                      <Select.Content>
                        <Select.Group>
                          {#each timezonesInRegion as tz}
                            <Select.Item value={tz} label={tz}>{tz}</Select.Item>
                          {/each}
                        </Select.Group>
                      </Select.Content>
                    </Select.Root>
                  </div>
                  <div class="space-y-1">
                    <div class="text-xs font-medium opacity-75">{t('new_utc_offset', {}, 'UTC offset')}</div>
                    <Select.Root type="single" bind:value={newUtcOffset}>
                      <Select.Trigger class="w-full h-9 px-3 text-xs">
                        {newUtcOffset === 'auto' ? t('new_time_regime_auto', {}, 'Auto') : newUtcOffset}
                      </Select.Trigger>
                      <Select.Content>
                        <Select.Group>
                          <Select.Item value="auto" label={t('new_time_regime_auto', {}, 'Auto')}>
                            {t('new_time_regime_auto', {}, 'Auto')}
                          </Select.Item>
                          {#each UTC_OFFSETS as offset}
                            <Select.Item value={offset} label={offset}>{offset}</Select.Item>
                          {/each}
                        </Select.Group>
                      </Select.Content>
                    </Select.Root>
                  </div>
                  <div class="space-y-1">
                    <div class="text-xs font-medium opacity-75">{t('new_time_system', {}, 'Time system')}</div>
                    <Select.Root
                      type="single"
                      value={newTimeSystem}
                      onValueChange={(value) => handleTimeSystemChange(value as TimeSystem)}
                    >
                      <Select.Trigger class="w-full h-9 px-3 text-xs">
                        {newTimeSystem === 'julian_day'
                          ? t('new_time_system_julian_day', {}, 'Julian Day')
                          : newTimeSystem === 'julian_calendar'
                            ? t('new_time_system_julian_calendar', {}, 'Julian calendar')
                            : t('new_time_system_gregorian', {}, 'Gregorian')}
                      </Select.Trigger>
                      <Select.Content>
                        <Select.Group>
                          {#each timeSystemOptions as opt}
                            <Select.Item value={opt.id} label={t(opt.labelKey, {}, opt.id)}>
                              {t(opt.labelKey, {}, opt.id)}
                            </Select.Item>
                          {/each}
                        </Select.Group>
                      </Select.Content>
                    </Select.Root>
                  </div>
                </div>
              {/if}

              <!-- Location: field + regime switcher in one row, matching the React app -->
              <div class="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-4">
                {#if newLocationRegime === 'auto'}
                  <div class="space-y-1">
                    <label class="block text-sm font-medium opacity-85" for="new-location">
                      {t('new_location', {}, 'Location')}
                    </label>
                    <LocationSelector
                      id="new-location"
                      bind:value={newLocation}
                      onValueChange={() => {
                        newLocationStatus = null;
                      }}
                      options={newLocationOptions}
                      placeholder={t('new_placeholder_any_location', {}, 'Any searchable location…')}
                      searchPlaceholder={t('new_location_search', {}, 'Search')}
                      emptyLabel={t('new_placeholder_any_location', {}, 'Any searchable location…')}
                      loadingLabel={t('new_resolving_location', {}, 'Resolving…')}
                      searchLocations={isTauriRuntime() ? searchLocations : undefined}
                      onResolvedLocationSelect={(location) => {
                        applyResolvedNewLocation(location);
                      }}
                      class="bg-background"
                    />
                  </div>
                {:else}
                  <div class="space-y-1">
                    <label class="block text-sm font-medium opacity-85" for="new-location">
                      {t('new_location', {}, 'Location')}
                    </label>
                    <Input
                      id="new-location"
                      type="text"
                      class="w-full h-9 px-3 rounded-md bg-background text-foreground border"
                      bind:value={newLocation}
                      placeholder={t('new_placeholder_any_location', {}, 'Any searchable location…')}
                    />
                  </div>
                {/if}
                <div class="space-y-1">
                  <div class="block text-sm font-medium opacity-85">
                    {t('new_location_regime', {}, 'Location regime')}
                  </div>
                  <ModeSwitcher
                    bind:value={newLocationRegime}
                    class="min-w-[11rem]"
                    options={[
                      { value: 'auto', label: t('new_time_regime_auto', {}, 'Auto') },
                      { value: 'manual', label: t('new_time_regime_manual', {}, 'Manual') }
                    ]}
                    ariaLabel={t('new_location_regime', {}, 'Location regime')}
                  />
                </div>
              </div>

              {#if newLocationRegime === 'auto'}
                <div class="flex justify-end -mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    class="h-9 px-3 text-sm"
                    onclick={() => void resolveNewLocation()}
                    disabled={isResolvingNewLocation || !newLocation.trim() || !isTauriRuntime()}
                    title={t('new_resolve_location', {}, 'Resolve location')}
                  >
                    <LocateFixed class="h-4 w-4" />
                    {isResolvingNewLocation ? t('new_resolving_location', {}, 'Resolving…') : t('new_resolve_location', {}, 'Resolve location')}
                  </Button>
                </div>
                {#if newLocationStatus}
                  <div class="text-xs opacity-75 -mt-2">{newLocationStatus}</div>
                {/if}
              {:else}
                <div class="grid grid-cols-1 gap-2">
                  <div class="space-y-1">
                    <div class="text-xs font-medium opacity-75">{t('current_info_latitude', {}, 'Latitude')}</div>
                    <div class="flex gap-1.5">
                      <Input
                        type="text"
                        class="flex-1 h-9 px-2 rounded-md bg-background text-foreground border text-xs"
                        placeholder="50.0755"
                        bind:value={newLatitude}
                      />
                      <Select.Root type="single" bind:value={newLatitudeDir}>
                        <Select.Trigger class="w-16 h-9 px-2 text-xs shrink-0">
                          {newLatitudeDir === 'north' ? t('new_dir_north', {}, 'N') : t('new_dir_south', {}, 'S')}
                        </Select.Trigger>
                        <Select.Content>
                          <Select.Group>
                            {#each latDirOptions as dir}
                              <Select.Item value={dir.id} label={t(dir.labelKey, {}, dir.id)}>
                                {t(dir.labelKey, {}, dir.id)}
                              </Select.Item>
                            {/each}
                          </Select.Group>
                        </Select.Content>
                      </Select.Root>
                    </div>
                  </div>
                  <div class="space-y-1">
                    <div class="text-xs font-medium opacity-75">{t('current_info_longitude', {}, 'Longitude')}</div>
                    <div class="flex gap-1.5">
                      <Input
                        type="text"
                        class="flex-1 h-9 px-2 rounded-md bg-background text-foreground border text-xs"
                        placeholder="14.4378"
                        bind:value={newLongitude}
                      />
                      <Select.Root type="single" bind:value={newLongitudeDir}>
                        <Select.Trigger class="w-16 h-9 px-2 text-xs shrink-0">
                          {newLongitudeDir === 'east' ? t('new_dir_east', {}, 'E') : t('new_dir_west', {}, 'W')}
                        </Select.Trigger>
                        <Select.Content>
                          <Select.Group>
                            {#each lonDirOptions as dir}
                              <Select.Item value={dir.id} label={t(dir.labelKey, {}, dir.id)}>
                                {t(dir.labelKey, {}, dir.id)}
                              </Select.Item>
                            {/each}
                          </Select.Group>
                        </Select.Content>
                      </Select.Root>
                    </div>
                  </div>
                </div>
              {/if}

              <!-- Tags -->
              <div class="space-y-1">
                <label class="block text-sm font-medium opacity-85" for="new-tag-draft">
                  {t('new_tags', {}, 'Tags')}
                </label>
                <div class="flex items-stretch w-full rounded-md border-input bg-background dark:bg-input/30 text-foreground border overflow-hidden">
                  <div class="flex flex-wrap items-center gap-1.5 flex-1 min-w-0 px-2 py-1.5">
                    {#each currentTagList() as tag, index (tag)}
                      <span class="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 pl-2 pr-1 py-0.5 text-xs">
                        <span
                          class="h-1.5 w-1.5 rounded-full flex-shrink-0"
                          style={`background-color: ${tagColor(newTagColors, tag, index)}`}
                        ></span>
                        {tag}
                        <button
                          type="button"
                          class="rounded-full hover:opacity-70"
                          aria-label={`${t('new_tags', {}, 'Tags')} ${tag}`}
                          onclick={() => removeTag(tag)}
                        >
                          <XIcon class="h-3 w-3" />
                        </button>
                      </span>
                    {/each}
                    <input
                      id="new-tag-draft"
                      type="text"
                      class="flex-1 min-w-[6rem] bg-transparent text-sm outline-none py-0.5"
                      bind:value={newTagDraft}
                      placeholder={newTags ? '' : t('new_tags_comma_hint', {}, 'Type a tag and press Enter or comma')}
                      onkeydown={(e) => {
                        if (e.key === 'Enter' || e.key === ',') {
                          e.preventDefault();
                          addTagsFromRawInput(newTagDraft);
                          newTagDraft = '';
                        } else if (e.key === 'Backspace' && !newTagDraft && newTags) {
                          const existing = currentTagList();
                          applyTags(existing.slice(0, -1));
                        }
                      }}
                      onblur={() => {
                        if (newTagDraft.trim()) {
                          addTagsFromRawInput(newTagDraft);
                          newTagDraft = '';
                        }
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    class="flex-shrink-0 flex items-center justify-center w-10 border-l border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    aria-label={t('new_tags', {}, 'Tags')}
                    onclick={() => {
                      advancedTagNameDrafts = Object.fromEntries(currentTagList().map((tag) => [tag, tag]));
                      advancedTagSheetOpen = true;
                    }}
                  >
                    <PencilIcon class="h-4 w-4" />
                  </button>
                </div>
              </div>

              <!-- Roden Rating -->
              <div class="space-y-1">
                <label class="block text-sm font-medium opacity-85" for="new-roden-rating">
                  {t('new_roden_rating', {}, 'Roden rating')}
                </label>
                <Select.Root type="single" bind:value={newRodenRating}>
                  <Select.Trigger id="new-roden-rating" class="w-full h-9 px-3">
                    {newRodenRating || t('new_roden_rating_placeholder', {}, 'Select a rating')}
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Group>
                      {#each rodenRatingOptions as opt}
                        <Select.Item value={opt.id} label={opt.id}>{opt.id} – {t(opt.labelKey, {}, opt.id)}</Select.Item>
                      {/each}
                    </Select.Group>
                  </Select.Content>
                </Select.Root>
              </div>

              {#if newFormError}
                <div class="text-xs text-destructive">{newFormError}</div>
              {/if}

              <!-- Submit buttons -->
              <div class="flex gap-2 pt-2">
                {#if editingChartId}
                  <Button
                    type="button"
                    variant="ghost"
                    class="px-4 py-2 rounded-md hover:bg-white/10"
                    onclick={() => {
                      editSheetOpen = false;
                      applyFormReset();
                    }}
                  >
                    {t('new_back', {}, 'Cancel')}
                  </Button>
                {/if}
                <Button
                  type="submit"
                  class={`px-4 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90 ${editingChartId ? '' : 'flex-1'}`}
                >
                  {editingChartId ? t('save', {}, 'Save') : t('add', {}, 'Add')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      {/snippet}

  {#if mode === 'new_radix'}
    <!-- New/Edit Radix: full-width form, no left sidebar (matches the React app's full-page NewHoroscope).
         Side margins scale with the window instead of a fixed max-width, so fields get more room on wide windows. -->
    <section class="row-span-1 overflow-hidden w-full px-3 pb-3 md:px-[8%] lg:px-[12%] xl:px-[15%]">
      {@render chartFormPanel()}
    </section>
  {:else if mode === 'open' || mode === 'info' || mode === 'revolution' || mode === 'synastry' || mode === 'favorite' || mode === 'settings' || mode === 'export'}
    <!-- Left 20% + middle stretched to 80% -->
    <section class="row-span-1 grid gap-x-3 gap-y-3 px-3 pb-3 overflow-hidden w-full" style:grid-template-columns="minmax(0,20%) minmax(0,80%)">
      <!-- Left single panel -->
      <div class="h-full min-w-0 flex flex-col gap-2 min-h-0">
        <div class="min-h-0 flex-1">
          <ExpandablePanel
            title={
              mode === 'settings' ? t('settings', {}, 'Settings')
              : mode === 'open' ? t('open_chart', {}, 'Open Chart')
              : mode === 'info' ? t('info', {}, 'Info')
              : mode === 'revolution' ? t('revolution', {}, 'Revolution')
              : mode === 'synastry' ? t('sidebar_synastry', {}, 'Synastry')
              : t('favorite', {}, 'Favorite')
            }
            editable={false}
          >
            {#snippet children()}
              {#if mode === 'open'}
                {@const openModes = [
                  { value: 'my_radixes', label: t('open_mode_my_radixes', {}, 'My Radixes') },
                  { value: 'database', label: t('open_mode_database', {}, 'Persons Database') }
                ]}
                <OptionListMenu items={openModes} bind:selectedValue={openMode} />
              {:else if mode === 'export'}
                {@const exportTypes = [
                  { value: 'print', label: t('export_type_print', {}, 'Print') },
                  { value: 'pdf', label: t('export_type_pdf', {}, 'Export PDF') },
                  { value: 'png', label: t('export_type_png', {}, 'Export PNG') }
                ]}
                <OptionListMenu items={exportTypes} bind:selectedValue={exportType} />
              {:else if mode === 'info'}
                <PanelMenu items={infoItems} bind:selectedId={selectedInfoItem} />
              {:else if mode === 'settings'}
                <PanelMenu items={settingsMenuItems} bind:selectedId={selectedSettingsSection} />
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
        {#if mode === 'open'}
          <OpenWorkspaceView bind:openMode />
        {:else if mode === 'export'}
          <ExportWorkspaceView bind:exportType />
        {:else if mode === 'info'}
          <InformationView />
        {:else if mode === 'revolution'}
          <RevolutionView />
        {:else if mode === 'synastry'}
          <SynastryView />
        {:else if mode === 'favorite'}
          <SpecGatedModeView {mode} />
        {:else if mode === 'settings'}
          <SettingsView section={selectedSettingsSection} />
        {:else}
          <MiddleContent />
        {/if}
      </div>
    </section>
  {:else if mode === 'radix_table'}
    <!-- Left 20% (1 panel) + middle stretched to 80% -->
    <section class="row-span-1 grid gap-x-3 gap-y-3 px-3 pb-3 overflow-hidden w-full" style:grid-template-columns="minmax(0,20%) minmax(0,80%)">
      <div class="h-full min-w-0 flex flex-col gap-2 min-h-0">
        <div class="min-h-0" class:flex-1={leftTopExpanded}>
          <ExpandablePanel title={t('table_tools', {}, 'Table Tools')} bind:expanded={leftTopExpanded} editable={false}>
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
    {@const isTransitsView = mode === 'radix_transits' || mode === 'dynamic'}
    <section 
      class="row-span-1 grid gap-x-3 gap-y-3 px-3 pb-3 overflow-hidden w-full" 
      style:grid-template-columns={(isAspectsView || isTransitsView) ? "minmax(0,20%) minmax(0,80%)" : "minmax(0,20%) minmax(0,60%) minmax(0,20%)"}
    >
      <!-- Left column: stack two panels (removed Transits panel) -->
      {#if isTransitsView}
        <!-- Transits mode: only show transits selector -->
        <div class="h-full min-w-0 flex flex-col gap-2 min-h-0">
          <div class="min-h-0" class:flex-1={leftMiddleExpanded}>
            <ExpandablePanel title={mode === 'dynamic' ? t('dynamic_transits', {}, 'Dynamic Transits') : t('transits', {}, 'Transits')} bind:expanded={leftMiddleExpanded} editable={false}>
              {#snippet children()}
                <PanelMenu items={mode === 'dynamic' ? dynamicTransitsMenuItems : transitsMenuItems} bind:selectedId={selectedTransitsSection} />
              {/snippet}
            </ExpandablePanel>
          </div>
        </div>
      {:else}
        <!-- Normal radix view: show chart details and astrolab -->
        <div class="h-full min-w-0 flex flex-col gap-2 min-h-0">
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
                editSheetOpen = true;
              }}
            >
              {#snippet children()}
                <div class="space-y-3">
                  <div class="space-y-1">
                    <div class="text-sm font-semibold opacity-95">
                      {chartDetails.chartType === 'NATAL' ? t('new_type_radix', {}, 'Radix')
                        : chartDetails.chartType === 'EVENT' ? t('new_type_event', {}, 'Event')
                        : chartDetails.chartType === 'HORARY' ? t('new_type_horary', {}, 'Horary')
                        : t('new_type_composite', {}, 'Composite')}
                    </div>
                    <div class="text-xs opacity-70">{chartMetaLabel || '—'}</div>
                  </div>
                  <div class="space-y-2">
                    <div class="rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-sm">
                      <div class="truncate">{chartDateLabel}</div>
                    </div>
                    <div class="rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-sm">
                      <div class="truncate">{chartTimeLabel}</div>
                    </div>
                    <div class="rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-sm">
                      <div class="truncate" title={chartLocationLabel}>{chartLocationLabel}</div>
                    </div>
                    <div class="rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-xs opacity-75">
                      <div class="truncate">{chartCoordsLabel}</div>
                    </div>
                  </div>
                  <div class="flex flex-wrap gap-1.5">
                    {#if chartTagsList.length > 0}
                      {#each chartTagsList as tag}
                        <span class="inline-flex items-center rounded-md border border-border/50 px-2 py-1 text-[11px] opacity-85">
                          {tag}
                        </span>
                      {/each}
                    {:else}
                      <span class="text-[11px] opacity-50">—</span>
                    {/if}
                  </div>
                </div>
              {/snippet}
            </ExpandablePanel>
          </div>
          <!-- Panel 2: Astrolab -->
          <div class="min-h-0" class:flex-1={leftMiddleExpanded}>
            <ExpandablePanel title={t('astrolabe', {}, 'Astrolab')} bind:expanded={leftMiddleExpanded} editable={false}>
              {#snippet children()}
                <TimeNavigationPanel
                  dateLabel={chartDateLabel}
                  timeLabel={chartTimeLabel}
                  locationLabel={chartLocationLabel}
                />
              {/snippet}
            </ExpandablePanel>
          </div>
        </div>
      {/if}

      <!-- Middle content -->
      {#if isTransitsView && selectedTransitsSection}
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
                    <Checkbox
                      class="cursor-pointer"
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
                if (!isTauriRuntime()) {
                  transitError = 'Transit computation is only available in the desktop app.';
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
                  const result = await computeTransitSeries({
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
        <div class="h-full min-w-0 flex flex-col gap-2 min-h-0">
          <!-- Poloha: radix view = single column list; other = placeholder -->
          <div class="min-h-0 flex-1 min-w-0">
            <ExpandablePanel title={t('right_panel', {}, 'Poloha')} bind:expanded={rightExpanded} editable={false}>
              {#snippet children()}
                {#if isRadixLikeMode}
                  <!-- Radix: object glyph, degrees, house sign glyph, minutes, seconds -->
                  <ul class="space-y-0.5 text-[11px] max-h-full overflow-auto pr-1">
                    {#each planetRows as [planetName, planetData]}
                      {@const planetGlyph = getGlyphContent(planetName)}
                      {@const signGlyph = getGlyphContent(planetData.signName)}
                      {@const arc = splitSignArc(planetData.positionInHouse)}
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
                        <span class="font-mono opacity-90 flex-shrink-0">{arc.degrees}°</span>
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
                        <span class="font-mono opacity-90 flex-shrink-0">{arc.minutes}'</span>
                        <span class="font-mono opacity-90 flex-shrink-0">{arc.seconds}"</span>
                        <span class="font-mono text-[10px] font-semibold uppercase text-amber-600 w-4 text-center flex-shrink-0">
                          {planetData.retrograde ? 'R' : ''}
                        </span>
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

  <Sheet.Root
    open={editSheetOpen}
    onOpenChange={(open) => {
      editSheetOpen = open;
      if (!open) {
        editingChartId = null;
      }
    }}
  >
    <Sheet.Content side="right" class="flex h-full min-h-0 flex-col gap-0">
      <Sheet.Header>
        <Sheet.Title>{t('edit_radix_title', {}, 'Edit Radix')}</Sheet.Title>
        {#if selectedChart?.name}
          <Sheet.Description>{selectedChart.name}</Sheet.Description>
        {/if}
      </Sheet.Header>
      <div class="min-h-0 flex-1 px-1 pb-4">
        {@render chartFormPanel()}
      </div>
    </Sheet.Content>
  </Sheet.Root>

  <Sheet.Root bind:open={advancedTagSheetOpen}>
    <Sheet.Content side="right" class="flex h-full min-h-0 flex-col gap-0">
      <Sheet.Header>
        <Sheet.Title>{t('new_tags', {}, 'Tags')}</Sheet.Title>
        <Sheet.Description>{t('new_tags_comma_hint', {}, 'Type a tag and press Enter or comma')}</Sheet.Description>
      </Sheet.Header>
      <div class="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
        <div class="space-y-2">
          <label class="block text-sm font-medium opacity-85" for="advanced-tag-input">
            {t('new_tags', {}, 'Tags')}
          </label>
          <div class="flex gap-2">
            <Input
              id="advanced-tag-input"
              type="text"
              class="flex-1 h-9 px-3 rounded-md bg-background text-foreground border"
              bind:value={advancedTagDraft}
              placeholder={t('placeholder_tags_example', {}, 'e.g. personal, important')}
              onkeydown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTagsFromRawInput(advancedTagDraft);
                  advancedTagDraft = '';
                }
              }}
            />
            <Button
              type="button"
              size="icon"
              class="h-9 w-9 flex-shrink-0"
              aria-label={t('new_tags', {}, 'Tags')}
              onclick={() => {
                addTagsFromRawInput(advancedTagDraft);
                advancedTagDraft = '';
              }}
            >
              <PlusIcon class="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div class="space-y-2">
          <div class="text-sm font-medium opacity-85">{t('table_tags', {}, 'Tags')}</div>
          {#if currentTagList().length > 0}
            <div class="space-y-2">
              {#each currentTagList() as tag, index (tag)}
                <div class="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2">
                  <input
                    type="color"
                    class="h-8 w-9 rounded-lg border border-border/60 bg-transparent p-0.5"
                    value={tagColor(newTagColors, tag, index)}
                    onchange={(e) => setTagColor(tag, (e.currentTarget as HTMLInputElement).value)}
                    aria-label={`${t('new_tags', {}, 'Tags')} ${tag}`}
                  />
                  <Input
                    type="text"
                    class="h-8 min-w-0 flex-1 rounded-lg bg-background text-foreground border text-sm"
                    value={advancedTagNameDrafts[tag] ?? tag}
                    oninput={(e) => {
                      advancedTagNameDrafts = { ...advancedTagNameDrafts, [tag]: (e.currentTarget as HTMLInputElement).value };
                    }}
                    onblur={() => renameTag(tag, advancedTagNameDrafts[tag] ?? tag)}
                    onkeydown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        renameTag(tag, advancedTagNameDrafts[tag] ?? tag);
                      } else if (e.key === 'Escape') {
                        advancedTagNameDrafts = { ...advancedTagNameDrafts, [tag]: tag };
                      }
                    }}
                    aria-label={`${t('new_tags', {}, 'Tags')} ${tag}`}
                  />
                  <button
                    type="button"
                    class="flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    onclick={() => removeTag(tag)}
                    aria-label={`${t('button_close', {}, 'Remove')} ${tag}`}
                  >
                    <XIcon class="h-4 w-4" />
                  </button>
                </div>
              {/each}
            </div>
          {:else}
            <div class="rounded-xl border border-dashed border-border/60 px-3 py-4 text-sm opacity-70">
              {t('placeholder_tags_example', {}, 'e.g. personal, important')}
            </div>
          {/if}
        </div>
      </div>
      <Sheet.Footer class="border-t border-border/60">
        <Button
          type="button"
          variant="outline"
          onclick={() => (advancedTagSheetOpen = false)}
        >
          {t('button_close', {}, 'Close')}
        </Button>
      </Sheet.Footer>
    </Sheet.Content>
  </Sheet.Root>
  </div>
</div>
