<script lang="ts">
  import { Badge } from '$lib/components/ui/badge/index.js';
  import Card from './ui/card/card.svelte';
  import CardContent from './ui/card/card-content.svelte';
  import CardHeader from './ui/card/card-header.svelte';
  import CardTitle from './ui/card/card-title.svelte';
  import { t } from '$lib/i18n/index.svelte';
  import type { Mode } from '$lib/state/layout';

  interface Props {
    mode: Mode;
  }

  let { mode }: Props = $props();
  const title = $derived(t(mode, {}, mode.charAt(0).toUpperCase() + mode.slice(1)));
</script>

<Card class="h-full w-full rounded-md">
  <CardHeader>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <CardTitle>{title}</CardTitle>
      <Badge variant="outline">{t('spec_gated', {}, 'Spec gated')}</Badge>
    </div>
  </CardHeader>
  <CardContent class="space-y-3">
    <p class="text-sm text-muted-foreground">
      {t(
        'mode_spec_gated_description',
        { mode: title },
        '{mode} is intentionally held behind a dedicated product/data-source spec. Implement this mode from a spec instead of expanding App.svelte.'
      )}
    </p>
    <div class="rounded-xl border border-dashed border-border/70 bg-muted/30 p-4 text-sm">
      {t(
        'mode_spec_gated_acceptance',
        {},
        'Acceptance: standard shell, feature component center content, shared primitives, explicit backend payload fields, and cross-frontend parity impact.'
      )}
    </div>
  </CardContent>
</Card>
