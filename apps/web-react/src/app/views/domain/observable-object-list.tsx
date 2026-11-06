import { Checkbox } from '@/app/components/ui/checkbox';
import { Text } from '@/app/components/ui/typography';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ColorInput } from '@/app/components/ui/color-input';
import { SegmentedControl } from '@/app/components/ui/segmented-control';
import { cn } from '@/app/components/ui/utils';
import { useAppFormFieldTheme } from '@/app/components/form-field-theme';
import { OptionSelect } from '@/app/views/data/filter-controls';
import {
	SelectionList,
	type SelectionListGroup,
	type SelectionListItem
} from '@/app/views/data/selection-list';
import {
	OBSERVABLE_OBJECTS,
	OBSERVABLE_OBJECT_CATEGORY_LABELS,
	getDefaultBodyColor,
	getObservableCategoryLabel,
	getObservableObjectLabel,
	starHemisphere,
	type FixedStarSignificance,
	type ObservableObjectCategory,
	type ObservableObjectDefinition,
	type StarHemisphere
} from '@/lib/astrology/observableObjects';
import { ZODIAC_ID_ELEMENT } from '@/lib/astrology/elementColors';
import { ZODIAC_UNICODE_GLYPHS } from '@/lib/astrology/zodiac';
import { ObjectGlyph } from './object-glyph';

const CATEGORY_ORDER = Object.keys(OBSERVABLE_OBJECT_CATEGORY_LABELS) as ObservableObjectCategory[];

/** Exotic/aspirational groups start collapsed. */
const COLLAPSED_CATEGORIES: ObservableObjectCategory[] = [
	'asteroids',
	'sensitive_points',
	'geocentric_nodes',
	'trans_neptunian',
	'fixed_stars',
	'hypothetical'
];

/** Sign ids in zodiac order for the fixed-star sign filter — from the static element map, since
 *  this filter is independent of a workspace's sign presentation. */
const ZODIAC_SIGN_IDS = Object.keys(ZODIAC_ID_ELEMENT);
const STAR_SIGNIFICANCES: readonly FixedStarSignificance[] = ['royal', 'behenian', 'notable'];

type ObjectItem = SelectionListItem & { definition: ObservableObjectDefinition };

/**
 * Observable objects from the domain catalog, grouped by category, searchable, multi-select.
 * Planned (unsupported) objects are shown disabled; fixed stars are listed with their own
 * hemisphere / sign / significance filters. With `colors` + `onColorChange`, each object gets a
 * color picker.
 */
