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
    ASPECT_ROWS,
    DEFAULT_ASPECT_COLORS,
    DEFAULT_ASPECT_ORBS,
    type AspectLineTierStyleState
  } from '$lib/astrology/aspects';
  import BodySelector from '$lib/components/BodySelector.svelte';
  import { layout, chartDataToComputePayload, updateChartComputationAtTime, setWorkspaceDefaults } from '$lib/state/layout';
  import { DEFAULT_OBSERVABLE_OBJECT_IDS } from '$lib/astrology/observableObjects';
  import { invoke } from '@tauri-apps/api/core';

  let {
    section
  }: {
    section?: string | undefined;
  } = $props();

  let settingsChanged = $state(false);
  const HOUSE_SYSTEMS = [
    'Placidus',
    'Whole Sign',
    'Campanus',
    'Koch',
    'Equal',
    'Regiomontanus',
    'Vehlow',
    'Porphyry',
    'Alcabitius'
  ] as const;
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
    if (section === 'vzhled') {
      elementColors = { ...getElementColors() };
    }
  });

  let selectedBodies = $state<string[]>(layout.workspaceDefaults.defaultBodies.length > 0
    ? [...layout.workspaceDefaults.defaultBodies]
    : [...DEFAULT_OBSERVABLE_OBJECT_IDS]);
  let aspects = $state<Record<string, { enabled: boolean; orb: number; color: string }>>(
    Object.fromEntries(
      ASPECT_ROWS.map((aspect) => [
        aspect.id,
        {
          enabled: layout.workspaceDefaults.defaultAspects.includes(aspect.id),
          orb: layout.workspaceDefaults.defaultAspectOrbs[aspect.id] ?? aspect.defaultOrb,
          color: layout.workspaceDefaults.defaultAspectColors[aspect.id] ?? DEFAULT_ASPECT_COLORS[aspect.id]
        }
      ])
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

  $effect(() => {
    defaultLocation = layout.workspaceDefaults.locationName;
    latitude = String(layout.workspaceDefaults.locationLatitude);
    longitude = String(layout.workspaceDefaults.locationLongitude);
    timezone = layout.workspaceDefaults.timezone;
    houseSystem = layout.workspaceDefaults.houseSystem;
    selectedBodies = layout.workspaceDefaults.defaultBodies.length > 0
      ? [...layout.workspaceDefaults.defaultBodies]
      : [...DEFAULT_OBSERVABLE_OBJECT_IDS];
    aspects = Object.fromEntries(
      ASPECT_ROWS.map((aspect) => [
        aspect.id,
        {
          enabled: layout.workspaceDefaults.defaultAspects.includes(aspect.id),
          orb: layout.workspaceDefaults.defaultAspectOrbs[aspect.id] ?? aspect.defaultOrb,
          color: layout.workspaceDefaults.defaultAspectColors[aspect.id] ?? DEFAULT_ASPECT_COLORS[aspect.id]
        }
      ])
    );
    aspectLineTiers = { ...layout.workspaceDefaults.aspectLineTierStyle };
  });

  async function persistWorkspaceDefaultsPatch(
    patch: Partial<typeof layout.workspaceDefaults>,
    options?: { recomputeCharts?: boolean }
  ) {
    setWorkspaceDefaults(patch);
    if (layout.workspacePath) {
      try {
        await invoke('save_workspace_defaults', {
          workspacePath: layout.workspacePath,
          defaults: {
            default_house_system: layout.workspaceDefaults.houseSystem,
            default_timezone: layout.workspaceDefaults.timezone,
            default_location_name: layout.workspaceDefaults.locationName,
            default_location_latitude: layout.workspaceDefaults.locationLatitude,
            default_location_longitude: layout.workspaceDefaults.locationLongitude,
            default_engine: layout.workspaceDefaults.engine,
            default_bodies: layout.workspaceDefaults.defaultBodies,
            default_aspects: layout.workspaceDefaults.defaultAspects,
            default_aspect_orbs: layout.workspaceDefaults.defaultAspectOrbs,
            default_aspect_colors: layout.workspaceDefaults.defaultAspectColors,
            aspect_line_tier_style: {
              tight_threshold_pct: layout.workspaceDefaults.aspectLineTierStyle.tightThresholdPct,
              medium_threshold_pct: layout.workspaceDefaults.aspectLineTierStyle.mediumThresholdPct,
              loose_threshold_pct: layout.workspaceDefaults.aspectLineTierStyle.looseThresholdPct,
              width_tight: layout.workspaceDefaults.aspectLineTierStyle.widthTight,
              width_medium: layout.workspaceDefaults.aspectLineTierStyle.widthMedium,
              width_loose: layout.workspaceDefaults.aspectLineTierStyle.widthLoose,
              width_outer: layout.workspaceDefaults.aspectLineTierStyle.widthOuter
            }
          },
        });
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
        const result = await invoke<{
          positions?: Record<string, unknown>;
          motion?: Record<string, { speed: number; retrograde: boolean }>;
          aspects?: unknown[];
          axes?: { asc: number; desc: number; mc: number; ic: number };
          house_cusps?: number[];
        }>('compute_chart_from_data', { chartJson: chartDataToComputePayload(chartAtTime) });

        updateChartComputationAtTime(chart.id, chartAtTime.dateTime, {
          positions: result.positions ?? {},
          motion: result.motion ?? {},
          aspects: result.aspects ?? [],
          axes: result.axes,
          houseCusps: result.house_cusps
        });
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

  function buildAspectPatch(nextAspects: Record<string, { enabled: boolean; orb: number; color: string }>) {
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
      )
    };
  }

  async function persistAspectSettings(nextAspects: Record<string, { enabled: boolean; orb: number; color: string }>) {
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

  function resetDraftsFromWorkspace() {
    settingsChanged = false;
    defaultLocation = layout.workspaceDefaults.locationName;
    latitude = String(layout.workspaceDefaults.locationLatitude);
    longitude = String(layout.workspaceDefaults.locationLongitude);
    timezone = layout.workspaceDefaults.timezone;
    houseSystem = layout.workspaceDefaults.houseSystem;
    selectedBodies = layout.workspaceDefaults.defaultBodies.length > 0
      ? [...layout.workspaceDefaults.defaultBodies]
      : [...DEFAULT_OBSERVABLE_OBJECT_IDS];
    aspects = Object.fromEntries(
      ASPECT_ROWS.map((aspect) => [
        aspect.id,
        {
          enabled: layout.workspaceDefaults.defaultAspects.includes(aspect.id),
          orb: layout.workspaceDefaults.defaultAspectOrbs[aspect.id] ?? aspect.defaultOrb,
          color: layout.workspaceDefaults.defaultAspectColors[aspect.id] ?? DEFAULT_ASPECT_COLORS[aspect.id]
        }
      ])
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
          <Input
            type="text"
            class="w-full h-9 px-3 rounded-md bg-background text-foreground border"
            bind:value={defaultLocation}
            onblur={() => void persistLocationSettings()}
            oninput={() => (settingsChanged = true)}
            placeholder={t('placeholder_default_location', {}, 'Enter default location...')}
          />
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
                {#each HOUSE_SYSTEMS as system}
                  <Select.Item value={system} label={system}>{system}</Select.Item>
                {/each}
              </Select.Group>
            </Select.Content>
          </Select.Root>
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
        <div class="space-y-2">
          <div class="block text-sm font-medium opacity-90">{t('default_aspects', {}, 'Default aspects')}</div>
          <div class="space-y-2">
            {#each ASPECT_ROWS as aspect}
              {@const row = aspects[aspect.id]}
              <div class="grid items-center gap-3 rounded-xl border border-border/60 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_170px]">
                <label class="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    class="cursor-pointer"
                    checked={row?.enabled}
                    onchange={(e) => {
                      const next = {
                        ...aspects,
                        [aspect.id]: {
                          ...row,
                          enabled: (e.currentTarget as HTMLInputElement).checked
                        }
                      };
                      aspects = next;
                      settingsChanged = true;
                      void persistAspectSettings(next);
                    }}
                  />
                  <span class="text-sm">{t(aspect.labelKey, {}, aspect.labelKey)}</span>
                </label>
                <div class="flex items-center gap-2">
                  <input
                    type="color"
                    class="h-9 w-10 shrink-0 cursor-pointer rounded-md border border-border/60 bg-background p-0"
                    value={row?.color ?? DEFAULT_ASPECT_COLORS[aspect.id]}
                    onchange={(e) => {
                      const next = {
                        ...aspects,
                        [aspect.id]: {
                          ...row,
                          color: (e.currentTarget as HTMLInputElement).value
                        }
                      };
                      aspects = next;
                      settingsChanged = true;
                      void persistAspectSettings(next);
                    }}
                  />
                  <Input
                    type="number"
                    class="w-20 h-8 px-2 rounded-md bg-background text-foreground border text-xs"
                    value={row?.orb ?? aspect.defaultOrb}
                    min="0"
                    max="30"
                    step="0.5"
                    oninput={(e) => {
                      const next = {
                        ...aspects,
                        [aspect.id]: {
                          ...row,
                          orb: Number((e.currentTarget as HTMLInputElement).value) || 0
                        }
                      };
                      aspects = next;
                      settingsChanged = true;
                    }}
                    onblur={() => void persistAspectSettings(aspects)}
                  />
                </div>
              </div>
            {/each}
          </div>
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
