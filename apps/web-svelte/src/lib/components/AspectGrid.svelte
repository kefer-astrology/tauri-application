<script lang="ts">
  import AspectMatrix from '$lib/components/chart-matrix/AspectMatrix.svelte';
  import type { AspectRowId } from '$lib/astrology/aspects';

  interface Props {
    size?: number;
    planetPositions?: Record<string, { degrees: number; sign: string; house?: number }>;
    aspects?: Array<{
      from: string;
      to: string;
      type: AspectRowId;
      orb: number;
      applying?: boolean;
    }>;
    aspectColors?: Record<string, string>;
  }
  
  let { 
    size = 800,
    planetPositions = {},
    aspects = [],
    aspectColors = {}
  }: Props = $props();
</script>

<AspectMatrix {size} {planetPositions} {aspects} {aspectColors} />
