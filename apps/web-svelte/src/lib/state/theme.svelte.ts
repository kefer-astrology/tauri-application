// Global theming state using Svelte 5 runes ($state, $effect)
// This keeps us consistent with other app state like `layout.svelte.ts`.

export type Theme = 'light' | 'dark';

// Resolve initial theme from localStorage or prefers-color-scheme
function resolveInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {}
  const prefersDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
}

// Export object state; mutate its properties instead of reassigning the state variable
export const theme = $state<{ value: Theme }>({ value: resolveInitialTheme() });

export function applyTheme(next: Theme) {
  theme.value = next;
  const root = document.documentElement;
  if (next === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
  try { localStorage.setItem('theme', next); } catch {}
}

export function toggleTheme() {
  applyTheme(theme.value === 'dark' ? 'light' : 'dark');
}

// Apply immediately on module load
applyTheme(theme.value);

// Preset management
export type ThemePreset = {
  id: string;
  name: string;
  light: Record<string, string>;
  dark: Record<string, string>;
};

const PRESET_STORAGE_KEY = 'theme_preset';
const ELEMENT_COLORS_STORAGE_KEY = 'theme_element_colors';

export type ElementColorKey = 'element-fire' | 'element-earth' | 'element-air' | 'element-water';

const ELEMENT_COLOR_KEYS: ElementColorKey[] = ['element-fire', 'element-earth', 'element-air', 'element-water'];

const DEFAULT_ELEMENT_COLORS: Record<ElementColorKey, string> = {
  'element-fire': '#5a5a64',
  'element-earth': '#4a3f35',
  'element-air': '#1e3d38',
  'element-water': '#5c2a2a',
};

function loadElementColors(): Record<ElementColorKey, string> {
  try {
    const raw = localStorage.getItem(ELEMENT_COLORS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_ELEMENT_COLORS };
    const parsed = JSON.parse(raw) as Record<string, string>;
    const out = { ...DEFAULT_ELEMENT_COLORS };
    for (const k of ELEMENT_COLOR_KEYS) {
      if (typeof parsed[k] === 'string') out[k] = parsed[k];
    }
    return out;
  } catch {
    return { ...DEFAULT_ELEMENT_COLORS };
  }
}

function applyElementColors() {
  const root = document.documentElement;
  const colors = loadElementColors();
  for (const [k, v] of Object.entries(colors)) {
    root.style.setProperty(`--${k}`, v);
  }
}

export function setElementColor(key: ElementColorKey, value: string) {
  const colors = loadElementColors();
  colors[key] = value;
  document.documentElement.style.setProperty(`--${key}`, value);
  try {
    localStorage.setItem(ELEMENT_COLORS_STORAGE_KEY, JSON.stringify(colors));
  } catch {}
}

export function getElementColors(): Record<ElementColorKey, string> {
  return loadElementColors();
}

import { presetsFromFiles } from '$lib/themes/presets';
export const presets: ThemePreset[] = presetsFromFiles;

function applyVars(vars: Record<string, string>) {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(vars)) {
    root.style.setProperty(`--${k}`, v);
  }
}

function applyForCurrentMode(preset: ThemePreset) {
  const vars = theme.value === 'dark' ? preset.dark : preset.light;
  applyVars(vars);
}

function resolveInitialPresetId(): string {
  try {
    const stored = localStorage.getItem(PRESET_STORAGE_KEY);
    if (stored && presets.some((p) => p.id === stored)) return stored;
  } catch {}
  return presets[0].id;
}

// Export object state for preset; mutate its properties instead of reassigning
export const preset = $state<{ id: string }>({ id: resolveInitialPresetId() });

export function applyPreset(id: string) {
  const found = presets.find((p) => p.id === id) ?? presets[0];
  preset.id = found.id;
  applyForCurrentMode(found);
  applyElementColors(); // re-apply user element colors on top of preset
  try { localStorage.setItem(PRESET_STORAGE_KEY, found.id); } catch {}
}

// Re-apply helper when needed (call from components if you need to force update)
export function reapplyCurrentPreset() {
  const current = presets.find((p) => p.id === preset.id) ?? presets[0];
  applyForCurrentMode(current);
  applyElementColors();
}

// Apply stored element colors on load (after presets are loaded)
applyElementColors();
