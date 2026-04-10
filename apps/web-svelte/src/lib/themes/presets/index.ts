import type { ThemePreset } from '$lib/state/theme.svelte';

import defaultPreset from './default.json';
import violetPreset from './violet.json';
import rosePreset from './rose.json';

export const presetsFromFiles: ThemePreset[] = [
  defaultPreset as ThemePreset,
  violetPreset as ThemePreset,
  rosePreset as ThemePreset,
];
