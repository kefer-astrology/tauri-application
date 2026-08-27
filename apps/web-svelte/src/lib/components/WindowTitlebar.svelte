<script lang="ts">
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import Maximize2 from '@lucide/svelte/icons/maximize-2';
  import Minus from '@lucide/svelte/icons/minus';
  import X from '@lucide/svelte/icons/x';
  import { isTauriRuntime } from '$lib/tauri/runtime';

  const isTauri = isTauriRuntime();
  const appWindow = isTauri ? getCurrentWindow() : null;

  const windowButtonClass =
    'flex h-8 w-11 items-center justify-center text-foreground opacity-70 transition-colors hover:bg-white/10 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/40';
</script>

{#if isTauri}
  <header
    data-tauri-drag-region
    class="relative z-50 flex h-8 shrink-0 select-none items-center border-b border-white/5"
  >
    <div data-tauri-drag-region class="flex h-full min-w-0 flex-1 items-center px-3">
      <span data-tauri-drag-region class="truncate text-xs font-medium opacity-65">Kefer</span>
    </div>
    <nav class="flex h-full shrink-0" aria-label="Window controls">
      <button
        type="button"
        class={windowButtonClass}
        onclick={() => void appWindow?.minimize()}
        aria-label="Minimize window"
      >
        <Minus aria-hidden="true" size={15} strokeWidth={1.75} />
      </button>
      <button
        type="button"
        class={windowButtonClass}
        onclick={() => void appWindow?.toggleMaximize()}
        aria-label="Maximize or restore window"
      >
        <Maximize2 aria-hidden="true" size={13} strokeWidth={1.75} />
      </button>
      <button
        type="button"
        class={`${windowButtonClass} hover:bg-red-500 hover:text-white`}
        onclick={() => void appWindow?.close()}
        aria-label="Close window"
      >
        <X aria-hidden="true" size={16} strokeWidth={1.75} />
      </button>
    </nav>
  </header>
{/if}
