const ASSET_BASE_URL = import.meta.env.BASE_URL;

export type AppShellIconSetId = 'default' | 'modern';
export type AppShellIconId =
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

export const APP_SHELL_ICON_SET_KEY = 'app_shell_icon_set';
/** Set by the reverted swap; remove and flip stored id back to pre-swap semantics. */
const APP_SHELL_ICON_SET_SWAP_MIGRATION_KEY = 'app_shell_icon_set_swap_v1';

export const APP_SHELL_ICON_SET_OPTIONS = [
	{
		id: 'default' as const,
		label: 'Default',
		description: 'Heritage React app-shell icon family.'
	},
	{
		id: 'modern' as const,
		label: 'Modern',
		description: 'Current shared app-shell SVG family.'
	}
];

const APP_SHELL_FULL_LOGO_ASPECT_RATIO: Record<AppShellIconSetId, number> = {
	default: 247 / 77,
	modern: 220 / 60
};

export const APP_SHELL_MARK_MASK_SCALE = 0.88;

/**
 * Uniform mask for **default** set (`icons/default/`). Higher = ink fills more of the same px box.
 * Paired with `APP_SHELL_MODERN_NAV_ICON_MASK_SCALE` so both families read similar in the sidebar.
 */
export const APP_SHELL_DEFAULT_NAV_ICON_MASK_SCALE = 0.86;

/**
 * Uniform mask for **modern** set (`icons/modern/`). Keep below default — stroke icons read larger at the same %.
 */
export const APP_SHELL_MODERN_NAV_ICON_MASK_SCALE = 0.64;

const iconFileNames: Record<AppShellIconId, string> = {
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
	'theme-midnight': 'theme-midnight.svg'
};

function uniformDefaultMaskScales(): Record<AppShellIconId, number> {
	const s = APP_SHELL_DEFAULT_NAV_ICON_MASK_SCALE;
	return Object.fromEntries(
		(Object.keys(iconFileNames) as AppShellIconId[]).map((id) => [id, s])
	) as Record<AppShellIconId, number>;
}

function uniformModernMaskScales(): Record<AppShellIconId, number> {
	const s = APP_SHELL_MODERN_NAV_ICON_MASK_SCALE;
	return Object.fromEntries(
		(Object.keys(iconFileNames) as AppShellIconId[]).map((id) => [id, s])
	) as Record<AppShellIconId, number>;
}

const APP_SHELL_ICON_MASK_SCALE: Record<AppShellIconSetId, Record<AppShellIconId, number>> = {
	default: uniformDefaultMaskScales(),
	modern: uniformModernMaskScales()
};

function assetUrl(relativePath: string): string {
	const normalizedBase = ASSET_BASE_URL.endsWith('/') ? ASSET_BASE_URL : `${ASSET_BASE_URL}/`;
	const normalizedPath = relativePath.replace(/^\/+/, '');
	return `${normalizedBase}${normalizedPath}`;
}

/** Resolve folder / logo suffix: UI “Default” → `default`, “Modern” → `modern`. */
function appShellAssetSet(iconSet: AppShellIconSetId): AppShellIconSetId {
	return iconSet;
}

export function getAppShellIconSrc(iconSet: AppShellIconSetId, iconId: AppShellIconId): string {
	return assetUrl(`app-shell/icons/${appShellAssetSet(iconSet)}/${iconFileNames[iconId]}`);
}

export function getAppShellLogoSrc(
	iconSet: AppShellIconSetId,
	variant: 'full' | 'mark'
): string {
	return assetUrl(`app-shell/logo-${variant}-${appShellAssetSet(iconSet)}.svg`);
}

export function getAppShellIconMaskScale(
	iconSet: AppShellIconSetId,
	iconId: AppShellIconId
): number {
	return APP_SHELL_ICON_MASK_SCALE[appShellAssetSet(iconSet)][iconId];
}

export function getAppShellLogoFullWidth(iconSet: AppShellIconSetId, height: number): number {
	return Math.round(height * APP_SHELL_FULL_LOGO_ASPECT_RATIO[appShellAssetSet(iconSet)]);
}

export function readStoredAppShellIconSet(): AppShellIconSetId {
	try {
		if (localStorage.getItem(APP_SHELL_ICON_SET_SWAP_MIGRATION_KEY)) {
			const prev = localStorage.getItem(APP_SHELL_ICON_SET_KEY);
			if (prev === 'default') localStorage.setItem(APP_SHELL_ICON_SET_KEY, 'modern');
			else if (prev === 'modern') localStorage.setItem(APP_SHELL_ICON_SET_KEY, 'default');
			localStorage.removeItem(APP_SHELL_ICON_SET_SWAP_MIGRATION_KEY);
		}
		const value = localStorage.getItem(APP_SHELL_ICON_SET_KEY);
		if (value === 'default' || value === 'modern') {
			return value;
		}
	} catch {
		/* ignore */
	}
	return 'default';
}