export function ObservableObjectList({
	subtitle,
	selectedIds,
	onSelectedIdsChange,
	colors,
	onColorChange
}: {
	subtitle?: string;
	selectedIds: string[];
	onSelectedIdsChange: (ids: string[]) => void;
	colors?: Record<string, string>;
	onColorChange?: (id: string, color: string) => void;
}) {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme();
	const [hemisphere, setHemisphere] = useState<StarHemisphere | 'all'>('all');
	const [significance, setSignificance] = useState<FixedStarSignificance | 'all'>('all');
	const [sign, setSign] = useState('');

	const groups = useMemo<SelectionListGroup<ObjectItem>[]>(
		() =>
			CATEGORY_ORDER.map((category) => ({
				id: category,
				label: getObservableCategoryLabel(category, t),
				items: OBSERVABLE_OBJECTS.filter((item) => item.category === category).map(
					(definition) => ({
						id: definition.id,
						label: getObservableObjectLabel(definition, t),
						searchTerms: [definition.fallbackLabel, definition.altName ?? ''],
						disabled: definition.status === 'planned',
						definition
					})
				)
			})).filter((group) => group.items.length > 0),
		[t]
	);

	return (
		<SelectionList
			groups={groups}
			selectedIds={selectedIds}
			onSelectedIdsChange={onSelectedIdsChange}
			collapsedGroupIds={COLLAPSED_CATEGORIES}
			headerStart={
				subtitle && (
					<Text variant="body" tone="muted">
						{subtitle}
					</Text>
				)
			}
			labels={{
				search: t('aspectarium_search_planets'),
				clearSearch: t('clear'),
				selectedCount: (count) => t('aspectarium_selected_count', { count }),
				clearAll: t('aspectarium_clear_all'),
				noResults: t('open_search_no_results'),
				panelTitle: t('dashboard_positions_picker_title'),
				panelEmpty: t('dashboard_no_positions'),
				remove: (label) => t('remove_item', { label })
			}}
			renderItem={(item, { highlight }) => (
				<>
					<ObjectGlyph id={item.id} className={cn('shrink-0', ft.iconColor)} />
					<Text variant="body" as="span" tone="secondary">
						{highlight(item.label)}
					</Text>
					{item.definition.altName && (
						<Text variant="caption" as="span" tone="muted" className="truncate italic">
							{highlight(item.definition.altName)}
						</Text>
					)}
					{item.disabled && (
						<Text variant="caption" as="span" tone="muted" className="italic">
							({t('transits_body_unsupported_hint')})
						</Text>
					)}
				</>
			)}
			renderTrailing={
				colors && onColorChange
					? (item) => (
							<ColorInput
								value={colors[item.id] ?? getDefaultBodyColor(item.id)}
								onChange={(event) => onColorChange(item.id, event.target.value)}
								aria-label={`${item.label} ${t('color_theme')}`}
							/>
						)
					: undefined
			}
			renderGroupContent={(group, visible, { highlight }) => {
				if (group.id !== 'fixed_stars') return undefined;
				const stars = visible.filter(
					({ definition }) =>
						(hemisphere === 'all' || starHemisphere(definition) === hemisphere) &&
						(!sign || definition.zodiacSign === sign) &&
						(significance === 'all' || definition.significance === significance)
				);
				return (
					<div className="space-y-3">
						<Text variant="caption" tone="muted">
							{t('points_star_reference')}
						</Text>
						<div className="flex flex-wrap items-center gap-1.5">
							<SegmentedControl
								value={hemisphere}
								options={[
									{ value: 'all', label: t('settings_stars_filter_all', { defaultValue: 'All' }) },
									{
										value: 'north',
										label: t('settings_stars_filter_north', { defaultValue: 'Northern sky' })
									},
									{
										value: 'south',
										label: t('settings_stars_filter_south', { defaultValue: 'Southern sky' })
									}
								]}
								onValueChange={setHemisphere}
								ariaLabel={t('settings_stars_hemisphere_filter', {
									defaultValue: 'Filter by sky hemisphere'
								})}
							/>
							<OptionSelect
								value={sign}
								onValueChange={setSign}
								anyLabel={t('settings_stars_filter_all', { defaultValue: 'All' })}
								ariaLabel={t('settings_stars_sign_filter', {
									defaultValue: 'Filter by zodiac sign'
								})}
								className="w-auto"
								options={ZODIAC_SIGN_IDS.map((id, index) => ({
									value: id,
									label: `${ZODIAC_UNICODE_GLYPHS[index]} ${t(`open_sign_${id}`, { defaultValue: id })}`
								}))}
							/>
						</div>
						<SegmentedControl
							value={significance}
							options={(['all', ...STAR_SIGNIFICANCES] as const).map((value) => ({
								value,
								label: t(`settings_stars_filter_${value}`, { defaultValue: value })
							}))}
							onValueChange={setSignificance}
							ariaLabel={t('settings_stars_significance_filter', {
								defaultValue: 'Filter by astrological significance'
							})}
						/>
						<div className="grid grid-cols-2 gap-x-8 gap-y-1.5 sm:grid-cols-3">
							{stars.map(({ id, label, definition, disabled }) => (
								<label
									key={id}
									className={cn(
										'flex items-center gap-2 text-sm',
										disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
									)}
								>
									<Checkbox
										disabled={disabled}
										checked={selectedIds.includes(id)}
										aria-label={label}
										onCheckedChange={() =>
											onSelectedIdsChange(
												selectedIds.includes(id)
													? selectedIds.filter((existing) => existing !== id)
													: [...selectedIds, id]
											)
										}
									/>
									<span className="min-w-0 truncate">
										{definition.zodiacSign && (
											<span className="mr-1" aria-hidden="true">
												{ZODIAC_UNICODE_GLYPHS[ZODIAC_SIGN_IDS.indexOf(definition.zodiacSign)]}
											</span>
										)}
										{highlight(label)}
										{definition.altName && (
											<Text variant="caption" as="span" tone="muted" className="ml-1 italic">
												({definition.altName})
											</Text>
										)}
										{definition.significance && definition.significance !== 'notable' && (
											<Text variant="caption" as="span" tone="muted" className="ml-1 italic">
												&middot;{' '}
												{t(`settings_stars_filter_${definition.significance}`, {
													defaultValue: definition.significance
												})}
											</Text>
										)}
									</span>
								</label>
							))}
						</div>
					</div>
				);
			}}
		/>
	);
}
