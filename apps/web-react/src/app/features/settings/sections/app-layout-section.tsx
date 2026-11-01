import { useTranslation } from 'react-i18next';
import { Accordion } from '@/app/components/ui/accordion';
import { Button } from '@/app/components/ui/button';
import { ColorInput } from '@/app/components/ui/color-input';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { RangeInput } from '@/app/components/ui/range-input';
import { Switch } from '@/app/components/ui/switch';
import { cn } from '@/app/components/ui/utils';
import { useAppFormFieldTheme } from '@/app/components/form-field-theme';
import { useAppearance } from '@/app/providers/appearance';
import { THEME_ORDER } from '@/lib/theme';
import { DEFAULT_THEME_PALETTES, type ThemePalette } from '@/lib/themePalettes';
import { formatThemeColor, parseThemeColor } from '@/lib/themeColors';
import { SettingSelect, SettingsGroup } from '../settings-controls';
import { useSettingsDraft } from '../settings-draft';

type PaletteColorKey = Exclude<keyof ThemePalette, 'popupBackgroundFuzziness'>;

const OPAQUE_PALETTE_FIELDS: [PaletteColorKey, string][] = [
	['mainSidebarStart', 'settings_theme_main_sidebar_start'],
	['mainSidebarEnd', 'settings_theme_main_sidebar_end'],
	['secondarySidebarStart', 'settings_theme_secondary_sidebar_start'],
	['secondarySidebarEnd', 'settings_theme_secondary_sidebar_end'],
	['canvasStart', 'settings_theme_canvas_start'],
	['canvasEnd', 'settings_theme_canvas_end'],
	['navTextPrimary', 'settings_theme_nav_text_primary'],
	['navTextSecondary', 'settings_theme_nav_text_secondary'],
	['contentTextPrimary', 'settings_theme_content_text_primary'],
	['contentTextSecondary', 'settings_theme_content_text_secondary'],
	['contentMuted', 'settings_theme_content_muted'],
	['accent', 'settings_theme_accent']
];
/** Colors that may be translucent: a picker for the hue plus a transparency switch. */
const TRANSLUCENT_PALETTE_FIELDS: [PaletteColorKey, string][] = [
	['hoverBackground', 'settings_theme_hover_background'],
	['selectedBackground', 'settings_theme_selected_background']
];

/** Theme (immediate), the active theme's palette (draft, applied by Confirm) and monochrome
 *  view (immediate). */
