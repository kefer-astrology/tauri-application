<!-- Time Navigation Panel Component -->
<script lang="ts">
  import { 
    timeNavigation, 
    effectiveTime,
    stepForward, 
    stepBackward,
    applyShift,
    resetShift,
    type TimeStep
  } from '$lib/stores/timeNavigation.svelte';
  import { t } from '$lib/i18n/index.svelte';
  import * as Select from '$lib/components/ui/select/index.js';
  import * as Popover from '$lib/components/ui/popover/index.js';
  import { Calendar } from '$lib/components/ui/calendar/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import { CalendarDate, getLocalTimeZone, type DateValue } from '@internationalized/date';
  import { formatTime } from '$lib/stores/timeNavigation.svelte';

  // Step amount options (1-30)
  const stepAmountOptions = Array.from({ length: 30 }, (_, i) => i + 1);
  
  // Step unit options (granularity)
  const stepUnitOptions: Array<{ value: TimeStep['unit']; label: string }> = [
    { value: 'seconds', label: t('time_nav_seconds', {}, 'Seconds') },
    { value: 'minutes', label: t('time_nav_minutes', {}, 'Minutes') },
    { value: 'hours', label: t('time_nav_hours', {}, 'Hours') },
    { value: 'days', label: t('time_nav_days', {}, 'Days') }
  ];

  // Current step state - use derived to access reactive values
  const nav = $derived(timeNavigation);
  let stepAmount = $state(String(timeNavigation.step.value));
  let stepUnit = $state(timeNavigation.step.unit);
  
  // Sync stepAmount and stepUnit when timeNavigation.step changes
  $effect(() => {
    stepAmount = String(timeNavigation.step.value);
    stepUnit = timeNavigation.step.unit;
  });

  // Update navigation step when selectors change
  $effect(() => {
    const amount = parseInt(stepAmount) || 1;
    timeNavigation.step = { unit: stepUnit, value: amount };
  });

  // Date picker state
  const effective = $derived(effectiveTime());
  const currentDate = $derived(() => {
    const d = effectiveTime();
    return new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate()) as DateValue;
  });

  let selectedDate = $state<DateValue | undefined>(undefined);
  let datePopoverOpen = $state(false);
  const effectiveTimeValue = $derived(effectiveTime().getTime());
  let lastEffectiveTime = $state(0);
  let lastAppliedSelectedDate = $state('');
  
  // Initialize selectedDate and lastEffectiveTime
  $effect(() => {
    const currentTime = effectiveTimeValue;
    if (!selectedDate) {
      selectedDate = currentDate();
    }
    if (lastEffectiveTime === 0) {
      lastEffectiveTime = currentTime;
    }
  });

  // Sync selectedDate with currentDate when effective time changes externally (not from our updates)
  $effect(() => {
    const currentTime = effective.getTime();
    // Only update if the time changed externally (not from our own updates)
    if (currentTime !== lastEffectiveTime && !datePopoverOpen) {
      selectedDate = currentDate();
      lastEffectiveTime = currentTime;
    }
  });

  // Update date when selected and popover closes
  function handleDateChange(newDate: DateValue | undefined) {
    if (newDate) {
      const d = effective;
      const updatedDate = new Date(
        newDate.year,
        newDate.month - 1,
        newDate.day,
        d.getHours(),
        d.getMinutes(),
        d.getSeconds()
      );
      lastEffectiveTime = updatedDate.getTime();
      timeNavigation.currentTime = updatedDate;
    }
  }

  // Apply date selection only after user picks in open popover.
  $effect(() => {
    if (!datePopoverOpen || !selectedDate) return;
    const marker = String(selectedDate);
    if (marker === lastAppliedSelectedDate) return;
    lastAppliedSelectedDate = marker;
    handleDateChange(selectedDate);
    datePopoverOpen = false;
  });

  // Time input state
  let timeValue = $state('');
  let isTimeInputFocused = $state(false);
  let lastTimeValue = $state('');
  
  // Initialize and sync time value (only when not focused to avoid interrupting user input)
  $effect(() => {
    if (!isTimeInputFocused) {
      const d = effective;
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const seconds = String(d.getSeconds()).padStart(2, '0');
      const newTimeValue = `${hours}:${minutes}:${seconds}`;
      if (newTimeValue !== lastTimeValue) {
        timeValue = newTimeValue;
        lastTimeValue = newTimeValue;
      }
    }
  });

  function updateTime(e: Event) {
    const input = e.target as HTMLInputElement;
    const parts = input.value.split(':');
    const hours = parseInt(parts[0]) || 0;
    const minutes = parseInt(parts[1]) || 0;
    const seconds = parseInt(parts[2]) || 0;
    const d = effective;
    const newDate = new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
      hours,
      minutes,
      seconds
    );
    lastEffectiveTime = newDate.getTime();
    timeNavigation.currentTime = newDate;
  }

  // Location state
  let locationValue = $state('');

  // Sync shift values with timeNavigation
  $effect(() => {
    // Ensure shift values are numbers
    if (typeof timeNavigation.shift.years !== 'number') timeNavigation.shift.years = 0;
    if (typeof timeNavigation.shift.months !== 'number') timeNavigation.shift.months = 0;
    if (typeof timeNavigation.shift.days !== 'number') timeNavigation.shift.days = 0;
    if (typeof timeNavigation.shift.hours !== 'number') timeNavigation.shift.hours = 0;
    if (typeof timeNavigation.shift.minutes !== 'number') timeNavigation.shift.minutes = 0;
    if (typeof timeNavigation.shift.seconds !== 'number') timeNavigation.shift.seconds = 0;
  });

  // Update button handler
  function handleUpdate() {
    // This will trigger any updates needed when the update button is clicked
    // The actual update logic will be handled by the timeNavigation store
    console.log('Update clicked', { date: selectedDate, time: timeValue, location: locationValue });
  }

  // Format date for display
  function formatDate(date: DateValue): string {
    const d = date.toDate(getLocalTimeZone());
    return d.toLocaleDateString('cs-CZ', { 
      day: '2-digit', 
      month: 'long', 
      year: 'numeric',
      weekday: 'long'
    });
  }
