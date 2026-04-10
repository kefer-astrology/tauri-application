<script lang="ts">
  import { layout, type Tab, setMode, showOpenExportOverlay } from '$lib/state/layout';
  import { t } from '$lib/i18n/index.svelte';
  import { Button } from '$lib/components/ui/button/index.js';
  import * as Tooltip from '$lib/components/ui/tooltip/index.js';
  import SharedSvgIcon from '$lib/components/SharedSvgIcon.svelte';
  import { scale } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';

  type ActionId = 'new' | 'load' | 'save' | 'export' | 'radix' | 'aspects' | 'info' | 'transits' | 'dynamic' | 'revolution' | 'favorite' | 'settings' | 'about';

  type Action = {
    id: ActionId;
    onClick: () => void | Promise<void>;
    group: 'file' | 'view' | 'meta';
  };

  const sharedShellAssets = {
    logoFull: '/app-shell/logo-full.svg',
    new: '/app-shell/icons/new.svg',
    load: '/app-shell/icons/open.svg',
    save: '/app-shell/icons/save.svg',
    export: '/app-shell/icons/export.svg',
    radix: '/app-shell/icons/horoscope.svg',
    aspects: '/app-shell/icons/aspects.svg',
    info: '/app-shell/icons/information.svg',
    transits: '/app-shell/icons/transits.svg',
    dynamic: '/app-shell/icons/dynamics.svg',
    revolution: '/app-shell/icons/revolution.svg',
    favorite: '/app-shell/icons/favorite.svg',
    settings: '/app-shell/icons/settings.svg'
  } satisfies Record<'logoFull' | Exclude<ActionId, 'about'>, string>;

  function setTab(tab: Tab) {
    layout.selectedTab = tab;
  }

  function labelKeyFor(id: ActionId): string {
    switch (id) {
      case 'new': return 'new';
      case 'load': return 'load';
      case 'save': return 'save';
      case 'export': return 'share';
      case 'transits': return 'transits';
      case 'aspects': return 'aspects';
      case 'info': return 'info';
      case 'radix': return 'new_type_radix';
      case 'dynamic': return 'dynamic';
      case 'revolution': return 'revolution';
      case 'favorite': return 'favorite';
      case 'settings': return 'settings';
      case 'about': return 'settings_about';
      default: return id;
    }
  }

  const actions: Action[] = [
    { id: 'new', onClick: () => { setMode('new_radix'); }, group: 'file' },
    { id: 'load', onClick: () => { setMode('open'); }, group: 'file' },
    { id: 'save', onClick: () => { showOpenExportOverlay(true); }, group: 'file' },
    { id: 'export', onClick: () => { setMode('export'); }, group: 'file' },

    { id: 'radix', onClick: () => { setMode('radix_view'); setTab('Radix'); }, group: 'view' },
    { id: 'aspects', onClick: () => { setMode('radix_view'); setTab('Aspects'); }, group: 'view' },
    { id: 'info', onClick: () => { setMode('info'); }, group: 'view' },
    { id: 'transits', onClick: () => { setMode('radix_transits'); setTab('Transits'); }, group: 'view' },
    { id: 'dynamic', onClick: () => { setMode('dynamic'); }, group: 'view' },
    { id: 'revolution', onClick: () => { setMode('revolution'); }, group: 'view' },

    { id: 'favorite', onClick: () => { setMode('favorite'); }, group: 'meta' },
    { id: 'settings', onClick: () => { setMode('settings'); setTab('Settings'); }, group: 'meta' },
  ];

  function iconFor(id: ActionId) {
    return sharedShellAssets[id as Exclude<ActionId, 'about'>] ?? sharedShellAssets.radix;
  }

  function isActive(id: ActionId): boolean {
    const mode = layout.mode;
    switch (id) {
      case 'new': return mode === 'new_radix';
      case 'load': return mode === 'open';
      case 'radix': return mode === 'radix_view' && layout.selectedTab === 'Radix';
      case 'aspects': return mode === 'radix_view' && layout.selectedTab === 'Aspects';
      case 'transits': return mode === 'radix_transits';
      case 'info': return mode === 'info';
      case 'dynamic': return mode === 'dynamic';
      case 'revolution': return mode === 'revolution';
      case 'favorite': return mode === 'favorite';
      case 'settings': return mode === 'settings';
      case 'export': return mode === 'export';
      default: return false;
    }
  }
</script>

<!-- Top bar: 12-column grid layout -->
<div class="w-full h-full grid grid-cols-12 items-center px-2 gap-0 overflow-hidden">
  <!-- Logo: columns 1-3 -->
  <div class="col-span-3 h-full flex items-center justify-center py-3">
    <SharedSvgIcon src={sharedShellAssets.logoFull} class="block h-3/4 w-full text-white" size={148} title="Kefer" />
  </div>

  <!-- Space: column 4 -->
  <div class="col-span-1"></div>

  <!-- Icons: columns 5-12 (8 columns for 12 icons) -->
  <Tooltip.Provider>
    <div class="col-span-8 h-full flex items-center gap-0 overflow-hidden px-2">
      {#each actions as a}
        {#key a.id}
          <div class="relative flex flex-col items-center justify-center flex-1 min-w-0 py-3 px-2">
            <Tooltip.Root>
              <Tooltip.Trigger>
                {#snippet child({ props })}
                  <Button
                    {...props}
                    variant="ghost"
                    class="h-full w-full aspect-square m-0 !p-0 !px-0 !py-0 !bg-transparent hover:!bg-transparent text-white focus-visible:ring-2 focus-visible:ring-white/30"
                    aria-label={t(labelKeyFor(a.id))}
                    onclick={() => a.onClick()}
                  >
                    <SharedSvgIcon src={iconFor(a.id)} class="block !h-full !w-full text-white" size={28} title={t(labelKeyFor(a.id))} />
                  </Button>
                {/snippet}
              </Tooltip.Trigger>
              <Tooltip.Content>
                {t(labelKeyFor(a.id))}
              </Tooltip.Content>
            </Tooltip.Root>
            {#if isActive(a.id)}
              <div
                class="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-0.5 bg-white rounded-full origin-center"
                transition:scale={{ duration: 300, easing: quintOut, start: 0 }}
              ></div>
            {/if}
          </div>
        {/key}
      {/each}
    </div>
  </Tooltip.Provider>
</div>

<style>
  :global(header > div) { height: 100%; margin: 0; padding: 0; }
  :global(header button svg) {
    width: 100% !important;
    height: 100% !important;
  }
  :global(header) {
    overflow: hidden;
  }
</style>
