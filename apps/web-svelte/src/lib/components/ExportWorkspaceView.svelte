<script lang="ts">
  import { showOpenExportOverlay } from '$lib/state/layout';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Checkbox } from '$lib/components/ui/checkbox/index.js';
  import { t } from '$lib/i18n/index.svelte';

  export type ExportType = 'print' | 'pdf' | 'png';

  let {
    exportType = $bindable('print' as ExportType)
  }: {
    exportType?: ExportType;
  } = $props();

  let exportIncludeLocation = $state(true);
  let exportIncludeAspects = $state(true);
  let exportIncludeInfo = $state(true);
</script>

<div class="h-full w-full rounded-md border bg-card text-card-foreground shadow-sm p-4 flex flex-col overflow-y-auto">
  <h2 class="text-lg font-semibold mb-4">{t('export', {}, 'Export')}</h2>
  <div class="space-y-4 w-full max-w-2xl">
    <div class="text-sm font-medium opacity-85 mb-3">
      {t('export_include', {}, 'Include in export')}
    </div>

    <div class="space-y-3">
      <label class="flex items-center gap-3 cursor-pointer group">
        <Checkbox
          checked={exportIncludeLocation}
          onchange={(event) => {
            exportIncludeLocation = (event.currentTarget as HTMLInputElement).checked;
          }}
          class="cursor-pointer"
        />
        <span class="text-sm opacity-85 group-hover:opacity-100 transition-opacity">
          {t('export_include_location', {}, 'Location')}
        </span>
      </label>

      <label class="flex items-center gap-3 cursor-pointer group">
        <Checkbox
          checked={exportIncludeAspects}
          onchange={(event) => {
            exportIncludeAspects = (event.currentTarget as HTMLInputElement).checked;
          }}
          class="cursor-pointer"
        />
        <span class="text-sm opacity-85 group-hover:opacity-100 transition-opacity">
          {t('export_include_aspects', {}, 'Aspects')}
        </span>
      </label>

      <label class="flex items-center gap-3 cursor-pointer group">
        <Checkbox
          checked={exportIncludeInfo}
          onchange={(event) => {
            exportIncludeInfo = (event.currentTarget as HTMLInputElement).checked;
          }}
          class="cursor-pointer"
        />
        <span class="text-sm opacity-85 group-hover:opacity-100 transition-opacity">
          {t('export_include_info', {}, 'Info')}
        </span>
      </label>
    </div>

    <div class="pt-4 border-t mt-6">
      <Button
        class="w-full sm:w-auto px-6 py-2"
        onclick={() => showOpenExportOverlay(true)}
      >
        {t('export', {}, 'Export')} {exportType === 'print' ? '' : `(${exportType.toUpperCase()})`}
      </Button>
    </div>
  </div>
</div>
