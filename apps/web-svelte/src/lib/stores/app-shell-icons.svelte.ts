export type AppShellIconSetId = 'default' | 'modern';

export interface AppShellIconSetOption {
  id: AppShellIconSetId;
  label: string;
  description: string;
}

export const APP_SHELL_ICON_SET_STORAGE_KEY = 'app_shell_icon_set';
/** Set by the reverted swap; remove and flip stored id back to pre-swap semantics. */
const APP_SHELL_ICON_SET_SWAP_MIGRATION_KEY = 'app_shell_icon_set_swap_v1';
const ASSET_BASE_URL = import.meta.env.BASE_URL;
function appShellAssetSet(setId: AppShellIconSetId): AppShellIconSetId {
  return setId;
}
export const APP_SHELL_FULL_LOGO_ASPECT_RATIO: Record<AppShellIconSetId, number> = {
  default: 247 / 77,
  modern: 220 / 60,
};
export const APP_SHELL_MARK_MASK_SCALE = 0.88;
type AppShellAssetId =
  | 'menu'
  | 'new'
  | 'open'
  | 'save'
  | 'export'
  | 'horoscope'
  | 'aspects'
  | 'information'
  | 'transits'
  | 'dynamics'
  | 'revolution'
  | 'synastry'
  | 'settings'
  | 'favorite'
  | 'theme-sunrise'
  | 'theme-noon'
  | 'theme-twilight'
  | 'theme-midnight';

export const APP_SHELL_ICON_MASK_SCALE: Record<AppShellIconSetId, Record<AppShellAssetId, number>> = {
  default: {
    menu: 0.8,
    new: 1.1,
    open: 0.86,
    save: 0.94,
    export: 0.94,
    horoscope: 1.08,
    aspects: 1.12,
    information: 1.1,
    transits: 1.05,
    dynamics: 0.9,
    revolution: 1.05,
    synastry: 0.86,
    settings: 1.1,
    favorite: 1.12,
    'theme-sunrise': 0.9,
    'theme-noon': 0.78,
    'theme-twilight': 0.9,
    'theme-midnight': 0.98,
  },
  modern: {
    menu: 0.94,
    new: 0.8,
    open: 0.8,
    save: 0.84,
    export: 0.84,
    horoscope: 0.84,
    aspects: 0.84,
    information: 0.8,
    transits: 0.8,
    dynamics: 0.84,
    revolution: 0.84,
    synastry: 0.8,
    settings: 0.82,
    favorite: 0.8,
    'theme-sunrise': 0.8,
    'theme-noon': 0.8,
    'theme-twilight': 0.8,
    'theme-midnight': 0.84,
  },
};

export const appShellIconSetOptions: AppShellIconSetOption[] = [
  {
    id: 'default',
    label: 'Default',
    description: 'Heritage React app-shell icon family.',
  },
  {
    id: 'modern',
    label: 'Modern',
    description: 'Current shared app-shell SVG family.',
  },
];

export const appShellIconSettings = $state<{ activeSet: AppShellIconSetId }>({
  activeSet: loadStoredAppShellIconSet(),
});

function isAppShellIconSetId(value: string): value is AppShellIconSetId {
  return value === 'default' || value === 'modern';
}

export function loadStoredAppShellIconSet(): AppShellIconSetId {
  try {
    if (localStorage.getItem(APP_SHELL_ICON_SET_SWAP_MIGRATION_KEY)) {
      const prev = localStorage.getItem(APP_SHELL_ICON_SET_STORAGE_KEY);
      if (prev === 'default') localStorage.setItem(APP_SHELL_ICON_SET_STORAGE_KEY, 'modern');
      else if (prev === 'modern') localStorage.setItem(APP_SHELL_ICON_SET_STORAGE_KEY, 'default');
      localStorage.removeItem(APP_SHELL_ICON_SET_SWAP_MIGRATION_KEY);
    }
    const value = localStorage.getItem(APP_SHELL_ICON_SET_STORAGE_KEY);
    if (value && isAppShellIconSetId(value)) {
      return value;
    }
  } catch {
    /* ignore */
  }
  return 'default';
}

export function setAppShellIconSet(next: AppShellIconSetId) {
  if (!isAppShellIconSetId(next)) return;
  if (appShellIconSettings.activeSet === next) return;
  appShellIconSettings.activeSet = next;
  try {
    localStorage.setItem(APP_SHELL_ICON_SET_STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
}

const assetFileNames: Record<AppShellAssetId, string> = {
  menu: 'menu.svg',
  new: 'new.svg',
  open: 'open.svg',
  save: 'save.svg',
  export: 'export.svg',
  horoscope: 'horoscope.svg',
  aspects: 'aspects.svg',
  information: 'information.svg',
  transits: 'transits.svg',
  dynamics: 'dynamics.svg',
  revolution: 'revolution.svg',
  synastry: 'synastry.svg',
  settings: 'settings.svg',
  favorite: 'favorite.svg',
  'theme-sunrise': 'theme-sunrise.svg',
  'theme-noon': 'theme-noon.svg',
  'theme-twilight': 'theme-twilight.svg',
  'theme-midnight': 'theme-midnight.svg',
};

function assetUrl(relativePath: string): string {
  const normalizedBase = ASSET_BASE_URL.endsWith('/') ? ASSET_BASE_URL : `${ASSET_BASE_URL}/`;
  const normalizedPath = relativePath.replace(/^\/+/, '');
  return `${normalizedBase}${normalizedPath}`;
}

export function resolveAppShellIconPath(assetId: AppShellAssetId, setId = appShellIconSettings.activeSet): string {
  return assetUrl(`app-shell/icons/${appShellAssetSet(setId)}/${assetFileNames[assetId]}`);
}

export function resolveAppShellIconMaskScale(assetId: AppShellAssetId, setId = appShellIconSettings.activeSet): number {
  return APP_SHELL_ICON_MASK_SCALE[appShellAssetSet(setId)][assetId];
}

export function resolveAppShellLogoFullPath(setId = appShellIconSettings.activeSet): string {
  return assetUrl(`app-shell/logo-full-${appShellAssetSet(setId)}.svg`);
}

export function resolveAppShellLogoMarkPath(setId = appShellIconSettings.activeSet): string {
  return assetUrl(`app-shell/logo-mark-${appShellAssetSet(setId)}.svg`);
}

export function resolveAppShellLogoFullWidth(height: number, setId = appShellIconSettings.activeSet): number {
  return Math.round(height * APP_SHELL_FULL_LOGO_ASPECT_RATIO[appShellAssetSet(setId)]);
}
