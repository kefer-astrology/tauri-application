import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X } from 'lucide-react';
import { AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { SegmentedControl } from './ui/segmented-control';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { cn } from './ui/utils';
import { useAppFormFieldTheme } from './form-field-theme';
import { DOMAIN_CATALOG } from '@/lib/astrology/domainCatalog';
import {
	AXIS_IDS,
	ELEMENT_IDS,
	emptyStelliumFilter,
	FACT_PLANET_IDS,
	HEMISPHERE_IDS,
	HORIZON_OPTIONS,
	HOUSE_GROUP_IDS,
	LUNAR_CYCLE_PHASE_IDS,
	MODALITY_IDS,
	PTOLEMAIC_ASPECT_IDS,
	TRADITIONAL_PLANET_IDS,
	type CountFilter,
	type FactFilters,
	type StelliumFilter
} from '@/lib/astrology/factFilters';

/** Open-view filter groups backed by Rust chart facts, in display order, with their headings.
 *  Keys double as ids in the "visible filters" panel. */
export const FACT_FILTER_GROUP_LABEL_KEYS: Record<string, string> = {
	stellium: 'info_stellium',
	hemispheres: 'info_hemisphere_emphasis',
	modality: 'info_dominance_mode_quality',
	elements: 'info_dominance_element',
	house_groups: 'info_dominance_houses',
	aspect_dominance: 'info_dominance_aspects',
	mercury_venus: 'open_filter_mercury_venus',
	lunar_phase: 'info_lunar_phases',
	orientation: 'info_extroversion_introversion_ratio',
	horizon: 'info_sun_moon_horizon',
	angular: 'info_angular_planet',
	unaspected: 'info_unaspect_planets',
	ruler: 'info_horoscope_ruler',
	dispositor_traditional: 'open_filter_final_dispositor_traditional',
	dispositor_modern: 'open_filter_final_dispositor_modern'
};

const ANY = '__any__';
const AXIS_LABEL_KEYS: Record<string, string> = {
	asc: 'point_asc',
	desc: 'point_dsc',
	mc: 'point_mc',
	ic: 'point_ic',
	vertex: 'point_vertex',
	antivertex: 'point_antivertex'
};
const signIds = () => (DOMAIN_CATALOG?.model.signs ?? []).map((sign) => sign.id);

type Option = { value: string; label: string };
type Update = (updater: (current: FactFilters) => FactFilters) => void;

function OptionSelect({
	value,
	options,
	onValueChange,
	anyLabel = '—',
	className
}: {
	value: string;
	options: Option[];
	onValueChange: (value: string) => void;
	anyLabel?: string;
	className?: string;
}) {
	const ft = useAppFormFieldTheme();
	return (
		<Select value={value || ANY} onValueChange={(next) => onValueChange(next === ANY ? '' : next)}>
			<SelectTrigger className={cn(ft.inputCompact, 'w-full px-2 text-xs', className)}>
				<SelectValue />
			</SelectTrigger>
			<SelectContent className={ft.selectContent}>
				<SelectItem value={ANY} className={ft.selectItem}>
					{anyLabel}
				</SelectItem>
				{options.map((option) => (
					<SelectItem key={option.value} value={option.value} className={ft.selectItem}>
						{option.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

function CheckRow({
	id,
	checked,
	onCheckedChange,
	children
}: {
	id: string;
	checked: boolean;
	onCheckedChange: () => void;
	children: ReactNode;
}) {
	const ft = useAppFormFieldTheme();
	return (
		<div className="flex items-center gap-2">
			<Checkbox id={id} checked={checked} onCheckedChange={onCheckedChange} />
			<Label htmlFor={id} className={cn('cursor-pointer text-sm', ft.bodyText)}>
				{children}
			</Label>
		</div>
	);
}

/** One labelled count condition: `[— | 0 … max | dominant?]` + "or more". */
function CountRow({
	id,
	label,
	filter,
	onFilterChange,
	max = 10,
	dominant = false
}: {
	id: string;
	label: string;
	filter: CountFilter;
	onFilterChange: (filter: CountFilter) => void;
	max?: number;
	dominant?: boolean;
}) {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme();
	const options: Option[] = [
		...(dominant ? [{ value: 'dominant', label: t('open_count_dominant') }] : []),
		...Array.from({ length: max + 1 }, (_, n) => ({ value: String(n), label: String(n) }))
	];
	return (
		<div className="grid grid-cols-[minmax(0,1fr)_5.5rem_auto] items-center gap-2">
			<span className={cn('truncate text-sm', ft.bodyText)}>{label}</span>
			<OptionSelect
				value={filter.value}
				options={options}
				onValueChange={(value) => onFilterChange({ ...filter, value })}
			/>
			<CheckRow
				id={`${id}-or-more`}
				checked={filter.orMore}
				onCheckedChange={() => onFilterChange({ ...filter, orMore: !filter.orMore })}
			>
				<span className="text-xs">{t('open_count_or_more')}</span>
			</CheckRow>
		</div>
	);
}

function Section({
	id,
	visibleGroups,
	children
}: {
	id: string;
	visibleGroups: readonly string[];
	children: ReactNode;
}) {
	const { t } = useTranslation();
	if (!visibleGroups.includes(id)) return null;
	return (
		<AccordionItem value={id} className="border-none">
			<AccordionTrigger className="px-4 py-3 hover:no-underline sm:px-6">
				{t(FACT_FILTER_GROUP_LABEL_KEYS[id]!)}
			</AccordionTrigger>
			<AccordionContent className="space-y-3 px-4 sm:px-6">{children}</AccordionContent>
		</AccordionItem>
	);
}

function FieldLabel({ children }: { children: ReactNode }) {
	const ft = useAppFormFieldTheme();
	return <Label className={cn('text-xs font-medium', ft.muted)}>{children}</Label>;
}

export function FactFilterSections({
	filters,
	onChange,
	visibleGroups
}: {
	filters: FactFilters;
	onChange: Update;
	visibleGroups: readonly string[];
}) {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme();

	const planetOptions = (ids: readonly string[] = FACT_PLANET_IDS): Option[] =>
		ids.map((id) => ({ value: id, label: t(`planet_${id}`) }));
	const signOptions = (): Option[] =>
		signIds().map((id, index) => ({ value: String(index), label: t(`open_sign_${id}`) }));
	const houseOptions = (): Option[] =>
		Array.from({ length: 12 }, (_, index) => ({
			value: String(index + 1),
			label: `${index + 1}.`
		}));
	const motionOptions: Option[] = [
		{ value: 'direct', label: t('open_motion_direct') },
		{ value: 'retrograde', label: t('open_motion_retrograde') }
	];

	const set = <K extends keyof FactFilters>(key: K, value: FactFilters[K]) =>
		onChange((current) => ({ ...current, [key]: value }));
	const toggle = (key: 'hemispheres' | 'lunarPhases' | 'unaspected', id: string) =>
		onChange((current) => ({
			...current,
			[key]: current[key].includes(id)
				? current[key].filter((value) => value !== id)
				: [...current[key], id]
		}));

	const updateStellium = (id: number, patch: Partial<StelliumFilter>) =>
		set(
			'stelliums',
			filters.stelliums.map((stellium) =>
				stellium.id === id ? { ...stellium, ...patch } : stellium
			)
		);

	const countRecordRows = <K extends string>(
		key: 'modality' | 'elements' | 'houseGroups' | 'aspects',
		ids: readonly K[],
		labelKey: (id: K) => string,
		options: { max?: number; dominant?: boolean } = {}
	) =>
		ids.map((id) => (
			<CountRow
				key={id}
				id={`${key}-${id}`}
				label={t(labelKey(id))}
				filter={(filters[key] as Record<K, CountFilter>)[id]}
				onFilterChange={(filter) =>
					onChange((current) => ({ ...current, [key]: { ...current[key], [id]: filter } }))
				}
				{...options}
			/>
		));

	const dispositorOptions = (ids: readonly string[]): Option[] => [
		...planetOptions(ids),
		{ value: 'none', label: t('open_dispositor_none') }
	];

	return (
		<>
			<Section visibleGroups={visibleGroups} id="stellium">
				{filters.stelliums.map((stellium, index) => (
					<div
						key={stellium.id}
						className={cn(
							'space-y-2',
							index > 0 && 'border-t border-[color:var(--theme-panel-border)] pt-3'
						)}
					>
						<div className="flex items-center justify-between gap-2">
							<SegmentedControl
								value={stellium.size}
								options={[
									{ value: '3', label: '3+' },
									{ value: '4', label: '4+' },
									{ value: '5', label: '5+' }
								]}
								onValueChange={(size) => updateStellium(stellium.id, { size })}
								allowDeselect
								emptyValue=""
								ariaLabel={t('open_filter_stellium_size')}
							/>
							{filters.stelliums.length > 1 && (
								<Button
									type="button"
									variant="ghost"
									size="icon"
									className="size-7"
									aria-label={t('open_filter_remove_condition')}
									onClick={() =>
										set(
											'stelliums',
											filters.stelliums.filter((entry) => entry.id !== stellium.id)
										)
									}
								>
									<X className="size-4" />
								</Button>
							)}
						</div>
						<SegmentedControl
							value={stellium.kind}
							options={[
								{ value: 'chain', label: t('open_stellium_chain') },
								{ value: 'sign', label: t('open_stellium_sign') },
								{ value: 'house', label: t('open_stellium_house') }
							]}
							onValueChange={(kind) => updateStellium(stellium.id, { kind })}
							ariaLabel={t('info_stellium')}
							className="flex w-full flex-wrap"
						/>
						{stellium.kind === 'sign' && (
							<OptionSelect
								value={stellium.sign}
								options={signOptions()}
								anyLabel={t('open_stellium_any_sign')}
								onValueChange={(sign) => updateStellium(stellium.id, { sign })}
							/>
						)}
						{stellium.kind === 'house' && (
							<OptionSelect
								value={stellium.house}
								options={houseOptions()}
								anyLabel={t('open_stellium_any_house')}
								onValueChange={(house) => updateStellium(stellium.id, { house })}
							/>
						)}
						<FieldLabel>{t('open_stellium_required')}</FieldLabel>
						<div className="grid grid-cols-2 gap-1.5">
							{FACT_PLANET_IDS.map((planet) => (
								<CheckRow
									key={planet}
									id={`stellium-${stellium.id}-${planet}`}
									checked={stellium.required.includes(planet)}
									onCheckedChange={() =>
										updateStellium(stellium.id, {
											required: stellium.required.includes(planet)
												? stellium.required.filter((id) => id !== planet)
												: [...stellium.required, planet]
										})
									}
								>
									{t(`planet_${planet}`)}
								</CheckRow>
							))}
						</div>
					</div>
				))}
				<Button
					type="button"
					variant="outline"
					size="sm"
					className={cn('gap-1.5', ft.footerCancel)}
					onClick={() =>
						set('stelliums', [
							...filters.stelliums,
							emptyStelliumFilter(Math.max(0, ...filters.stelliums.map((s) => s.id)) + 1)
						])
					}
				>
					<Plus className="size-4" />
					{t('open_filter_add_stellium')}
				</Button>
			</Section>

			<Section visibleGroups={visibleGroups} id="hemispheres">
				<FieldLabel>{t('open_hemisphere_all_in')}</FieldLabel>
				{HEMISPHERE_IDS.map((id) => (
					<CheckRow
						key={id}
						id={`hemisphere-${id}`}
						checked={filters.hemispheres.includes(id)}
						onCheckedChange={() => toggle('hemispheres', id)}
					>
						{t(`open_hemisphere_${id}`)}
					</CheckRow>
				))}
				{filters.quadrants.map((filter, index) => (
					<CountRow
						key={index}
						id={`quadrant-${index}`}
						label={t('open_quadrant_count', { n: index + 1 })}
						filter={filter}
						onFilterChange={(next) =>
							set(
								'quadrants',
								filters.quadrants.map((entry, i) => (i === index ? next : entry))
							)
						}
					/>
				))}
			</Section>

			<Section visibleGroups={visibleGroups} id="modality">
				{countRecordRows('modality', MODALITY_IDS, (id) => `open_modality_${id}`)}
			</Section>

			<Section visibleGroups={visibleGroups} id="elements">
				{countRecordRows('elements', ELEMENT_IDS, (id) => `element_${id}`)}
			</Section>

			<Section visibleGroups={visibleGroups} id="house_groups">
				{countRecordRows('houseGroups', HOUSE_GROUP_IDS, (id) => `open_house_group_${id}`)}
			</Section>

			<Section visibleGroups={visibleGroups} id="aspect_dominance">
				{countRecordRows('aspects', PTOLEMAIC_ASPECT_IDS, (id) => `aspect_${id}`, {
					max: 15,
					dominant: true
				})}
			</Section>

			<Section visibleGroups={visibleGroups} id="mercury_venus">
				{(
					[
						['mercury', 'info_mercury', ['prometheus', 'epimetheus'], 'open_mercury_'],
						['venus', 'info_venus', ['morning_star', 'evening_star'], 'open_venus_']
					] as const
				).map(([body, labelKey, phases, prefix]) => (
					<div key={body} className="space-y-1.5">
						<FieldLabel>{t(labelKey)}</FieldLabel>
						<div className="grid grid-cols-2 gap-2">
							<OptionSelect
								value={filters[body].phase}
								options={phases.map((phase) => ({ value: phase, label: t(`${prefix}${phase}`) }))}
								onValueChange={(phase) => set(body, { ...filters[body], phase })}
							/>
							<OptionSelect
								value={filters[body].motion}
								options={motionOptions}
								onValueChange={(motion) => set(body, { ...filters[body], motion })}
							/>
						</div>
					</div>
				))}
			</Section>

			<Section visibleGroups={visibleGroups} id="lunar_phase">
				{LUNAR_CYCLE_PHASE_IDS.map((id) => (
					<CheckRow
						key={id}
						id={`lunar-${id}`}
						checked={filters.lunarPhases.includes(id)}
						onCheckedChange={() => toggle('lunarPhases', id)}
					>
						{t(`open_phase_${id}`)}
					</CheckRow>
				))}
			</Section>

			<Section visibleGroups={visibleGroups} id="orientation">
				<OptionSelect
					value={filters.orientation}
					options={['extroversion', 'introversion', 'balanced'].map((id) => ({
						value: id,
						label: t(`open_orientation_${id}`)
					}))}
					onValueChange={(orientation) => set('orientation', orientation)}
				/>
			</Section>

			<Section visibleGroups={visibleGroups} id="horizon">
				<OptionSelect
					value={filters.horizon}
					options={HORIZON_OPTIONS.map((id) => ({ value: id, label: t(`open_horizon_${id}`) }))}
					onValueChange={(horizon) => set('horizon', horizon)}
				/>
			</Section>

			<Section visibleGroups={visibleGroups} id="angular">
				<div className="grid grid-cols-2 gap-2">
					<div className="space-y-1">
						<FieldLabel>{t('open_filter_planet')}</FieldLabel>
						<OptionSelect
							value={filters.angular.planet}
							options={planetOptions()}
							onValueChange={(planet) => set('angular', { ...filters.angular, planet })}
						/>
					</div>
					<div className="space-y-1">
						<FieldLabel>{t('open_filter_axis')}</FieldLabel>
						<OptionSelect
							value={filters.angular.axis}
							options={AXIS_IDS.map((id) => ({ value: id, label: t(AXIS_LABEL_KEYS[id]!) }))}
							onValueChange={(axis) => set('angular', { ...filters.angular, axis })}
						/>
					</div>
				</div>
				<CheckRow
					id="angular-multiple"
					checked={filters.angular.multiple}
					onCheckedChange={() =>
						set('angular', { ...filters.angular, multiple: !filters.angular.multiple })
					}
				>
					{t('open_angular_multiple')}
				</CheckRow>
			</Section>

			<Section visibleGroups={visibleGroups} id="unaspected">
				<div className="grid grid-cols-2 gap-1.5">
					{FACT_PLANET_IDS.map((planet) => (
						<CheckRow
							key={planet}
							id={`unaspected-${planet}`}
							checked={filters.unaspected.includes(planet)}
							onCheckedChange={() => toggle('unaspected', planet)}
						>
							{t(`planet_${planet}`)}
						</CheckRow>
					))}
				</div>
			</Section>

			<Section visibleGroups={visibleGroups} id="ruler">
				<SegmentedControl
					value={filters.ruler.system}
					options={[
						{ value: 'modern', label: t('open_ruler_modern') },
						{ value: 'traditional', label: t('open_ruler_traditional') }
					]}
					onValueChange={(system) => set('ruler', { ...filters.ruler, system })}
					ariaLabel={t('open_ruler_system')}
				/>
				<div className="grid grid-cols-3 gap-2">
					<div className="space-y-1">
						<FieldLabel>{t('open_filter_planet')}</FieldLabel>
						<OptionSelect
							value={filters.ruler.planet}
							options={planetOptions(
								filters.ruler.system === 'traditional' ? TRADITIONAL_PLANET_IDS : FACT_PLANET_IDS
							)}
							onValueChange={(planet) => set('ruler', { ...filters.ruler, planet })}
						/>
					</div>
					<div className="space-y-1">
						<FieldLabel>{t('open_filter_sign')}</FieldLabel>
						<OptionSelect
							value={filters.ruler.sign}
							options={signOptions()}
							onValueChange={(sign) => set('ruler', { ...filters.ruler, sign })}
						/>
					</div>
					<div className="space-y-1">
						<FieldLabel>{t('open_filter_house')}</FieldLabel>
						<OptionSelect
							value={filters.ruler.house}
							options={houseOptions()}
							onValueChange={(house) => set('ruler', { ...filters.ruler, house })}
						/>
					</div>
				</div>
			</Section>

			<Section visibleGroups={visibleGroups} id="dispositor_traditional">
				<OptionSelect
					value={filters.dispositorTraditional}
					options={dispositorOptions(TRADITIONAL_PLANET_IDS)}
					onValueChange={(value) => set('dispositorTraditional', value)}
				/>
			</Section>

			<Section visibleGroups={visibleGroups} id="dispositor_modern">
				<OptionSelect
					value={filters.dispositorModern}
					options={dispositorOptions(FACT_PLANET_IDS)}
					onValueChange={(value) => set('dispositorModern', value)}
				/>
			</Section>
		</>
	);
}
