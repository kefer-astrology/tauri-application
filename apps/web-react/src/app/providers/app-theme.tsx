import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { AstrologyGlyphSetId } from '@/lib/astrology/glyphs';
import type { Theme } from '@/lib/theme';
import { DEFAULT_THEME_PALETTES, isLightPalette } from '@/lib/themePalettes';

export type AppThemeValue = {
	theme: Theme;
	glyphSet: AstrologyGlyphSetId;
	dark: boolean;
};

const AppThemeContext = createContext<AppThemeValue | null>(null);

/** Supplies the active theme and glyph set to every view below it. Nest a second provider to
 *  preview a different value for a subtree (e.g. an unsaved glyph set in Settings). */
export function AppThemeProvider({
	theme,
	glyphSet,
	dark = !isLightPalette(DEFAULT_THEME_PALETTES[theme]),
	children
}: Omit<AppThemeValue, 'dark'> & { dark?: boolean; children: ReactNode }) {
	const value = useMemo(() => ({ theme, glyphSet, dark }), [theme, glyphSet, dark]);
	return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme(): AppThemeValue {
	const value = useContext(AppThemeContext);
	if (!value) throw new Error('useAppTheme must be used within AppThemeProvider');
	return value;
}
