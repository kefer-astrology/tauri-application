<script lang="ts">
  import ArrowLeftRight from '@lucide/svelte/icons/arrow-left-right';
  import { t } from '$lib/i18n/index.svelte';
  import { layout } from '$lib/state/layout';
  import SynastryPersonFields from '$lib/components/SynastryPersonFields.svelte';
  import * as Accordion from '$lib/components/ui/accordion/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import { Label } from '$lib/components/ui/label/index.js';
  import * as Select from '$lib/components/ui/select/index.js';
  import { Separator } from '$lib/components/ui/separator/index.js';

  type PersonInput = {
    mode: 'database' | 'manual';
    chartId: string;
    date: string;
    time: string;
    location: string;
  };

  type CalculationType =
    | 'synastry'
    | 'composite'
    | 'davison'
    | 'coalescent'
    | 'progressed-synastry'
    | 'progressed-composite'
    | 'draconic-synastry';

  const calculationTypes: CalculationType[] = [
    'synastry',
    'composite',
    'davison',
    'coalescent',
    'progressed-synastry',
    'progressed-composite',
    'draconic-synastry'
  ];

  function emptyPerson(chartId = ''): PersonInput {
    return { mode: 'database', chartId, date: '', time: '', location: '' };
  }

  function todayInputValue(): string {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  }

  function personReady(person: PersonInput): boolean {
    return person.mode === 'database'
      ? Boolean(person.chartId)
      : Boolean(person.date && person.time && person.location.trim());
  }

  let name = $state('');
  let personA = $state<PersonInput>(emptyPerson(layout.selectedContext));
  let personB = $state<PersonInput>(emptyPerson(layout.contexts.find((chart) => chart.id !== layout.selectedContext)?.id));
  let calculationType = $state<CalculationType>('synastry');
  let progressionDate = $state(todayInputValue());
  let openSections = $state<string[]>(['person-a', 'person-b']);
  let submitted = $state(false);

  const ready = $derived(personReady(personA) && personReady(personB));
  const progressed = $derived(calculationType === 'progressed-synastry' || calculationType === 'progressed-composite');
  const selectedCalculationLabel = $derived(t(`synastry_type_${calculationType}`, {}, calculationType));

  function swapPeople() {
    const previousA = personA;
    personA = personB;
    personB = previousA;
    submitted = false;
  }

  function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!ready) return;
    submitted = true;
  }
</script>

<div class="h-full w-full overflow-y-auto rounded-md border bg-card text-card-foreground shadow-sm">
  <form class="mx-auto w-full max-w-[920px] px-4 py-8 pb-16 sm:px-6" onsubmit={submit}>
    <div class="mb-7">
      <Label for="svelte-synastry-name" class="mb-2 block text-xs uppercase tracking-[0.08em] text-muted-foreground">
        {t('synastry_name', {}, 'Calculation name')}
      </Label>
      <Input id="svelte-synastry-name" bind:value={name} placeholder={t('synastry_name_placeholder', {}, 'e.g. Martin & Petra')} />
    </div>

    <Accordion.Root type="multiple" bind:value={openSections}>
      <Accordion.Item value="person-a">
        <Accordion.Trigger class="text-base hover:no-underline">
          {t('synastry_person_a', {}, 'Person A')}
        </Accordion.Trigger>
        <Accordion.Content class="pb-5">
          <SynastryPersonFields bind:person={personA} charts={layout.contexts} personId="svelte-person-a" />
        </Accordion.Content>
      </Accordion.Item>
      <div class="flex justify-center py-3">
        <Button type="button" variant="ghost" size="sm" class="text-muted-foreground" onclick={swapPeople}>
          <ArrowLeftRight class="size-4" />
          {t('synastry_swap', {}, 'Swap persons A/B')}
        </Button>
      </div>
      <Accordion.Item value="person-b">
        <Accordion.Trigger class="text-base hover:no-underline">
          {t('synastry_person_b', {}, 'Person B')}
        </Accordion.Trigger>
        <Accordion.Content class="pb-5">
          <SynastryPersonFields bind:person={personB} charts={layout.contexts} personId="svelte-person-b" />
        </Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>

    <section class="py-5">
      <Label class="mb-2 block text-sm font-semibold text-primary">{t('synastry_type_label', {}, 'Chart type')}</Label>
      <Select.Root type="single" bind:value={calculationType}>
        <Select.Trigger class="h-12 w-full rounded-full px-5">{selectedCalculationLabel}</Select.Trigger>
        <Select.Content class="max-h-[420px]">
          <Select.Group>
            {#each calculationTypes as calculation}
              <Select.Item value={calculation} label={t(`synastry_type_${calculation}`, {}, calculation)} class="py-2.5">
                <span class="flex flex-col items-start">
                  <span class="font-medium">{t(`synastry_type_${calculation}`, {}, calculation)}</span>
                  <span class="text-xs font-normal text-muted-foreground">
                    {t(`synastry_type_${calculation}_description`, {}, '')}
                  </span>
                </span>
              </Select.Item>
            {/each}
          </Select.Group>
        </Select.Content>
      </Select.Root>
    </section>

    <div class="overflow-hidden transition-all duration-300 {progressed ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}" aria-hidden={!progressed}>
      <Separator />
      <div class="py-5">
        <Label for="svelte-progression-date" class="mb-2 block text-sm font-semibold text-primary">
          {t('synastry_progression_date', {}, 'Progression date')}
        </Label>
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input id="svelte-progression-date" type="date" bind:value={progressionDate} class="sm:max-w-xs" tabindex={progressed ? 0 : -1} />
          <Button type="button" variant="ghost" class="justify-start text-primary" onclick={() => (progressionDate = todayInputValue())}>
            {t('synastry_today', {}, 'Today')}
          </Button>
        </div>
      </div>
    </div>

    <Button type="submit" disabled={!ready} class="mt-6 h-12 w-full rounded-full text-base">
      {t('synastry_create', {}, 'Create chart')}
    </Button>
    {#if submitted}
      <p class="mt-3 text-center text-sm text-muted-foreground" role="status">
        {t('synastry_submitted', {}, 'Relationship chart is ready')} · {selectedCalculationLabel}
      </p>
    {/if}
  </form>
</div>
