<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import { t } from '$lib/i18n/index.svelte';
  import {
    layout,
    loadChartsFromWorkspace,
    updateChartComputation,
    chartDataToComputePayload,
    type ChartData,
    setMode,
    setWorkspaceDefaults
  } from '$lib/state/layout';

  export type OpenMode = 'my_radixes' | 'database';

  let {
    openMode = $bindable('my_radixes' as OpenMode)
  }: {
    openMode?: OpenMode;
  } = $props();

  let searchQuery = $state('');

  const filteredCharts = $derived.by(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return layout.contexts;
    return layout.contexts.filter((chart) => {
      const tags = (chart.tags ?? []).join(' ').toLowerCase();
      return (
        chart.name.toLowerCase().includes(q) ||
        (chart.location ?? '').toLowerCase().includes(q) ||
        (chart.dateTime ?? '').toLowerCase().includes(q) ||
        tags.includes(q)
      );
    });
  });

  function chartTypeLabel(chart: ChartData): string {
    if (chart.chartType === 'NATAL') return t('new_type_radix', {}, 'Radix');
    if (chart.chartType === 'EVENT') return t('new_type_event', {}, 'Event');
    if (chart.chartType === 'HORARY') return t('new_type_horary', {}, 'Horary');
    return chart.chartType;
  }

  async function handleOpenWorkspace() {
    try {
      const folderPath = await invoke<string | null>('open_folder_dialog');
      if (!folderPath) return;

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

      const charts: ChartData[] = [];
      for (const ch of workspace.charts) {
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

      for (const chart of charts) {
        try {
          const result = await invoke<{
            positions?: Record<string, unknown>;
            motion?: Record<string, { speed: number; retrograde: boolean }>;
            aspects?: any[];
            axes?: { asc: number; desc: number; mc: number; ic: number };
            house_cusps?: number[];
            chart_id: string;
          }>('compute_chart', {
            workspacePath: workspace.path,
            chartId: chart.id
          });

          updateChartComputation(chart.id, {
            positions: result.positions ?? {},
            motion: result.motion ?? {},
            aspects: result.aspects ?? [],
            axes: result.axes,
            houseCusps: result.house_cusps
          });
        } catch (err) {
          console.error(`Failed to compute chart ${chart.id}:`, err);
        }
      }
    } catch (err) {
      console.error('Failed to load workspace:', err);
    }
  }

  async function handleSaveWorkspace() {
    try {
      if (layout.contexts.length === 0) {
        console.warn('No charts to save');
        return;
      }

      let folderPath: string | null = layout.workspacePath;
      if (!folderPath) {
        folderPath = await invoke<string | null>('open_folder_dialog');
      }

      if (!folderPath) return;

      const chartsPayload = layout.contexts.map((c) => chartDataToComputePayload(c));
      await invoke<string>('save_workspace', {
        workspacePath: folderPath,
        owner: 'User',
        charts: chartsPayload,
        defaults: {
          default_house_system: layout.workspaceDefaults.houseSystem,
          default_timezone: layout.workspaceDefaults.timezone,
          default_location_name: layout.workspaceDefaults.locationName,
          default_location_latitude: layout.workspaceDefaults.locationLatitude,
          default_location_longitude: layout.workspaceDefaults.locationLongitude,
          default_engine: layout.workspaceDefaults.engine,
          default_bodies: layout.workspaceDefaults.defaultBodies,
          default_aspects: layout.workspaceDefaults.defaultAspects
        }
      });
      await invoke<string>('init_storage', { workspacePath: folderPath });
      layout.workspacePath = folderPath;
    } catch (err) {
      console.error('Failed to save workspace:', err);
    }
  }
</script>

<div class="h-full w-full rounded-md border bg-card text-card-foreground shadow-sm p-4 flex flex-col overflow-hidden">
  {#if openMode === 'my_radixes'}
    <div class="flex flex-col h-full">
      <div class="flex items-center gap-2 mb-4">
        <Button class="px-4 py-2" onclick={handleOpenWorkspace}>
          {t('open_workspace', {}, 'Open Workspace')}
        </Button>
        <Button variant="outline" class="px-4 py-2" onclick={handleSaveWorkspace}>
          {t('save_workspace', {}, 'Save Workspace')}
        </Button>
        <Button
          variant="outline"
          class="px-4 py-2"
          onclick={async () => {
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
            {#each filteredCharts as chart}
              <tr
                class="border-b hover:bg-accent/50 transition-colors cursor-pointer"
                onclick={() => {
                  layout.selectedContext = chart.id;
                  layout.selectedTab = 'Radix';
                  setMode('radix_view');
                }}
              >
                <td class="p-2">{chart.name}</td>
                <td class="p-2 opacity-75">{chartTypeLabel(chart)}</td>
                <td class="p-2 opacity-75">{chart.dateTime}</td>
                <td class="p-2 opacity-75">{chart.location}</td>
                <td class="p-2 opacity-75">{chart.tags.join(', ')}</td>
              </tr>
            {/each}
            {#if filteredCharts.length === 0}
              <tr>
                <td colspan="5" class="p-4 text-center opacity-60">
                  {layout.contexts.length === 0
                    ? t('no_charts_loaded', {}, 'No charts loaded. Click "Open Workspace" to load charts.')
                    : t('open_search_no_results', {}, 'No matching charts found.')}
                </td>
              </tr>
            {/if}
          </tbody>
        </table>
      </div>
    </div>
  {:else}
    <div class="flex-1 flex items-center justify-center">
      <div class="text-center space-y-2 opacity-60">
        <p class="text-lg font-medium">{t('open_mode_database', {}, 'Persons Database')}</p>
        <p class="text-sm">{t('database_placeholder', {}, 'Custom layout for fetching specific persons')}</p>
      </div>
    </div>
  {/if}
</div>
