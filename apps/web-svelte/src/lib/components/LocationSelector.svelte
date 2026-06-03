<script lang="ts">
  import Check from '@lucide/svelte/icons/check';
  import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down';
  import MapPin from '@lucide/svelte/icons/map-pin';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import { cn } from '$lib/utils';
  import type { ResolvedLocation } from '$lib/tauri/types';

  interface Props {
    id?: string;
    value?: string;
    onValueChange?: (value: string) => void | Promise<void>;
    options?: string[];
    placeholder: string;
    searchPlaceholder: string;
    emptyLabel: string;
    disabled?: boolean;
    class?: string;
    iconClass?: string;
    searchLocations?: (query: string) => Promise<ResolvedLocation[]>;
    onResolvedLocationSelect?: (location: ResolvedLocation) => void | Promise<void>;
    loadingLabel?: string;
  }

  let {
    id,
    value = $bindable(''),
    onValueChange,
    options = [],
    placeholder,
    searchPlaceholder,
    emptyLabel,
    disabled = false,
    class: className,
    iconClass,
    searchLocations,
    onResolvedLocationSelect,
    loadingLabel = 'Searching...'
  }: Props = $props();

  let open = $state(false);
  let query = $state(value);
  let searchResults = $state<ResolvedLocation[]>([]);
  let isSearching = $state(false);

  function normalize(input: string) {
    return input.trim().toLowerCase();
  }

  function setValue(next: string) {
    value = next;
    void onValueChange?.(next);
  }

  const normalizedQuery = $derived(normalize(query));
  const uniqueOptions = $derived.by(() => {
    const seen = new Set<string>();
    return options.filter((option) => {
      const key = normalize(option);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });
  const filteredOptions = $derived.by(() => {
    if (!normalizedQuery) return uniqueOptions;
    return uniqueOptions.filter((option) => normalize(option).includes(normalizedQuery));
  });
  const visibleSearchResults = $derived.by(() => {
    const localKeys = new Set(uniqueOptions.map((option) => normalize(option)));
    return searchResults.filter((result) => !localKeys.has(normalize(result.display_name)));
  });
  const showCustomOption = $derived(
    normalizedQuery.length > 0 &&
      !uniqueOptions.some((option) => normalize(option) === normalizedQuery) &&
      !visibleSearchResults.some((result) => normalize(result.display_name) === normalizedQuery)
  );
  const hasAnyResults = $derived(
    visibleSearchResults.length > 0 || filteredOptions.length > 0 || showCustomOption
  );

  $effect(() => {
    if (!open) {
      query = value;
    }
  });

  $effect(() => {
    if (!open || !searchLocations) {
      searchResults = [];
      isSearching = false;
      return;
    }

    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      searchResults = [];
      isSearching = false;
      return;
    }

    let active = true;
    isSearching = true;
    const timeoutId = window.setTimeout(async () => {
      try {
        const results = await searchLocations(trimmedQuery);
        if (active) searchResults = results;
      } catch {
        if (active) searchResults = [];
      } finally {
        if (active) isSearching = false;
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  });

  function selectCustom() {
    setValue(query.trim());
    open = false;
  }

  function selectOption(option: string) {
    setValue(option);
    open = false;
  }

  async function selectResolved(result: ResolvedLocation) {
    setValue(result.display_name);
    await onResolvedLocationSelect?.(result);
    open = false;
  }
</script>

<div class="relative">
  <Button
    {id}
    type="button"
    variant="outline"
    role="combobox"
    aria-expanded={open}
    {disabled}
    class={cn('h-10 w-full justify-between text-left font-normal shadow-inner', className)}
    onclick={() => {
      if (!disabled) open = !open;
    }}
  >
    <span class="flex min-w-0 items-center gap-2">
      <MapPin class={cn('h-4 w-4 shrink-0', iconClass)} />
      <span class="truncate">{value.trim() || placeholder}</span>
    </span>
    <ChevronsUpDown class="h-4 w-4 shrink-0 opacity-50" />
  </Button>

  {#if open}
    <div class="absolute left-0 top-[calc(100%+0.375rem)] z-50 w-[min(32rem,calc(100vw-2rem))] rounded-md border bg-popover p-2 text-popover-foreground shadow-md">
      <div class="space-y-2">
        <Input
          value={query}
          oninput={(event) => {
            query = (event.currentTarget as HTMLInputElement).value;
          }}
          placeholder={searchPlaceholder}
        />
        <div class="max-h-60 overflow-auto rounded-md border">
          <div class="space-y-1 p-1">
            {#each visibleSearchResults as result (`${result.display_name}-${result.latitude}-${result.longitude}`)}
              <button
                type="button"
                class={cn(
                  'flex h-auto w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground',
                  normalize(result.display_name) === normalize(value) && 'bg-accent text-accent-foreground'
                )}
                onclick={() => void selectResolved(result)}
              >
                <Check class={cn('mt-0.5 h-4 w-4 shrink-0', normalize(result.display_name) === normalize(value) ? 'opacity-100' : 'opacity-0')} />
                <span class="min-w-0 flex-1">{result.display_name}</span>
              </button>
            {/each}

            {#if showCustomOption}
              <button
                type="button"
                class={cn(
                  'flex h-auto w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground',
                  normalize(query) === normalize(value) && 'bg-accent text-accent-foreground'
                )}
                onclick={selectCustom}
              >
                <Check class={cn('mt-0.5 h-4 w-4 shrink-0', normalize(query) === normalize(value) ? 'opacity-100' : 'opacity-0')} />
                <span class="min-w-0 flex-1">{query.trim()}</span>
              </button>
            {/if}

            {#each filteredOptions as option (option)}
              <button
                type="button"
                class={cn(
                  'flex h-auto w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground',
                  normalize(option) === normalize(value) && 'bg-accent text-accent-foreground'
                )}
                onclick={() => selectOption(option)}
              >
                <Check class={cn('mt-0.5 h-4 w-4 shrink-0', normalize(option) === normalize(value) ? 'opacity-100' : 'opacity-0')} />
                <span class="min-w-0 flex-1">{option}</span>
              </button>
            {/each}

            {#if !hasAnyResults}
              <div class="py-6 text-center text-sm text-muted-foreground">
                {isSearching ? loadingLabel : emptyLabel}
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>