</script>

<div class="space-y-2 text-xs">
  <!-- Row 1: Step controls (arrows + amount + unit) -->
  <div class="flex items-center gap-1.5">
    <Button type="button" variant="outline" size="sm" class="h-7 w-7 p-0 flex-shrink-0" onclick={stepBackward} title={t('time_nav_previous', {}, 'Previous')}>⏪</Button>
    <Select.Root type="single" bind:value={stepAmount}>
      <Select.Trigger class="h-7 px-2 min-w-[2rem] text-xs">{#snippet children()}{stepAmount || '1'}{/snippet}</Select.Trigger>
      <Select.Content>
        <Select.Group>
          {#each stepAmountOptions as amount}
            <Select.Item value={String(amount)} label={String(amount)}>{amount}</Select.Item>
          {/each}
        </Select.Group>
      </Select.Content>
    </Select.Root>
    <Select.Root type="single" bind:value={stepUnit}>
      <Select.Trigger class="h-7 px-2 min-w-[4rem] text-xs">
        {#snippet children()}{stepUnitOptions.find(u => u.value === stepUnit)?.label || t('time_nav_hours', {}, 'Hours')}{/snippet}
      </Select.Trigger>
      <Select.Content>
        <Select.Group>
          {#each stepUnitOptions as unit}
            <Select.Item value={unit.value} label={unit.label}>{unit.label}</Select.Item>
          {/each}
        </Select.Group>
      </Select.Content>
    </Select.Root>
    <Button type="button" variant="outline" size="sm" class="h-7 w-7 p-0 flex-shrink-0" onclick={stepForward} title={t('time_nav_next', {}, 'Next')}>⏩</Button>
  </div>

  <!-- Row 2: Date + Time on one row -->
  <div class="flex items-center gap-1.5">
    <Popover.Root bind:open={datePopoverOpen}>
      <Popover.Trigger>
        <Button variant="outline" class="h-7 flex-1 min-w-0 px-2 text-[11px] justify-start font-normal truncate">
          {selectedDate ? formatDate(selectedDate) : formatDate(currentDate())}
        </Button>
      </Popover.Trigger>
      <Popover.Content class="w-auto p-0" align="start">
        <Calendar type="single" bind:value={selectedDate} locale="cs-CZ" />
      </Popover.Content>
    </Popover.Root>
    <Input
      type="text"
      class="h-7 w-20 px-1.5 text-[11px] font-mono flex-shrink-0"
      bind:value={timeValue}
      onfocus={() => isTimeInputFocused = true}
      onblur={() => { isTimeInputFocused = false; updateTime(new Event('change')); }}
      onchange={updateTime}
      placeholder={t('time_placeholder', {}, 'HH:MM:SS')}
    />
  </div>

  <!-- Row 3: Location + Update -->
  <div class="flex items-center gap-1.5">
    <Input type="text" class="h-7 flex-1 min-w-0 px-2 text-[11px]" bind:value={locationValue} placeholder={t('new_location', {}, 'Location')} />
    <Button type="button" class="h-7 px-2 text-[11px] flex-shrink-0" onclick={handleUpdate}>{t('time_nav_update', {}, 'Update')}</Button>
  </div>

  <!-- Time Shift: one row Y M D h m s + buttons -->
  <div class="pt-1.5 border-t border-border/40 space-y-1.5">
    <div class="text-[10px] font-medium opacity-75">{t('time_nav_shift', {}, 'Time Shift')}</div>
    <div class="grid grid-cols-6 gap-1">
      <Input id="shift-years" type="number" class="h-6 px-1 text-[10px]" value={String(timeNavigation.shift.years || 0)} onchange={(e) => timeNavigation.shift.years = parseInt((e.target as HTMLInputElement).value) || 0} placeholder="Y" title={t('time_nav_years', {}, 'Years')} />
      <Input id="shift-months" type="number" class="h-6 px-1 text-[10px]" value={String(timeNavigation.shift.months || 0)} onchange={(e) => timeNavigation.shift.months = parseInt((e.target as HTMLInputElement).value) || 0} placeholder="M" title={t('time_nav_months', {}, 'Months')} />
      <Input id="shift-days" type="number" class="h-6 px-1 text-[10px]" value={String(timeNavigation.shift.days || 0)} onchange={(e) => timeNavigation.shift.days = parseInt((e.target as HTMLInputElement).value) || 0} placeholder="D" title={t('time_nav_days', {}, 'Days')} />
      <Input id="shift-hours" type="number" class="h-6 px-1 text-[10px]" value={String(timeNavigation.shift.hours || 0)} onchange={(e) => timeNavigation.shift.hours = parseInt((e.target as HTMLInputElement).value) || 0} placeholder="h" title={t('time_nav_hours', {}, 'Hours')} />
      <Input id="shift-minutes" type="number" class="h-6 px-1 text-[10px]" value={String(timeNavigation.shift.minutes || 0)} onchange={(e) => timeNavigation.shift.minutes = parseInt((e.target as HTMLInputElement).value) || 0} placeholder="m" title={t('time_nav_minutes', {}, 'Minutes')} />
      <Input id="shift-seconds" type="number" class="h-6 px-1 text-[10px]" value={String(timeNavigation.shift.seconds || 0)} onchange={(e) => timeNavigation.shift.seconds = parseInt((e.target as HTMLInputElement).value) || 0} placeholder="s" title={t('time_nav_seconds', {}, 'Seconds')} />
    </div>
    <div class="flex gap-1.5">
      <Button type="button" variant={timeNavigation.shiftActive ? "default" : "outline"} class="h-6 flex-1 px-2 text-[10px]" onclick={applyShift}>{t('time_nav_apply_shift', {}, 'Apply')}</Button>
      <Button type="button" variant="outline" class="h-6 px-2 text-[10px] flex-shrink-0" onclick={resetShift} disabled={!timeNavigation.shiftActive}>{t('time_nav_reset', {}, 'Reset')}</Button>
    </div>
  </div>
</div>
