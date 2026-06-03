<script lang="ts">
  import { Badge } from '$lib/components/ui/badge/index.js';
  import Card from './ui/card/card.svelte';
  import CardContent from './ui/card/card-content.svelte';
  import CardHeader from './ui/card/card-header.svelte';
  import CardTitle from './ui/card/card-title.svelte';
  import { Separator } from '$lib/components/ui/separator/index.js';
  import { t } from '$lib/i18n/index.svelte';
  import { getSelectedChart, layout } from '$lib/state/layout';

  interface Props {
    section?: string;
  }

  let { section = 'positive_dominances' }: Props = $props();

  const selectedChart = $derived(getSelectedChart());
  const computed = $derived(selectedChart?.computed);
  const positionsCount = $derived(Object.keys(computed?.positions ?? {}).filter((key) => !/^house_\d+$/i.test(key)).length);
  const aspectsCount = $derived((computed?.aspects ?? []).length);
  const housesCount = $derived((computed?.houseCusps ?? []).length);
  const selectedLabel = $derived(t(`info_${section}`, {}, section?.replace(/_/g, ' ') ?? 'Info'));

  const cards = $derived([
    {
      id: 'objects',
      title: t('section_observable_objects', {}, 'Observable objects'),
      value: String(positionsCount),
      description: t('info_positions_summary', {}, 'Computed objects available for interpretation.')
    },
    {
      id: 'aspects',
      title: t('aspects', {}, 'Aspects'),
      value: String(aspectsCount),
      description: t('info_aspects_summary', {}, 'Computed aspects available for dominance and pattern analysis.')
    },
    {
      id: 'houses',
      title: t('houses', {}, 'Houses'),
      value: String(housesCount),
      description: t('info_houses_summary', {}, 'House cusps available from the current computation.')
    }
  ]);
</script>

<Card class="h-full w-full rounded-md">
  <CardHeader>
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <CardTitle>{t('info', {}, 'Info')}</CardTitle>
        <p class="mt-1 text-sm text-muted-foreground">{selectedLabel}</p>
      </div>
      <Badge variant="outline">
        {selectedChart?.name ?? t('no_chart_selected', {}, 'No chart selected')}
      </Badge>
    </div>
  </CardHeader>
  <CardContent class="space-y-4 overflow-y-auto">
    <div class="grid gap-3 md:grid-cols-3">
      {#each cards as item}
        <Card class="rounded-xl">
          <CardContent class="space-y-2 p-4">
            <div class="text-xs uppercase tracking-wide text-muted-foreground">{item.title}</div>
            <div class="text-2xl font-semibold">{item.value}</div>
            <p class="text-xs text-muted-foreground">{item.description}</p>
          </CardContent>
        </Card>
      {/each}
    </div>

    <Separator />

    <div class="rounded-xl border border-border/60 bg-muted/30 p-4">
      <h3 class="text-sm font-semibold">{t('info_mode_contract', {}, 'Mode contract')}</h3>
      <p class="mt-2 text-sm text-muted-foreground">
        {t(
          'info_mode_contract_body',
          {},
          'This view uses the standard shell, selected chart, computed positions, aspects, and house cusps. Further interpretation sections should be added from specs rather than inline placeholders.'
        )}
      </p>
      <div class="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
        <div>{t('house_system', {}, 'House System')}: {layout.workspaceDefaults.houseSystem}</div>
        <div>{t('zodiac_type', {}, 'Zodiac Type')}: {layout.workspaceDefaults.zodiacType}</div>
        <div>{t('engine', {}, 'Engine')}: {layout.workspaceDefaults.engine ?? '—'}</div>
        <div>{t('location', {}, 'Location')}: {layout.workspaceDefaults.locationName}</div>
      </div>
    </div>
  </CardContent>
</Card>
