<script lang="ts">
  import { t } from '$lib/i18n/index.svelte';
  import type { ChartData } from '$lib/state/layout';
  import { Input } from '$lib/components/ui/input/index.js';
  import { Label } from '$lib/components/ui/label/index.js';
  import * as Select from '$lib/components/ui/select/index.js';

  type PersonMode = 'database' | 'manual';
  type PersonInput = {
    mode: PersonMode;
    chartId: string;
    date: string;
    time: string;
    location: string;
  };

  interface Props {
    person: PersonInput;
    charts: ChartData[];
    personId: string;
  }

  let { person = $bindable(), charts, personId }: Props = $props();
  const manual = $derived(person.mode === 'manual');
  const selectedChart = $derived(charts.find((chart) => chart.id === person.chartId));
</script>

<div class="space-y-4">
  <div>
    <Label class="mb-2 block text-xs uppercase tracking-[0.08em] text-muted-foreground">
      {t('synastry_chart', {}, 'Chart')}
    </Label>
    <Select.Root type="single" bind:value={person.chartId}>
      <Select.Trigger class="h-11 w-full px-4" disabled={manual || charts.length === 0} aria-label={t('synastry_chart', {}, 'Chart')}>
        {selectedChart?.name ?? (charts.length ? t('synastry_choose_chart', {}, 'Choose a saved chart') : t('synastry_no_charts', {}, 'No charts are open'))}
      </Select.Trigger>
      <Select.Content>
        <Select.Group>
          {#each charts as chart}
            <Select.Item value={chart.id} label={chart.name}>
              <span class="flex min-w-0 flex-col items-start">
                <span class="max-w-80 truncate">{chart.name}</span>
                <span class="max-w-80 truncate text-xs text-muted-foreground">{chart.dateTime} · {chart.location}</span>
              </span>
            </Select.Item>
          {/each}
        </Select.Group>
      </Select.Content>
    </Select.Root>
  </div>

  <div class="flex items-center gap-3">
    <span class="text-sm font-medium" class:text-primary={!manual} class:text-muted-foreground={manual}>
      {t('synastry_from_database', {}, 'From database')}
    </span>
    <button
      type="button"
      role="switch"
      aria-checked={manual}
      aria-label={t('synastry_manual_toggle', {}, 'Switch between database and manual entry')}
      class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      class:bg-primary={manual}
      class:bg-muted-foreground={!manual}
      onclick={() => (person = { ...person, mode: manual ? 'database' : 'manual' })}
    >
      <span class="block size-4 rounded-full bg-background shadow transition-transform {manual ? 'translate-x-[22px]' : 'translate-x-[2px]'}"></span>
    </button>
    <span class="text-sm font-medium" class:text-primary={manual} class:text-muted-foreground={!manual}>
      {t('synastry_manual', {}, 'Manual')}
    </span>
  </div>

  <div class="grid overflow-hidden transition-all duration-300 {manual ? 'max-h-80 gap-4 opacity-100' : 'max-h-0 opacity-0'}" aria-hidden={!manual}>
    <div class="grid gap-3 sm:grid-cols-2">
      <div>
        <Label for={`${personId}-date`} class="mb-2 block text-xs uppercase tracking-[0.08em] text-muted-foreground">
          {t('synastry_date', {}, 'Date')}
        </Label>
        <Input id={`${personId}-date`} type="date" bind:value={person.date} tabindex={manual ? 0 : -1} />
      </div>
      <div>
        <Label for={`${personId}-time`} class="mb-2 block text-xs uppercase tracking-[0.08em] text-muted-foreground">
          {t('synastry_time', {}, 'Time')}
        </Label>
        <Input id={`${personId}-time`} type="time" step="1" bind:value={person.time} tabindex={manual ? 0 : -1} />
      </div>
    </div>
    <div>
      <Label for={`${personId}-location`} class="mb-2 block text-xs uppercase tracking-[0.08em] text-muted-foreground">
        {t('synastry_location', {}, 'Location')}
      </Label>
      <Input
        id={`${personId}-location`}
        bind:value={person.location}
        placeholder={t('synastry_location_placeholder', {}, 'Enter birth city…')}
        tabindex={manual ? 0 : -1}
      />
    </div>
  </div>
</div>
