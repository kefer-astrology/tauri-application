<script lang="ts">
  import { t } from '$lib/i18n/index.svelte';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import { Label } from '$lib/components/ui/label/index.js';
  import * as Select from '$lib/components/ui/select/index.js';
  import { Separator } from '$lib/components/ui/separator/index.js';

  type RevolutionKind = 'solar' | 'lunar' | 'relative';
  type RevolutionScope = 'return' | 'quarters' | 'fraction';

  const revolutionKinds: RevolutionKind[] = ['solar', 'lunar', 'relative'];
  const revolutionScopes: RevolutionScope[] = ['return', 'quarters', 'fraction'];

  let kind = $state<RevolutionKind>('solar');
  let includeTransReturn = $state(false);
  let scope = $state<RevolutionScope>('return');
  let fraction = $state('10');
  let customPeriod = $state(false);
  let dateFrom = $state('');
  let dateTo = $state('');
  let submitted = $state(false);

  const selectedKindLabel = $derived(t(`revolution_kind_${kind}`, {}, kind));

  function submit(event: SubmitEvent) {
    event.preventDefault();
    submitted = true;
  }
</script>

<div class="h-full w-full overflow-y-auto rounded-md border bg-card text-card-foreground shadow-sm">
  <form class="mx-auto w-full max-w-[520px] px-4 py-10 sm:px-6" onsubmit={submit}>
    <section>
      <Label class="mb-3 block text-xs uppercase tracking-[0.08em] text-muted-foreground">
        {t('revolution_kind_label', {}, 'Revolution type')}
      </Label>
      <Select.Root type="single" bind:value={kind}>
        <Select.Trigger class="h-11 w-full rounded-full px-4">
          {selectedKindLabel}
        </Select.Trigger>
        <Select.Content>
          <Select.Group>
            {#each revolutionKinds as option}
              <Select.Item value={option} label={t(`revolution_kind_${option}`, {}, option)}>
                {t(`revolution_kind_${option}`, {}, option)}
              </Select.Item>
            {/each}
          </Select.Group>
        </Select.Content>
      </Select.Root>
    </section>

    <Separator class="my-6" />

    <section class="flex items-center justify-between gap-4">
      <Label for="svelte-trans-revolution">{t('revolution_trans_return', {}, 'Trans-revolution')}</Label>
      <button
        id="svelte-trans-revolution"
        type="button"
        role="switch"
        aria-checked={includeTransReturn}
        aria-label={t('revolution_trans_return', {}, 'Trans-revolution')}
        class="relative inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        class:bg-primary={includeTransReturn}
        class:bg-muted-foreground={!includeTransReturn}
        onclick={() => (includeTransReturn = !includeTransReturn)}
      >
        <span class="block size-4 rounded-full bg-background shadow transition-transform {includeTransReturn ? 'translate-x-[19px]' : 'translate-x-[3px]'}"></span>
      </button>
    </section>

    <Separator class="my-6" />

    <fieldset>
      <legend class="mb-4 text-xs uppercase tracking-[0.08em] text-muted-foreground">
        {t('revolution_scope_label', {}, 'Revolution')}
      </legend>
      <div class="space-y-4">
        {#each revolutionScopes as option}
          <label class="flex cursor-pointer items-center gap-3">
            <input class="size-4 accent-primary" type="radio" name="svelte-revolution-scope" value={option} bind:group={scope} />
            <span class:text-muted-foreground={scope !== option} class="text-sm">
              {t(`revolution_scope_${option}`, {}, option)}
            </span>
            {#if option === 'fraction'}
              <span class="ml-1 flex items-center gap-1.5 text-sm" class:pointer-events-none={scope !== 'fraction'} class:opacity-35={scope !== 'fraction'}>
                <span>1</span><span class="text-muted-foreground">/</span>
                <Input
                  aria-label={t('revolution_fraction_denominator', {}, 'Fraction denominator')}
                  inputmode="numeric"
                  value={fraction}
                  oninput={(event) => (fraction = event.currentTarget.value.replace(/\D/g, ''))}
                  disabled={scope !== 'fraction'}
                  class="h-8 w-12 px-1 text-center"
                />
              </span>
            {/if}
          </label>
        {/each}
      </div>
    </fieldset>

    <Separator class="my-6" />

    <section class="mb-9">
      <div class="flex items-center justify-between gap-4">
        <Label for="svelte-revolution-period">{t('revolution_set_period', {}, 'Set period')}</Label>
        <button
          id="svelte-revolution-period"
          type="button"
          role="switch"
          aria-checked={customPeriod}
          aria-label={t('revolution_set_period', {}, 'Set period')}
          class="relative inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          class:bg-primary={customPeriod}
          class:bg-muted-foreground={!customPeriod}
          onclick={() => (customPeriod = !customPeriod)}
        >
          <span class="block size-4 rounded-full bg-background shadow transition-transform {customPeriod ? 'translate-x-[19px]' : 'translate-x-[3px]'}"></span>
        </button>
      </div>

      <div class="grid overflow-hidden transition-all duration-200 sm:grid-cols-2 sm:gap-3" class:mt-4={customPeriod} class:max-h-32={customPeriod} class:gap-3={customPeriod} class:opacity-100={customPeriod} class:max-h-0={!customPeriod} class:opacity-0={!customPeriod} aria-hidden={!customPeriod}>
        <div>
          <Label for="svelte-revolution-from" class="mb-2 block text-xs uppercase text-muted-foreground">{t('revolution_date_from', {}, 'From')}</Label>
          <Input id="svelte-revolution-from" type="date" bind:value={dateFrom} tabindex={customPeriod ? 0 : -1} />
        </div>
        <div>
          <Label for="svelte-revolution-to" class="mb-2 block text-xs uppercase text-muted-foreground">{t('revolution_date_to', {}, 'To')}</Label>
          <Input id="svelte-revolution-to" type="date" bind:value={dateTo} tabindex={customPeriod ? 0 : -1} />
        </div>
      </div>
    </section>

    <Button type="submit" class="h-11 w-full rounded-xl">{t('revolution_calculate', {}, 'Calculate revolution')}</Button>
    {#if submitted}
      <p class="mt-3 text-center text-sm text-muted-foreground" role="status">
        {t('revolution_submitted', {}, 'Revolution calculation is ready')} · {selectedKindLabel}
      </p>
    {/if}
  </form>
</div>
