import { useTranslation } from 'react-i18next';
import { Accordion } from '@/app/components/ui/accordion';
import { Checkbox } from '@/app/components/ui/checkbox';
import { ColorInput } from '@/app/components/ui/color-input';
import { Label } from '@/app/components/ui/label';
import { cn } from '@/app/components/ui/utils';
import { useAppFormFieldTheme } from '@/app/components/form-field-theme';
import { useAppearance } from '@/app/providers/appearance';
import { APP_SHELL_ICON_SET_OPTIONS } from '@/lib/app-shell';
import type { ElementId } from '@/lib/astrology/elementColors';
import { DEGREE_SYMBOL_SET_CATALOG } from '@/lib/astrology/degreeSymbolSets';
import { WHEEL_STYLE_OPTIONS } from '@/lib/astrology/wheelStyle';
import { GlyphManager } from '../glyph-manager';
import { SettingSelect, SettingsGroup } from '../settings-controls';
import { useSettingsDraft } from '../settings-draft';

const GLYPH_SET_OPTIONS = [
	{
		value: 'default' as const,
		label: 'Default',
		description: 'Current shared astrology glyph set.'
	},
	{
		value: 'modern' as const,
		label: 'Modern',
		description: 'Alternate shared astrology glyph set.'
	}
];
const ELEMENTS = ['fire', 'earth', 'air', 'water'] as const satisfies readonly ElementId[];

/** Glyph and icon sets, degree symbol sets, radix style and orientation (immediate), element
 *  colors (draft, applied by Confirm), and custom glyph uploads. */
export function SymbolLayoutSection() {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme();
	const appearance = useAppearance();
	const { markChanged, elementDraft, setElementDraft } = useSettingsDraft();

	const description = <T extends { value: string; description?: string }>(
		options: readonly T[],
		value: string
	) => options.find((option) => option.value === value)?.description;

	return (
		<Accordion type="multiple" className="w-full">
			<SettingsGroup value="glyph-set" title={t('settings_symbol_selector')} className="space-y-5">
				<SettingSelect
					label={t('select_glyph_set')}
					hint={description(GLYPH_SET_OPTIONS, appearance.glyphSet)}
					narrow
					value={appearance.glyphSet}
					options={GLYPH_SET_OPTIONS}
					onValueChange={(value) => {
						appearance.setGlyphSet(value);
						markChanged();
					}}
				/>
				<SettingSelect
					label={t('settings_app_shell_icons')}
					hint={
						APP_SHELL_ICON_SET_OPTIONS.find((option) => option.id === appearance.appShellIconSet)
							?.description
					}
					narrow
					value={appearance.appShellIconSet}
					options={APP_SHELL_ICON_SET_OPTIONS.map((option) => ({
						value: option.id,
						label: option.label
					}))}
					onValueChange={(value) => {
						appearance.setAppShellIconSet(value);
						markChanged();
					}}
				/>
			</SettingsGroup>

			<SettingsGroup
				value="degree-symbol-sets"
				title={t('settings_degree_symbol_sets')}
				className="space-y-3"
			>
				<p className={cn('text-xs leading-relaxed', ft.muted)}>
					{t('settings_degree_symbol_sets_blurb')}
				</p>
				{DEGREE_SYMBOL_SET_CATALOG.map((entry) => (
					<div key={entry.id} className="flex items-center gap-2">
						<Checkbox
							id={`symbol-set-${entry.id}`}
							checked={appearance.enabledSymbolSetIds.includes(entry.id)}
							disabled={!entry.available}
							onCheckedChange={() => {
								const current = appearance.enabledSymbolSetIds;
								appearance.setEnabledSymbolSetIds(
									current.includes(entry.id)
										? current.filter((id) => id !== entry.id)
										: [...current, entry.id]
								);
								markChanged();
							}}
						/>
						<Label
							htmlFor={`symbol-set-${entry.id}`}
							className={cn(
								'text-sm',
								entry.available ? cn('cursor-pointer', ft.bodyText) : ft.muted
							)}
						>
							{t(entry.labelKey)}
						</Label>
						{!entry.available && (
							<span className={cn('text-xs italic', ft.muted)}>
								{t('settings_degree_symbol_set_unavailable')}
							</span>
						)}
					</div>
				))}
			</SettingsGroup>

			<SettingsGroup value="radix-style" title={t('settings_radix_style')} className="space-y-5">
				<SettingSelect
					hint={description(
						WHEEL_STYLE_OPTIONS.map((option) => ({ ...option, value: option.id })),
						appearance.wheelStyle
					)}
					narrow
					value={appearance.wheelStyle}
					options={WHEEL_STYLE_OPTIONS.map((option) => ({ value: option.id, label: option.label }))}
					onValueChange={(value) => {
						appearance.setWheelStyle(value);
						markChanged();
					}}
				/>
				<SettingSelect
					label={t('settings_wheel_orientation')}
					narrow
					value={appearance.wheelOrientation}
					options={[
						{ value: 'ascendant', label: t('settings_wheel_orientation_ascendant') },
						{ value: 'aries', label: t('settings_wheel_orientation_aries') }
					]}
					onValueChange={(value) => {
						appearance.setWheelOrientation(value);
						markChanged();
					}}
				/>
			</SettingsGroup>

			<SettingsGroup
				value="element-colors"
				title={t('settings_element_colors')}
				className="space-y-4"
			>
				<p className={cn('text-xs leading-relaxed', ft.muted)}>
					{t('settings_element_wheel_blurb')}
				</p>
				{ELEMENTS.map((element) => (
					<div key={element} className="flex flex-wrap items-center gap-3">
						<Label className={cn(ft.label, 'min-w-[8rem] shrink-0')}>
							{t(`settings_element_${element}`)}
						</Label>
						<ColorInput
							className="w-14"
							value={elementDraft[element]}
							onChange={(event) => {
								const color = event.target.value;
								setElementDraft((draft) => ({ ...draft, [element]: color }));
								markChanged();
							}}
							aria-label={t(`settings_element_${element}`)}
						/>
						<span className={cn('font-mono text-xs', ft.muted)}>{elementDraft[element]}</span>
					</div>
				))}
			</SettingsGroup>

			<SettingsGroup value="glyph-manager" title={t('glyph_manager_title')}>
				<GlyphManager />
			</SettingsGroup>
		</Accordion>
	);
}
