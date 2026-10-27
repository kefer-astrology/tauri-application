import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { AstrologyGlyphSetId } from '@/lib/astrology/glyphs';
import type { Theme } from '@/lib/theme';

export type AppThemeValue = {
	theme: Theme;
	glyphSet: AstrologyGlyphSetId;
};

const AppThemeContext = createContext<AppThemeValue | null>(null);

/** Supplies the active theme and glyph set to every view below it. Nest a second provider to
 *  preview a different value for a subtree (e.g. an unsaved glyph set in Settings). */
export function AppThemeProvider({
	theme,
	glyphSet,
	children
}: AppThemeValue & { children: ReactNode }) {
	const value = useMemo(() => ({ theme, glyphSet }), [theme, glyphSet]);
	return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme(): AppThemeValue {
	const value = useContext(AppThemeContext);
	if (!value) throw new Error('useAppTheme must be used within AppThemeProvider');
	return value;
}