export function AppLayoutSection() {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme();
	const appearance = useAppearance();
	const { markChanged, paletteDraft, setPaletteDraft } = useSettingsDraft();

	const setColor = (key: PaletteColorKey, value: string) => {
		setPaletteDraft((draft) => ({ ...draft, [key]: value }));
		markChanged();
	};

	return (
		<Accordion type="multiple" className="w-full">
			<SettingsGroup value="theme" title={t('settings_theme_selector')}>
				<SettingSelect
					narrow
					value={appearance.theme}
					options={THEME_ORDER.map((theme) => ({
						value: theme,
						label: t(`sidebar_theme_${theme}`)
					}))}
					onValueChange={(theme) => {
						appearance.setTheme(theme);
						markChanged();
					}}
				/>
			</SettingsGroup>

			<SettingsGroup
				value="palette"
				title={t('settings_theme_palette_title')}
				className="space-y-4"
			>
				<p className={cn('text-xs leading-relaxed', ft.muted)}>
					{t('settings_theme_palette_blurb', { theme: t(`sidebar_theme_${appearance.theme}`) })}
				</p>
				<div className="space-y-2 rounded-xl border border-[color:var(--theme-panel-border)] bg-[color:var(--theme-soft-bg)] p-4">
					<div className="flex items-center justify-between gap-4">
						<Label htmlFor="settings-popup-fuzziness" className={ft.label}>
							{t('settings_popup_fuzziness')}
						</Label>
						<output
							htmlFor="settings-popup-fuzziness"
							className={cn('min-w-12 text-right text-sm tabular-nums', ft.title)}
						>
							{Math.round(paletteDraft.popupBackgroundFuzziness)}%
						</output>
					</div>
					<RangeInput
						id="settings-popup-fuzziness"
						min={0}
						max={100}
						step={1}
						value={paletteDraft.popupBackgroundFuzziness}
						onChange={(event) => {
							const popupBackgroundFuzziness = Number(event.target.value);
							setPaletteDraft((draft) => ({ ...draft, popupBackgroundFuzziness }));
							markChanged();
						}}
					/>
					<p className={cn('text-xs leading-relaxed', ft.muted)}>
						{t('settings_popup_fuzziness_hint')}
					</p>
				</div>
				<div className="grid gap-4 sm:grid-cols-2">
					{OPAQUE_PALETTE_FIELDS.map(([key, labelKey]) => (
						<div key={key} className="flex items-center gap-3">
							<div className="min-w-0 flex-1">
								<Label className={cn(ft.label, 'mb-1 block')}>{t(labelKey)}</Label>
								<Input
									className={ft.inputCompact}
									value={paletteDraft[key]}
									onChange={(event) => setColor(key, event.target.value)}
								/>
							</div>
							<ColorInput
								className="mt-5 w-14"
								value={paletteDraft[key]}
								onChange={(event) => setColor(key, event.target.value)}
								aria-label={t(labelKey)}
							/>
						</div>
					))}
				</div>
				<div className="grid gap-4 sm:grid-cols-2">
					{TRANSLUCENT_PALETTE_FIELDS.map(([key, labelKey]) => {
						const parsed = parseThemeColor(paletteDraft[key]);
						const defaultAlpha = parseThemeColor(
							DEFAULT_THEME_PALETTES[appearance.theme][key]
						).alpha;
						const transparencyId = `settings-${key}-transparency`;
						return (
							<div key={key} className="space-y-2">
								<Label className={ft.label}>{t(labelKey)}</Label>
								<div className="flex items-center gap-3">
									<Input
										className={cn(ft.inputCompact, 'min-w-0 flex-1')}
										value={paletteDraft[key]}
										onChange={(event) => setColor(key, event.target.value)}
									/>
									<ColorInput
										className="w-14"
										value={parsed.hex}
										onChange={(event) =>
											setColor(key, formatThemeColor(event.target.value, parsed.alpha))
										}
										aria-label={t(labelKey)}
									/>
								</div>
								<div className="flex items-center gap-2">
									<Switch
										id={transparencyId}
										checked={parsed.alpha < 1}
										onCheckedChange={(checked) =>
											setColor(key, formatThemeColor(parsed.hex, checked ? defaultAlpha : 1))
										}
									/>
									<Label
										htmlFor={transparencyId}
										className={cn('cursor-pointer text-xs', ft.muted)}
									>
										{t('settings_theme_transparency')}
									</Label>
								</div>
							</div>
						);
					})}
				</div>
				<div className="pt-1">
					<Button
						type="button"
						variant="outline"
						className={cn(ft.footerCancel, 'max-w-xs')}
						onClick={() => {
							setPaletteDraft(() => DEFAULT_THEME_PALETTES[appearance.theme]);
							markChanged();
						}}
					>
						{t('settings_theme_reset_current')}
					</Button>
				</div>
			</SettingsGroup>

			<SettingsGroup
				value="monochrome"
				title={t('settings_monochrome_title', { defaultValue: 'Monochromatic view' })}
				className="space-y-3"
			>
				<div className="flex items-center gap-2">
					<Switch
						id="settings-monochrome"
						checked={appearance.monochrome}
						onCheckedChange={(checked) => {
							appearance.setMonochrome(checked);
							markChanged();
						}}
					/>
					<Label htmlFor="settings-monochrome" className={cn('cursor-pointer', ft.label)}>
						{t('settings_monochrome_label', {
							defaultValue: 'Use a monochromatic (grayscale) app appearance'
						})}
					</Label>
				</div>
				<p className={cn('text-xs leading-relaxed', ft.muted)}>
					{t('settings_monochrome_hint', {
						defaultValue:
							'Desaturates the whole app on top of any theme or palette. Your theme and palette colors stay as-is underneath.'
					})}
				</p>
			</SettingsGroup>
		</Accordion>
	);
}
