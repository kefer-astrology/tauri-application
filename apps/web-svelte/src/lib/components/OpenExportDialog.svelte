<script lang="ts">
  import { showOpenExportOverlay } from '$lib/state/layout';
  import { Button } from '$lib/components/ui/button/index.js';

  let { title = 'Open / Export' } = $props();

  function close() {
    showOpenExportOverlay(false);
  }
</script>

<!-- Backdrop -->
<Button
  type="button"
  variant="ghost"
  class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm focus:outline-none hover:bg-black/60"
  onclick={close}
  aria-label="Close overlay"
></Button>

<!-- Modal -->
<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
  <div class="w-full max-w-xl rounded-lg border bg-card text-card-foreground shadow-xl overflow-hidden">
    <div class="px-4 py-3 border-b bg-primary/80 text-primary-foreground flex items-center justify-between">
      <h3 class="font-semibold">{title}</h3>
      <Button variant="ghost" size="icon" class="h-8 w-8 hover:bg-white/20" onclick={close} aria-label="Close">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </Button>
    </div>
    <div class="p-4 space-y-3">
      <p class="text-sm opacity-80">This is a placeholder dialog. You can reuse this component for both Open and Export flows.</p>
      <div class="h-40 rounded border border-dashed bg-muted/40"></div>
    </div>
    <div class="px-4 py-3 border-t flex justify-end gap-2">
      <Button variant="ghost" onclick={close}>Cancel</Button>
      <Button onclick={close}>Close</Button>
    </div>
  </div>
</div>
