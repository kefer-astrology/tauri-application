import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useLayoutEffect,
	useMemo,
	useState,
	type CSSProperties,
	type ReactNode
} from 'react';
import type { Theme } from '@/lib/theme';
import {
	persistAppShellIconSet,
	readStoredAppShellIconSet,
	type AppShellIconSetId
} from '@/lib/app-shell';
import {
	persistElementColors,
	readStoredElementColors,
	type ElementColors
} from '@/lib/astrology/elementColors';
import {
	persistGlyphSet,
	readStoredGlyphSet,
	type AstrologyGlyphSetId
} from '@/lib/astrology/glyphs';
import {
	persistEnabledSymbolSetIds,
	readStoredEnabledSymbolSetIds
} from '@/lib/astrology/symbolSystems';
import {
	persistWheelOrientation,
	persistWheelStyle,
	readStoredWheelOrientation,
	readStoredWheelStyle,
	type WheelOrientationId,
	type WheelStyleId
} from '@/lib/astrology/wheelStyle';
import { persistMonochrome, readStoredMonochrome } from '@/lib/appLayoutPreferences';
import {
	persistThemePalettes,
	readStoredThemePalettes,
	themePaletteVars,
	type ThemePalette
} from '@/lib/themePalettes';
import { AppThemeProvider } from './app-theme';

/** Device-level presentation preferences: theme and palette, glyphs, wheel look, monochrome. */
export interface AppearanceValue {
	theme: Theme;
	setTheme: (theme: Theme) => void;
	/** Palette of the active theme. */
	themePalette: ThemePalette;
	/** Replace (and persist) the active theme's palette. */
	commitThemePalette: (palette: ThemePalette) => void;
	appShellIconSet: AppShellIconSetId;
	setAppShellIconSet: (value: AppShellIconSetId) => void;
	glyphSet: AstrologyGlyphSetId;
	setGlyphSet: (value: AstrologyGlyphSetId) => void;
	enabledSymbolSetIds: string[];
	setEnabledSymbolSetIds: (value: string[]) => void;
	wheelStyle: WheelStyleId;
	setWheelStyle: (value: WheelStyleId) => void;
	wheelOrientation: WheelOrientationId;
	setWheelOrientation: (value: WheelOrientationId) => void;
	elementColors: ElementColors;
	commitElementColors: (value: ElementColors) => void;
	monochrome: boolean;
	setMonochrome: (value: boolean) => void;
	/** Dark shadcn variant for the twilight / midnight themes. */
	dark: boolean;
	/** Fill for planet glyphs drawn on light surfaces (the palette's primary content color). */
	lightPlanetFill: string;
	/** App canvas background, text color and monochrome filter. */
	canvasStyle: CSSProperties;
}

const AppearanceContext = createContext<AppearanceValue | null>(null);

/** Owns appearance state, applies it to the document (palette CSS variables, `dark` class) and
 *  provides `useAppTheme()` below it. */
export function AppearanceProvider({ children }: { children: ReactNode }) {
	const [theme, setTheme] = useState<Theme>('noon');
	const [themePalettes, setThemePalettes] = useState(readStoredThemePalettes);
	const [appShellIconSet, setAppShellIconSetState] =
		useState<AppShellIconSetId>(readStoredAppShellIconSet);
	const [glyphSet, setGlyphSetState] = useState<AstrologyGlyphSetId>(readStoredGlyphSet);
	const [enabledSymbolSetIds, setEnabledSymbolSetIdsState] = useState<string[]>(
		readStoredEnabledSymbolSetIds
	);
	const [wheelStyle, setWheelStyleState] = useState<WheelStyleId>(readStoredWheelStyle);
	const [wheelOrientation, setWheelOrientationState] = useState<WheelOrientationId>(
		readStoredWheelOrientation
	);
	const [elementColors, setElementColors] = useState<ElementColors>(readStoredElementColors);
	const [monochrome, setMonochromeState] = useState<boolean>(readStoredMonochrome);

	const themePalette = themePalettes[theme];
	const dark = theme === 'twilight' || theme === 'midnight';

	const commitThemePalette = useCallback(
		(palette: ThemePalette) =>
			setThemePalettes((prev) => {
				const next = { ...prev, [theme]: palette };
				persistThemePalettes(next);
				return next;
			}),
		[theme]
	);
	// Every setter persists its preference, so callers never write storage themselves.
	const setAppShellIconSet = useCallback((value: AppShellIconSetId) => {
		setAppShellIconSetState(value);
		persistAppShellIconSet(value);
	}, []);
	const setGlyphSet = useCallback((value: AstrologyGlyphSetId) => {
		setGlyphSetState(value);
		persistGlyphSet(value);
	}, []);
	const setEnabledSymbolSetIds = useCallback((value: string[]) => {
		setEnabledSymbolSetIdsState(value);
		persistEnabledSymbolSetIds(value);
	}, []);
	const setWheelStyle = useCallback((value: WheelStyleId) => {
		setWheelStyleState(value);
		persistWheelStyle(value);
	}, []);
	const setWheelOrientation = useCallback((value: WheelOrientationId) => {
		setWheelOrientationState(value);
		persistWheelOrientation(value);
	}, []);
	const commitElementColors = useCallback((value: ElementColors) => {
		setElementColors(value);
		persistElementColors(value);
	}, []);
	const setMonochrome = useCallback((value: boolean) => {
		setMonochromeState(value);
		persistMonochrome(value);
	}, []);

	useLayoutEffect(() => {
		document.documentElement.classList.toggle('dark', dark);
	}, [dark]);

	const themeVars = useMemo(() => themePaletteVars(themePalette), [themePalette]);
	useEffect(() => {
		const root = document.documentElement;
		for (const [key, value] of Object.entries(themeVars)) {
			root.style.setProperty(key, value as string);
		}
	}, [themeVars]);

	const canvasStyle = useMemo<CSSProperties>(
		() => ({
			background: `linear-gradient(to bottom right, ${themePalette.canvasStart} 0%, ${themePalette.canvasEnd} 100%)`,
			color: themePalette.contentTextPrimary,
			filter: monochrome ? 'grayscale(1)' : undefined
		}),
		[themePalette, monochrome]
	);

	const value = useMemo<AppearanceValue>(
		() => ({
			theme,
			setTheme,
			themePalette,
			commitThemePalette,
			appShellIconSet,
			setAppShellIconSet,
			glyphSet,
			setGlyphSet,
			enabledSymbolSetIds,
			setEnabledSymbolSetIds,
			wheelStyle,
			setWheelStyle,
			wheelOrientation,
			setWheelOrientation,
			elementColors,
			commitElementColors,
			monochrome,
			setMonochrome,
			dark,
			lightPlanetFill: themePalette.contentTextPrimary,
			canvasStyle
		}),
		[
			theme,
			themePalette,
			commitThemePalette,
			appShellIconSet,
			setAppShellIconSet,
			glyphSet,
			setGlyphSet,
			enabledSymbolSetIds,
			setEnabledSymbolSetIds,
			wheelStyle,
			setWheelStyle,
			wheelOrientation,
			setWheelOrientation,
			elementColors,
			commitElementColors,
			monochrome,
			setMonochrome,
			dark,
			canvasStyle
		]
	);

	return (
		<AppearanceContext.Provider value={value}>
			<AppThemeProvider theme={theme} glyphSet={glyphSet}>
				{children}
			</AppThemeProvider>
		</AppearanceContext.Provider>
	);
}

export function useAppearance(): AppearanceValue {
	const value = useContext(AppearanceContext);
	if (!value) throw new Error('useAppearance must be used within AppearanceProvider');
	return value;
}
