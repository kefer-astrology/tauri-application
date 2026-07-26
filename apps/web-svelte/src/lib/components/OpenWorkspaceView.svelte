<script lang="ts">
  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import { t } from '$lib/i18n/index.svelte';
  import { isTauriRuntime } from '$lib/tauri/runtime';
  import {
    initStorage,
    openFolderDialog,
    openWorkspaceFolder,
    saveWorkspace,
    workspaceDefaultsDtoToStatePatch
  } from '$lib/tauri/workspace';
  import {
    layout,
    loadChartsFromWorkspace,
    chartDataToComputePayload,
    type ChartData,
    setMode,
    setWorkspaceDefaults,
    mergeModelReportDefaults
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
    if (!isTauriRuntime()) {
      return;
    }
    try {
      const folderPath = await openFolderDialog();
      if (!folderPath) return;

      const workspace = await openWorkspaceFolder(
        folderPath,
        (defaults) => {
          setWorkspaceDefaults(workspaceDefaultsDtoToStatePatch(defaults));
        },
        (report) => {
          mergeModelReportDefaults(report);
          if (report.warnings.length > 0) {
            console.warn('Model report warnings:', report.warnings);
          }
        }
      );

      loadChartsFromWorkspace(workspace.charts);
      layout.workspacePath = workspace.path;
    } catch (err) {
      console.error('Failed to load workspace:', err);
    }
  }

  async function handleSaveWorkspace() {
    if (!isTauriRuntime()) {
      return;
    }
    try {
      if (layout.contexts.length === 0) {
        console.warn('No charts to save');
        return;
      }

      let folderPath: string | null = layout.workspacePath;
      if (!folderPath) {
        folderPath = await openFolderDialog();
      }

      if (!folderPath) return;

      const chartsPayload = layout.contexts.map((c) => chartDataToComputePayload(c));
      await saveWorkspace(folderPath, 'User', chartsPayload, layout.workspaceDefaults);
      await initStorage(folderPath);
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
