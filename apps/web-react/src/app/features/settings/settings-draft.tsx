import { createContext, useContext } from 'react';
import type { ElementColors } from '@/lib/astrology/elementColors';
import type { ThemePalette } from '@/lib/themePalettes';

/**
 * Settings state shared by the sections. Most settings apply immediately; element colors and the
 * theme palette are drafts applied by Confirm. `markChanged` enables Confirm; Cancel discards the
 * drafts and remounts the sections, dropping any half-typed input.
 */
export interface SettingsDraftValue {
	markChanged: () => void;
	elementDraft: ElementColors;
	setElementDraft: (update: (draft: ElementColors) => ElementColors) => void;
	paletteDraft: ThemePalette;
	setPaletteDraft: (update: (draft: ThemePalette) => ThemePalette) => void;
}

export const SettingsDraftContext = createContext<SettingsDraftValue | null>(null);

export function useSettingsDraft(): SettingsDraftValue {
	const value = useContext(SettingsDraftContext);
	if (!value) throw new Error('useSettingsDraft must be used within SettingsView');
	return value;
}
