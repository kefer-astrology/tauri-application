<script lang="ts">
  import * as Select from '$lib/components/ui/select/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import { Checkbox } from '$lib/components/ui/checkbox/index.js';
  import GlyphManager from '$lib/components/GlyphManager.svelte';
  import { t, i18n, setLang } from '$lib/i18n/index.svelte';
  import {
    preset,
    presets,
    applyPreset,
    getElementColors,
    setElementColor,
    type ElementColorKey
  } from '$lib/state/theme.svelte';
  import {
    glyphSettings,
    glyphSetOptions,
    setGlyphSet,
    hardResetGlyphStorage,
    type GlyphSetId
  } from '$lib/stores/glyphs.svelte';
  import {
    appShellIconSetOptions,
    appShellIconSettings,
    setAppShellIconSet,
    type AppShellIconSetId
  } from '$lib/stores/app-shell-icons.svelte';
  import {
    wheelStyleOptions,
    wheelStyleSettings,
    setWheelStyle,
    type WheelStyleId
  } from '$lib/stores/wheel-style.svelte';
  import {
    ASPECT_ROWS,
    ASPECT_SUGGESTED_INCLUDE_ANGLES,
    DEFAULT_ASPECT_COLORS,
    DEFAULT_ASPECT_ORBS,
    type AspectLineStyleId,
    type AspectLineTierStyleState,
    type AspectRow
  } from '$lib/astrology/aspects';
  import * as Accordion from '$lib/components/ui/accordion/index.js';
  import type { AstrologicalTraditionId } from '$lib/tauri/types';
  import BodySelector from '$lib/components/BodySelector.svelte';
  import LocationSelector from '$lib/components/LocationSelector.svelte';
  import {
    layout,
    chartDataToComputePayload,
    updateChartComputationAtTime,
    setWorkspaceDefaults,
    type WorkspaceDefaultsState
  } from '$lib/state/layout';
  import { DEFAULT_OBSERVABLE_OBJECT_IDS } from '$lib/astrology/observableObjects';
  import { isTauriRuntime } from '$lib/tauri/runtime';
  import {
    computeChartFromData,
    computeResultToComputed,
    resolveLocation,
    searchLocations,
    saveWorkspaceDefaults
  } from '$lib/tauri/workspace';
  import type { ResolvedLocation } from '$lib/tauri/types';
  import LocateFixed from '@lucide/svelte/icons/locate-fixed';
  import { catalogHouseSystems } from '$lib/astrology/domainCatalog';

  let {
    section
  }: {
    section?: string | undefined;
  } = $props();

  let settingsChanged = $state(false);
  let elementColors = $state<Record<ElementColorKey, string>>({
    'element-fire': '#5a5a64',
    'element-earth': '#4a3f35',
    'element-air': '#1e3d38',
    'element-water': '#5c2a2a',
  });
  let defaultLocation = $state(layout.workspaceDefaults.locationName);
  let latitude = $state(String(layout.workspaceDefaults.locationLatitude));
  let longitude = $state(String(layout.workspaceDefaults.locationLongitude));
  let timezone = $state(layout.workspaceDefaults.timezone);
  let houseSystem = $state(layout.workspaceDefaults.houseSystem);
  let astrologyTradition = $state<AstrologicalTraditionId | ''>(
    layout.workspaceDefaults.astrologyTradition ?? ''
  );
  let isResolvingLocation = $state(false);
  let locationStatus = $state<string | null>(null);
  const locationOptions = $derived(
    [
      layout.workspaceDefaults.locationName,
      'Prague, Czech Republic',
      'Brno, Czech Republic',
      'Pardubice, Czech Republic',
      'Bratislava, Slovakia',
      'Vienna, Austria'
    ].filter(Boolean)
  );

  const languages = $derived(
    Object.keys(i18n.dicts).map((code) => ({
      value: code,
      label:
        ({ en: 'English', cs: 'Čeština', es: 'Español', fr: 'Français' } as Record<string, string>)[code] ?? code.toUpperCase()
    }))
  );

  const currentLangValue = $derived(String(i18n.lang));
  const langTriggerContent = $derived(
    languages.find((l) => l.value === currentLangValue)?.label ?? t('select_language', {}, 'Select language')
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

  let appShellIconSetValue = $state(String(appShellIconSettings.activeSet));
  const appShellIconSetTriggerContent = $derived(
    appShellIconSetOptions.find((s) => s.id === appShellIconSetValue)?.label ?? 'Select app shell icon set'
  );

  let wheelStyleValue = $state(String(wheelStyleSettings.activeStyle));
  const wheelStyleTriggerContent = $derived(
    wheelStyleOptions.find((s) => s.id === wheelStyleValue)?.label ?? t('select_wheel_style', {}, 'Select wheel style')
  );

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
    if (appShellIconSetValue !== appShellIconSettings.activeSet) {
      appShellIconSetValue = appShellIconSettings.activeSet;
    }
  });

  $effect(() => {
    if (appShellIconSetValue !== appShellIconSettings.activeSet && appShellIconSetOptions.some((s) => s.id === appShellIconSetValue)) {
      setAppShellIconSet(appShellIconSetValue as AppShellIconSetId);
      settingsChanged = true;
    }
  });

  $effect(() => {
    if (wheelStyleValue !== wheelStyleSettings.activeStyle) {
      wheelStyleValue = wheelStyleSettings.activeStyle;
    }
  });

  $effect(() => {
    if (wheelStyleValue !== wheelStyleSettings.activeStyle && wheelStyleOptions.some((s) => s.id === wheelStyleValue)) {
      setWheelStyle(wheelStyleValue as WheelStyleId);
      settingsChanged = true;
    }
  });

  $effect(() => {
    if (section === 'vzhled') {
      elementColors = { ...getElementColors() };
    }
  });

  type AspectRowState = {
    enabled: boolean;
    orb: number;
    color: string;
    /** Whether Ascendant/Midheaven may participate in this aspect. */
    includeAngles: boolean;
    /** Whether extended objects (asteroids, nodes, parts, other calculated points) may participate. */
    includeExtended: boolean;
    /** Tighter orb used instead of `orb` once `includeExtended` is on. */
    extendedOrb: number;
  };

  /** A sensible starting point for the extended-objects orb: half the base orb, floored at 0.5 deg. */
  function suggestedExtendedOrb(baseOrb: number): number {
    return Math.max(0.5, Math.round((baseOrb / 2) * 2) / 2);
  }

  function aspectRowStateFromDefaults(
    aspect: AspectRow,
    workspaceDefaults: WorkspaceDefaultsState
  ): AspectRowState {
    const orb = workspaceDefaults.defaultAspectOrbs[aspect.id] ?? aspect.defaultOrb;
    return {
      enabled: workspaceDefaults.defaultAspects.includes(aspect.id),
      orb,
      color: workspaceDefaults.defaultAspectColors[aspect.id] ?? DEFAULT_ASPECT_COLORS[aspect.id],
      includeAngles:
        workspaceDefaults.aspectIncludeAngles[aspect.id] ?? ASPECT_SUGGESTED_INCLUDE_ANGLES[aspect.id] ?? true,
      includeExtended: workspaceDefaults.aspectIncludeExtended[aspect.id] ?? false,
      extendedOrb: workspaceDefaults.aspectExtendedOrbs[aspect.id] ?? suggestedExtendedOrb(orb)
    };
  }

  let selectedBodies = $state<string[]>(layout.workspaceDefaults.defaultBodies.length > 0
    ? [...layout.workspaceDefaults.defaultBodies]
    : [...DEFAULT_OBSERVABLE_OBJECT_IDS]);
  let aspects = $state<Record<string, AspectRowState>>(
    Object.fromEntries(
      ASPECT_ROWS.map((aspect) => [aspect.id, aspectRowStateFromDefaults(aspect, layout.workspaceDefaults)])
    )
  );
  let aspectLineTiers = $state<AspectLineTierStyleState>({
    ...layout.workspaceDefaults.aspectLineTierStyle
  });
  const aspectTierFields: Array<{
    key: keyof AspectLineTierStyleState;
    labelKey: string;
    min: number;
    step: number;
  }> = [
    { key: 'tightThresholdPct', labelKey: 'settings_aspect_line_tight_pct', min: 0, step: 0.1 },
    { key: 'mediumThresholdPct', labelKey: 'settings_aspect_line_medium_pct', min: 0, step: 0.1 },
    { key: 'looseThresholdPct', labelKey: 'settings_aspect_line_loose_pct', min: 0, step: 0.1 },
    { key: 'widthTight', labelKey: 'settings_aspect_line_width_tight', min: 0.25, step: 0.25 },
    { key: 'widthMedium', labelKey: 'settings_aspect_line_width_medium', min: 0.25, step: 0.25 },
    { key: 'widthLoose', labelKey: 'settings_aspect_line_width_loose', min: 0.25, step: 0.25 },
    { key: 'widthOuter', labelKey: 'settings_aspect_line_width_outer', min: 0.25, step: 0.25 }
  ];
  const ASPECT_LINE_OUTER_STYLE_OPTIONS: { id: AspectLineStyleId; label: string }[] = [
    { id: 'solid', label: 'Solid' },
    { id: 'dashed', label: 'Dashed' },
    { id: 'dotted', label: 'Dotted' }
  ];
  const ASTROLOGY_TRADITION_OPTIONS: { id: AstrologicalTraditionId; labelKey: string }[] = [
    { id: 'hellenistic', labelKey: 'tradition_hellenistic' },
    { id: 'medieval_traditional', labelKey: 'tradition_medieval_traditional' },
    { id: 'modern_western', labelKey: 'tradition_modern_western' },
    { id: 'harmonic', labelKey: 'tradition_harmonic' },
    { id: 'cosmobiology', labelKey: 'tradition_cosmobiology' },
    { id: 'uranian_hamburg', labelKey: 'tradition_uranian_hamburg' },
    { id: 'jyotish_parashari', labelKey: 'tradition_jyotish_parashari' }
  ];

  $effect(() => {
    defaultLocation = layout.workspaceDefaults.locationName;
    latitude = String(layout.workspaceDefaults.locationLatitude);
    longitude = String(layout.workspaceDefaults.locationLongitude);
    timezone = layout.workspaceDefaults.timezone;
    houseSystem = layout.workspaceDefaults.houseSystem;
    astrologyTradition = layout.workspaceDefaults.astrologyTradition ?? '';
    selectedBodies = layout.workspaceDefaults.defaultBodies.length > 0
      ? [...layout.workspaceDefaults.defaultBodies]
      : [...DEFAULT_OBSERVABLE_OBJECT_IDS];
    aspects = Object.fromEntries(
      ASPECT_ROWS.map((aspect) => [aspect.id, aspectRowStateFromDefaults(aspect, layout.workspaceDefaults)])
    );
    aspectLineTiers = { ...layout.workspaceDefaults.aspectLineTierStyle };
  });

  async function persistWorkspaceDefaultsPatch(
    patch: Partial<typeof layout.workspaceDefaults>,
    options?: { recomputeCharts?: boolean }
  ) {
    setWorkspaceDefaults(patch);
    if (layout.workspacePath && isTauriRuntime()) {
      try {
        await saveWorkspaceDefaults(layout.workspacePath, layout.workspaceDefaults);
      } catch (err) {
        console.warn('Failed to persist workspace defaults', err);
      }
    }
    if (options?.recomputeCharts) {
      await recomputeAllCharts();
    }
  }

  async function recomputeAllCharts() {
    for (const chart of layout.contexts) {
      const chartAtTime = {
        ...chart,
        dateTime: chart.dateTime?.trim() || new Date().toISOString().slice(0, 19) + 'Z'
      };

      try {
        if (!isTauriRuntime()) {
          continue;
        }
        const result = await computeChartFromData(chartDataToComputePayload(chartAtTime));

        updateChartComputationAtTime(chart.id, chartAtTime.dateTime, computeResultToComputed(result));
      } catch (err) {
        console.warn(`Failed to refresh chart ${chart.id} after settings change`, err);
      }
    }
  }

  async function applyObservableObjects(nextBodies: string[]) {
    selectedBodies = [...nextBodies];
    settingsChanged = true;
    await persistWorkspaceDefaultsPatch({ defaultBodies: nextBodies }, { recomputeCharts: true });
  }

  function buildAspectPatch(nextAspects: Record<string, AspectRowState>) {
    return {
      defaultAspects: ASPECT_ROWS.filter((aspect) => nextAspects[aspect.id]?.enabled).map((aspect) => aspect.id),
      defaultAspectOrbs: Object.fromEntries(
        ASPECT_ROWS.map((aspect) => [
          aspect.id,
          Number.isFinite(nextAspects[aspect.id]?.orb)
            ? nextAspects[aspect.id]!.orb
            : DEFAULT_ASPECT_ORBS[aspect.id]
        ])
      ),
      defaultAspectColors: Object.fromEntries(
        ASPECT_ROWS.map((aspect) => [
          aspect.id,
          nextAspects[aspect.id]?.color || DEFAULT_ASPECT_COLORS[aspect.id]
        ])
      ),
      aspectIncludeAngles: Object.fromEntries(
        ASPECT_ROWS.map((aspect) => [
          aspect.id,
          nextAspects[aspect.id]?.includeAngles ?? ASPECT_SUGGESTED_INCLUDE_ANGLES[aspect.id] ?? true
        ])
      ),
      aspectIncludeExtended: Object.fromEntries(
        ASPECT_ROWS.map((aspect) => [aspect.id, nextAspects[aspect.id]?.includeExtended ?? false])
      ),
      aspectExtendedOrbs: Object.fromEntries(
        ASPECT_ROWS.map((aspect) => [
          aspect.id,
          Number.isFinite(nextAspects[aspect.id]?.extendedOrb)
            ? nextAspects[aspect.id]!.extendedOrb
            : suggestedExtendedOrb(DEFAULT_ASPECT_ORBS[aspect.id] ?? 1)
        ])
      )
    };
  }

  async function persistAspectSettings(nextAspects: Record<string, AspectRowState>) {
    await persistWorkspaceDefaultsPatch(buildAspectPatch(nextAspects), { recomputeCharts: true });
  }

  async function persistLocationSettings() {
    const parsedLatitude = Number(latitude);
    const parsedLongitude = Number(longitude);
    await persistWorkspaceDefaultsPatch({
      locationName: defaultLocation.trim() || layout.workspaceDefaults.locationName,
      locationLatitude: Number.isFinite(parsedLatitude) ? parsedLatitude : layout.workspaceDefaults.locationLatitude,
      locationLongitude: Number.isFinite(parsedLongitude) ? parsedLongitude : layout.workspaceDefaults.locationLongitude,
      timezone: timezone.trim() || layout.workspaceDefaults.timezone
    });
  }

  function applyResolvedDefaultLocation(location: ResolvedLocation) {
    defaultLocation = location.display_name;
    latitude = location.latitude.toFixed(4);
    longitude = location.longitude.toFixed(4);
    locationStatus = `${t('toast_location_resolved', {}, 'Location resolved')}: ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
    settingsChanged = true;
  }

  async function selectResolvedDefaultLocation(location: ResolvedLocation) {
    applyResolvedDefaultLocation(location);
    await persistLocationSettings();
  }

  async function resolveDefaultLocation() {
    const query = defaultLocation.trim();
    if (!query) {
      locationStatus = t('toast_location_required', {}, 'Enter a location first.');
      return;
    }
    if (!isTauriRuntime()) {
      locationStatus = t('toast_location_resolve_failed', {}, 'Failed to resolve location');
      return;
    }

    isResolvingLocation = true;
    locationStatus = null;
    try {
      const resolved = await resolveLocation(query);
      applyResolvedDefaultLocation(resolved);
      await persistLocationSettings();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      locationStatus = `${t('toast_location_resolve_failed', {}, 'Failed to resolve location')}: ${message}`;
    } finally {
      isResolvingLocation = false;
    }
  }

  function resetDraftsFromWorkspace() {
    settingsChanged = false;
    defaultLocation = layout.workspaceDefaults.locationName;
    latitude = String(layout.workspaceDefaults.locationLatitude);
    longitude = String(layout.workspaceDefaults.locationLongitude);
    timezone = layout.workspaceDefaults.timezone;
    houseSystem = layout.workspaceDefaults.houseSystem;
    astrologyTradition = layout.workspaceDefaults.astrologyTradition ?? '';
    selectedBodies = layout.workspaceDefaults.defaultBodies.length > 0
      ? [...layout.workspaceDefaults.defaultBodies]
      : [...DEFAULT_OBSERVABLE_OBJECT_IDS];
    aspects = Object.fromEntries(
      ASPECT_ROWS.map((aspect) => [aspect.id, aspectRowStateFromDefaults(aspect, layout.workspaceDefaults)])
    );
    aspectLineTiers = { ...layout.workspaceDefaults.aspectLineTierStyle };
    elementColors = { ...getElementColors() };
  }
</script>

<div class="h-full min-w-0 rounded-md border bg-card text-card-foreground shadow-sm p-4 flex flex-col overflow-hidden">
  <div class="flex-1 min-h-0 overflow-y-auto">
    {#if section === 'jazyk'}
      <h3 class="text-sm font-semibold mb-4">{t('section_jazyk', {}, 'Language')}</h3>
      <div class="space-y-4 max-w-md">
        <div class="space-y-2">
          <label class="block text-sm font-medium opacity-90" for="settings-lang">{t('language', {}, 'Language')}</label>
          <div class="min-w-[220px]">
            <Select.Root
              type="single"
              name="appLanguage"
              value={currentLangValue}
              onValueChange={(value) => {
                if (value !== i18n.lang) {
                  setLang(value as any);
                  settingsChanged = true;
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
      </div>
    {:else if section === 'lokace'}
      <h3 class="text-sm font-semibold mb-4">{t('section_lokace', {}, 'Location')}</h3>
      <div class="space-y-4 max-w-md">
        <div class="space-y-2">
          <div class="block text-sm font-medium opacity-90">{t('default_location', {}, 'Default location')}</div>
          <LocationSelector
            bind:value={defaultLocation}
            onValueChange={() => {
              settingsChanged = true;
              locationStatus = null;
            }}
            options={locationOptions}
            placeholder={t('placeholder_default_location', {}, 'Enter default location...')}
            searchPlaceholder={t('new_location_search', {}, 'Search')}
            emptyLabel={t('new_placeholder_any_location', {}, 'Any searchable location…')}
            loadingLabel={t('new_resolving_location', {}, 'Resolving…')}
            searchLocations={isTauriRuntime() ? searchLocations : undefined}
            onResolvedLocationSelect={(location) => void selectResolvedDefaultLocation(location)}
            class="bg-background"
          />
          <div class="flex justify-end">
            <Button
              type="button"
              variant="outline"
              class="h-9 px-3 text-sm"
              onclick={() => void resolveDefaultLocation()}
              disabled={isResolvingLocation || !defaultLocation.trim() || !isTauriRuntime()}
            >
              <LocateFixed class="h-4 w-4" />
              {isResolvingLocation ? t('new_resolving_location', {}, 'Resolving…') : t('new_resolve_location', {}, 'Resolve location')}
            </Button>
          </div>
          {#if locationStatus}
            <div class="text-xs opacity-75">{locationStatus}</div>
          {/if}
          <div class="text-xs opacity-70">
            {t('settings_default_location_hint', {}, 'Choose a searched location to sync its coordinates, or adjust latitude and longitude manually below.')}
          </div>
        </div>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div class="space-y-2">
            <div class="block text-sm font-medium opacity-90">{t('current_info_latitude', {}, 'Latitude')}</div>
            <Input
              type="text"
              class="w-full h-9 px-3 rounded-md bg-background text-foreground border"
              bind:value={latitude}
              onblur={() => void persistLocationSettings()}
              oninput={() => (settingsChanged = true)}
              placeholder={t('placeholder_latitude', {}, 'Latitude')}
            />
          </div>
          <div class="space-y-2">
            <div class="block text-sm font-medium opacity-90">{t('current_info_longitude', {}, 'Longitude')}</div>
            <Input
              type="text"
              class="w-full h-9 px-3 rounded-md bg-background text-foreground border"
              bind:value={longitude}
              onblur={() => void persistLocationSettings()}
              oninput={() => (settingsChanged = true)}
              placeholder={t('placeholder_longitude', {}, 'Longitude')}
            />
          </div>
        </div>
        <div class="space-y-2">
          <div class="block text-sm font-medium opacity-90">{t('current_info_timezone', {}, 'Timezone')}</div>
          <Input
            type="text"
            class="w-full h-9 px-3 rounded-md bg-background text-foreground border"
            bind:value={timezone}
            onblur={() => void persistLocationSettings()}
            oninput={() => (settingsChanged = true)}
            placeholder={t('placeholder_utc_offset', {}, 'Timezone')}
          />
        </div>
      </div>
    {:else if section === 'system_domu'}
      <h3 class="text-sm font-semibold mb-4">{t('section_system_domu', {}, 'House system')}</h3>
      <div class="space-y-4 max-w-md">
        <div class="space-y-2">
          <div class="block text-sm font-medium opacity-90">{t('house_system', {}, 'House System')}</div>
          <Select.Root
            type="single"
            bind:value={houseSystem}
            onValueChange={(value) => {
              houseSystem = value;
              settingsChanged = true;
              void persistWorkspaceDefaultsPatch({ houseSystem: value });
            }}
          >
            <Select.Trigger class="w-full h-9 px-3">{houseSystem}</Select.Trigger>
            <Select.Content>
              <Select.Group>
                {#each catalogHouseSystems() as system}
                  <Select.Item value={system} label={system}>{system}</Select.Item>
                {/each}
              </Select.Group>
            </Select.Content>
          </Select.Root>
        </div>
        <div class="space-y-2">
          <div class="block text-sm font-medium opacity-90">{t('settings_position_mode', {}, 'Planet positions')}</div>
          <Select.Root
            type="single"
            value={layout.workspaceDefaults.positionMode}
            onValueChange={(value) => {
              const positionMode = value === 'geometric' ? 'geometric' : 'apparent';
              settingsChanged = true;
              void persistWorkspaceDefaultsPatch({ positionMode }, { recomputeCharts: true });
            }}
          >
            <Select.Trigger class="w-full h-9 px-3">
              {layout.workspaceDefaults.positionMode === 'geometric'
                ? t('settings_position_mode_geometric', {}, 'Geometric / true')
                : t('settings_position_mode_apparent', {}, 'Apparent (recommended)')}
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="apparent" label={t('settings_position_mode_apparent', {}, 'Apparent (recommended)')}>
                {t('settings_position_mode_apparent', {}, 'Apparent (recommended)')}
              </Select.Item>
              <Select.Item value="geometric" label={t('settings_position_mode_geometric', {}, 'Geometric / true')}>
                {t('settings_position_mode_geometric', {}, 'Geometric / true')}
              </Select.Item>
            </Select.Content>
          </Select.Root>
          <p class="text-xs opacity-70">{t('settings_position_mode_hint', {}, 'Apparent positions account for light travel time and stellar aberration.')}</p>
        </div>
      </div>
    {:else if section === 'pozorovane_objekty'}
      <h3 class="text-sm font-semibold mb-4">{t('section_observable_objects', {}, 'Observable objects')}</h3>
      <div class="space-y-4 max-w-4xl">
        <p class="text-sm opacity-80">
          {t('settings_observable_objects_hint', {}, 'Select the celestial bodies and points that should be computed and shown across the app.')}
        </p>
        <BodySelector bind:selectedBodies={selectedBodies} onSelectionChange={applyObservableObjects} />
      </div>
    {:else if section === 'nastaveni_aspektu'}
      <h3 class="text-sm font-semibold mb-4">{t('section_nastaveni_aspektu', {}, 'Aspect settings')}</h3>
      <div class="space-y-4 max-w-3xl">
        <div class="space-y-2 rounded-xl bg-muted/40 px-4 py-4">
          <div class="block text-sm font-medium opacity-90">
            {t('settings_astrology_tradition_label', {}, 'School')}
          </div>
          <Select.Root
            type="single"
            bind:value={astrologyTradition}
            onValueChange={(value) => {
              const next = value as AstrologicalTraditionId;
              astrologyTradition = next;
              settingsChanged = true;
              void persistWorkspaceDefaultsPatch({ astrologyTradition: next });
            }}
          >
            <Select.Trigger class="w-full h-9 px-3">
              {ASTROLOGY_TRADITION_OPTIONS.find((o) => o.id === astrologyTradition)
                ? t(ASTROLOGY_TRADITION_OPTIONS.find((o) => o.id === astrologyTradition)!.labelKey)
                : t('settings_astrology_tradition_none', {}, 'Not selected')}
            </Select.Trigger>
            <Select.Content>
              <Select.Group>
                {#each ASTROLOGY_TRADITION_OPTIONS as option (option.id)}
                  <Select.Item value={option.id} label={t(option.labelKey)}>{t(option.labelKey)}</Select.Item>
                {/each}
              </Select.Group>
            </Select.Content>
          </Select.Root>
          <p class="text-xs text-muted-foreground">
            {t(
              'settings_astrology_tradition_hint',
              {},
              'Sets which aspects are enabled, their orbs, and angle inclusion to match the chosen tradition. Does not yet affect objects or the orb model.'
            )}
          </p>
        </div>
        <div class="space-y-2">
          <div class="block text-sm font-medium opacity-90">{t('default_aspects', {}, 'Default aspects')}</div>
          <Accordion.Root type="multiple" class="space-y-3">
            {#each ASPECT_ROWS as aspect}
              {@const row = aspects[aspect.id] ?? aspectRowStateFromDefaults(aspect, layout.workspaceDefaults)}
              {@const updateRow = (patch: Partial<AspectRowState>, persist = true) => {
                const next = { ...aspects, [aspect.id]: { ...row, ...patch } };
                aspects = next;
                settingsChanged = true;
                if (persist) void persistAspectSettings(next);
              }}
              <Accordion.Item value={aspect.id} class="rounded-xl border-0 bg-muted/40 px-4">
                <div class="flex items-center gap-3 py-3">
                  <label class="flex flex-1 items-center gap-2 cursor-pointer">
                    <Checkbox
                      class="cursor-pointer"
                      checked={row.enabled}
                      onchange={(e) => updateRow({ enabled: (e.currentTarget as HTMLInputElement).checked })}
                    />
                    <span class="text-sm">{t(aspect.labelKey, {}, aspect.fallbackLabel)}</span>
                  </label>
                  <input
                    type="color"
                    class="h-9 w-10 shrink-0 cursor-pointer rounded-md border border-border/60 bg-background p-0"
                    value={row.color}
                    onchange={(e) => updateRow({ color: (e.currentTarget as HTMLInputElement).value })}
                  />
                  <Accordion.Trigger class="w-auto flex-none gap-2 py-0 text-xs hover:no-underline">
                    <span class="uppercase tracking-wide tabular-nums text-muted-foreground">
                      {row.orb}&deg; {t('label_orb', {}, 'Orb')}
                    </span>
                  </Accordion.Trigger>
                </div>
                <Accordion.Content class="pb-4 pt-0">
                  <div class="space-y-3 rounded-lg bg-black/10 p-3 dark:bg-white/5">
                    <div class="grid grid-cols-[1fr_auto] items-center gap-3">
                      <span class="text-xs text-muted-foreground">
                        {t('settings_aspect_scope_planets', {}, 'Planets')}{row.includeAngles
                          ? ` + ${t('settings_aspect_scope_angles_short', {}, 'Angles')}`
                          : ''}
                      </span>
                      <Input
                        type="number"
                        class="w-20 h-9 px-2 rounded-md bg-background text-foreground border text-xs"
                        value={row.orb}
                        min="0"
                        max="30"
                        step="0.5"
                        oninput={(e) =>
                          updateRow(
                            { orb: Number((e.currentTarget as HTMLInputElement).value) || 0 },
                            false
                          )}
                        onblur={() => void persistAspectSettings(aspects)}
                      />
                    </div>
                    <label class="flex items-center gap-2 cursor-pointer text-sm">
                      <Checkbox
                        class="cursor-pointer"
                        checked={row.includeAngles}
                        onchange={(e) =>
                          updateRow({ includeAngles: (e.currentTarget as HTMLInputElement).checked })}
                      />
                      {t('settings_aspect_scope_include_angles', {}, 'Include angles (Ascendant / Midheaven)')}
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer text-sm">
                      <Checkbox
                        class="cursor-pointer"
                        checked={row.includeExtended}
                        onchange={(e) =>
                          updateRow({ includeExtended: (e.currentTarget as HTMLInputElement).checked })}
                      />
                      {t(
                        'settings_aspect_scope_include_extended',
                        {},
                        'Include extended objects (asteroids, nodes, parts, other calculated points) — uses a tighter orb'
                      )}
                    </label>
                    {#if row.includeExtended}
                      <div class="grid grid-cols-[1fr_auto] items-center gap-3 pl-6">
                        <span class="text-xs text-muted-foreground">
                          {t('settings_aspect_scope_extended_orb', {}, 'Extended objects orb')}
                        </span>
                        <Input
                          type="number"
                          class="w-20 h-9 px-2 rounded-md bg-background text-foreground border text-xs"
                          value={row.extendedOrb}
                          min="0"
                          max={row.orb}
                          step="0.5"
                          oninput={(e) =>
                            updateRow(
                              { extendedOrb: Number((e.currentTarget as HTMLInputElement).value) || 0 },
                              false
                            )}
                          onblur={() => void persistAspectSettings(aspects)}
                        />
                      </div>
                    {/if}
                  </div>
                </Accordion.Content>
              </Accordion.Item>
            {/each}
          </Accordion.Root>
        </div>
        <div class="space-y-3 rounded-xl border border-border/60 px-4 py-4">
          <div class="block text-sm font-medium opacity-90">
            {t('settings_radix_aspect_lines_title', {}, 'Radix aspect line weights')}
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            {#each aspectTierFields as field}
              <div class="space-y-1">
                <label class="text-xs" for={`aspect-tier-${field.key}`}>{t(field.labelKey, {}, field.labelKey)}</label>
                <Input
                  id={`aspect-tier-${field.key}`}
                  type="number"
                  class="h-9"
                  min={field.min}
                  step={field.step}
                  value={aspectLineTiers[field.key]}
                  oninput={(e) => {
                    aspectLineTiers = {
                      ...aspectLineTiers,
                      [field.key]: Number((e.currentTarget as HTMLInputElement).value) || aspectLineTiers[field.key]
                    };
                    settingsChanged = true;
                  }}
                  onblur={() => void persistWorkspaceDefaultsPatch({ aspectLineTierStyle: aspectLineTiers }, { recomputeCharts: true })}
                />
              </div>
            {/each}
            <div class="space-y-1">
              <label class="text-xs" for="aspect-tier-outer-style">
                {t('settings_aspect_line_outer_style', {}, 'Outer tier line style')}
              </label>
              <Select.Root
                type="single"
                name="aspectOuterLineStyle"
                value={aspectLineTiers.outerLineStyle}
                onValueChange={(value) => {
                  const next = value === 'solid' || value === 'dashed' ? value : 'dotted';
                  aspectLineTiers = { ...aspectLineTiers, outerLineStyle: next };
                  settingsChanged = true;
                  void persistWorkspaceDefaultsPatch(
                    { aspectLineTierStyle: aspectLineTiers },
                    { recomputeCharts: true }
                  );
                }}
              >
                <Select.Trigger class="h-9" id="aspect-tier-outer-style">
                  {ASPECT_LINE_OUTER_STYLE_OPTIONS.find((o) => o.id === aspectLineTiers.outerLineStyle)?.label ??
                    'Dotted'}
                </Select.Trigger>
                <Select.Content>
                  <Select.Group>
                    {#each ASPECT_LINE_OUTER_STYLE_OPTIONS as option (option.id)}
                      <Select.Item value={option.id} label={option.label}>{option.label}</Select.Item>
                    {/each}
                  </Select.Group>
                </Select.Content>
              </Select.Root>
            </div>
          </div>
        </div>
      </div>
    {:else if section === 'vzhled'}
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
          <label class="block text-sm font-medium opacity-90" for="settings-wheel-style">{t('select_wheel_style', {}, 'Wheel style')}</label>
          <div class="min-w-[220px]">
            <Select.Root type="single" name="wheelStyle" bind:value={wheelStyleValue}>
              <Select.Trigger class="w-[220px]" id="settings-wheel-style">
                {wheelStyleTriggerContent}
              </Select.Trigger>
              <Select.Content>
                <Select.Group>
                  {#each wheelStyleOptions as styleOpt (styleOpt.id)}
                    <Select.Item value={styleOpt.id} label={styleOpt.label}>
                      {styleOpt.label}
                    </Select.Item>
                  {/each}
                </Select.Group>
              </Select.Content>
            </Select.Root>
          </div>
          <div class="text-xs text-muted-foreground max-w-[260px]">
            {wheelStyleOptions.find((s) => s.id === wheelStyleValue)?.description}
          </div>
        </div>
        <div class="space-y-2 w-full sm:w-auto sm:min-w-[240px]">
          <label class="block text-sm font-medium opacity-90" for="settings-app-shell-set">App shell icon set</label>
          <div class="min-w-[220px]">
            <Select.Root type="single" name="appShellIconSet" bind:value={appShellIconSetValue}>
              <Select.Trigger class="w-[220px]" id="settings-app-shell-set">
                {appShellIconSetTriggerContent}
              </Select.Trigger>
              <Select.Content>
                <Select.Group>
                  <Select.Label>Icon sets</Select.Label>
                  {#each appShellIconSetOptions as setOpt (setOpt.id)}
                    <Select.Item value={setOpt.id} label={setOpt.label}>
                      {setOpt.label}
                    </Select.Item>
                  {/each}
                </Select.Group>
              </Select.Content>
            </Select.Root>
          </div>
          <div class="text-xs text-muted-foreground max-w-[260px]">
            {appShellIconSetOptions.find((s) => s.id === appShellIconSetValue)?.description}
          </div>
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
    {:else if section === 'manual'}
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
  <div class="pt-4 mt-4 border-t border-border/60 flex-shrink-0 flex gap-2">
    <Button
      variant="outline"
      class="flex-1"
      onclick={resetDraftsFromWorkspace}
    >
      {t('cancel', {}, 'Cancel')}
    </Button>
    <Button
      class="flex-1"
      onclick={async () => {
        await persistLocationSettings();
        settingsChanged = false;
      }}
      disabled={!settingsChanged}
    >
      {t('confirm', {}, 'Confirm')}
    </Button>
  </div>
</div>
