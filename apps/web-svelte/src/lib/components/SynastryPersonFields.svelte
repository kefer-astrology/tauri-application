<script lang="ts">
  import { t } from '$lib/i18n/index.svelte';
  import type { ChartData } from '$lib/state/layout';
  import { Input } from '$lib/components/ui/input/index.js';
  import { Label } from '$lib/components/ui/label/index.js';
  import * as Select from '$lib/components/ui/select/index.js';
  import LocationSelector from '$lib/components/LocationSelector.svelte';
  import ModeSwitcher from '$lib/components/ModeSwitcher.svelte';
  import { isTauriRuntime } from '$lib/tauri/runtime';
  import { searchLocations } from '$lib/tauri/workspace';

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
  const locationOptions = $derived(charts.map((chart) => chart.location).filter(Boolean));
</script>

<div class="space-y-4">
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
    <div class="sm:col-span-2">
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

    <div>
      <Label class="mb-2 block text-xs uppercase tracking-[0.08em] text-muted-foreground">
        {t('synastry_input_mode', {}, 'Person source')}
      </Label>
      <ModeSwitcher
        value={person.mode}
        options={[
          { value: 'database', label: t('synastry_database', {}, 'Database') },
          { value: 'manual', label: t('synastry_manual', {}, 'Manual') }
        ]}
        ariaLabel={t('synastry_input_mode', {}, 'Person source')}
        class="h-11"
        onValueChange={(mode) => (person = { ...person, mode: mode as PersonMode })}
      />
    </div>
  </div>

  <div class="grid overflow-hidden transition-all duration-300 {manual ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}" aria-hidden={!manual}>
    <div class="space-y-3 rounded-xl bg-muted/40 p-4">
      <div class="grid gap-3 sm:grid-cols-2">
        <div>
          <Label for={`${personId}-date`} class="mb-1.5 block text-sm font-medium opacity-85">
            {t('synastry_date', {}, 'Date')}
          </Label>
          <Input
            id={`${personId}-date`}
            type="date"
            class="h-9 w-full rounded-md border bg-background px-3 text-foreground"
            bind:value={person.date}
            tabindex={manual ? 0 : -1}
          />
        </div>
        <div>
          <Label for={`${personId}-time`} class="mb-1.5 block text-sm font-medium opacity-85">
            {t('synastry_time', {}, 'Time')}
          </Label>
          <Input
            id={`${personId}-time`}
            type="time"
            step="1"
            class="h-9 w-full rounded-md border bg-background px-3 text-foreground"
            bind:value={person.time}
            tabindex={manual ? 0 : -1}
          />
        </div>
      </div>
      <div>
        <Label for={`${personId}-location`} class="mb-1.5 block text-sm font-medium opacity-85">
          {t('synastry_location', {}, 'Location')}
        </Label>
        <LocationSelector
          id={`${personId}-location`}
          bind:value={person.location}
          options={locationOptions}
          placeholder={t('synastry_location_placeholder', {}, 'Enter birth city…')}
          searchPlaceholder={t('new_location_search', {}, 'Search')}
          emptyLabel={t('synastry_location_placeholder', {}, 'Enter birth city…')}
          loadingLabel={t('new_resolving_location', {}, 'Resolving…')}
          searchLocations={isTauriRuntime() ? searchLocations : undefined}
          class="bg-background"
        />
      </div>
    </div>
  </div>
</div>
