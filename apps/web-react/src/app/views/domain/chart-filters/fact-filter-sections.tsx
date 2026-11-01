import { useTranslation } from 'react-i18next';
import { Plus, X } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { SegmentedControl } from '@/app/components/ui/segmented-control';
import { cn } from '@/app/components/ui/utils';
import { useAppFormFieldTheme } from '@/app/components/form-field-theme';
import {
	CheckList,
	CheckRow,
	CountField,
	FieldLabel,
	OptionSelect,
	type FilterOption
} from '@/app/views/data/filter-controls';
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
	type InnerPlanetFilter,
	type StelliumFilter
} from '@/lib/astrology/factFilters';
import { houseOptions, planetOptions, signOptions } from './options';

/** Content of the filter groups backed by Rust chart facts, each driven by a `FactFilters` slice. */

type SliceProps<T> = { value: T; onChange: (value: T) => void };

const AXIS_LABEL_KEYS: Record<string, string> = {
	asc: 'point_asc',
	desc: 'point_dsc',
	mc: 'point_mc',
	ic: 'point_ic',
	vertex: 'point_vertex',
	antivertex: 'point_antivertex'
};

export function StelliumFilters({ value, onChange }: SliceProps<StelliumFilter[]>) {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme();
	const update = (id: number, patch: Partial<StelliumFilter>) =>
		onChange(value.map((stellium) => (stellium.id === id ? { ...stellium, ...patch } : stellium)));
	return (
		<>
			{value.map((stellium, index) => (
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
							onValueChange={(size) => update(stellium.id, { size })}
							allowDeselect
							emptyValue=""
							ariaLabel={t('open_filter_stellium_size')}
						/>
						{value.length > 1 && (
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="size-7"
								aria-label={t('open_filter_remove_condition')}
								onClick={() => onChange(value.filter((entry) => entry.id !== stellium.id))}
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
						onValueChange={(kind) => update(stellium.id, { kind })}
						ariaLabel={t('info_stellium')}
						className="flex w-full flex-wrap"
					/>
					{stellium.kind === 'sign' && (
						<OptionSelect
							value={stellium.sign}
							options={signOptions(t)}
							anyLabel={t('open_stellium_any_sign')}
							onValueChange={(sign) => update(stellium.id, { sign })}
						/>
					)}
					{stellium.kind === 'house' && (
						<OptionSelect
							value={stellium.house}
							options={houseOptions()}
							anyLabel={t('open_stellium_any_house')}
							onValueChange={(house) => update(stellium.id, { house })}
						/>
					)}
					<FieldLabel>{t('open_stellium_required')}</FieldLabel>
					<CheckList
						idPrefix={`stellium-${stellium.id}`}
						items={planetOptions(t)}
						selected={stellium.required}
						onSelectedChange={(required) => update(stellium.id, { required })}
						columns={2}
					/>
				</div>
			))}
			<Button
				type="button"
				variant="outline"
				size="sm"
				className={cn('gap-1.5', ft.footerCancel)}
				onClick={() =>
					onChange([...value, emptyStelliumFilter(Math.max(0, ...value.map((s) => s.id)) + 1)])
				}
			>
				<Plus className="size-4" />
				{t('open_filter_add_stellium')}
			</Button>
		</>
	);
}

export function HemisphereFilters({
	hemispheres,
	quadrants,
	onChange
}: {
	hemispheres: string[];
	quadrants: CountFilter[];
	onChange: (patch: Partial<Pick<FactFilters, 'hemispheres' | 'quadrants'>>) => void;
}) {
	const { t } = useTranslation();
	return (
		<>
			<FieldLabel>{t('open_hemisphere_all_in')}</FieldLabel>
			<CheckList
				idPrefix="hemisphere"
				items={HEMISPHERE_IDS.map((id) => ({ value: id, label: t(`open_hemisphere_${id}`) }))}
				selected={hemispheres}
				onSelectedChange={(next) => onChange({ hemispheres: next })}
			/>
			{quadrants.map((filter, index) => (
				<CountField
					key={index}
					id={`quadrant-${index}`}
					label={t('open_quadrant_count', { n: index + 1 })}
					orMoreLabel={t('open_count_or_more')}
					value={filter}
					onValueChange={(next) =>
						onChange({ quadrants: quadrants.map((entry, i) => (i === index ? next : entry)) })
					}
				/>
			))}
		</>
	);
}

/** One count condition per category (modality, element, house group, aspect type). */
export function CountFilters<K extends string>({
	idPrefix,
	ids,
	labelKey,
	value,
	onChange,
	max,
	dominant = false
}: SliceProps<Record<K, CountFilter>> & {
	idPrefix: string;
	ids: readonly K[];
	labelKey: (id: K) => string;
	max?: number;
	dominant?: boolean;
}) {
	const { t } = useTranslation();
	const extraOptions: FilterOption[] = dominant
		? [{ value: 'dominant', label: t('open_count_dominant') }]
		: [];
	return (
		<>
			{ids.map((id) => (
				<CountField
					key={id}
					id={`${idPrefix}-${id}`}
					label={t(labelKey(id))}
					orMoreLabel={t('open_count_or_more')}
					value={value[id]}
					onValueChange={(next) => onChange({ ...value, [id]: next })}
					max={max}
					extraOptions={extraOptions}
				/>
			))}
		</>
	);
}

export const ModalityFilters = (props: SliceProps<FactFilters['modality']>) => (
	<CountFilters
		idPrefix="modality"
		ids={MODALITY_IDS}
		labelKey={(id) => `open_modality_${id}`}
		{...props}
	/>
);
export const ElementFilters = (props: SliceProps<FactFilters['elements']>) => (
	<CountFilters
		idPrefix="elements"
		ids={ELEMENT_IDS}
		labelKey={(id) => `element_${id}`}
		{...props}
	/>
);
export const HouseGroupFilters = (props: SliceProps<FactFilters['houseGroups']>) => (
	<CountFilters
		idPrefix="house-groups"
		ids={HOUSE_GROUP_IDS}
		labelKey={(id) => `open_house_group_${id}`}
		{...props}
	/>
);
export const AspectDominanceFilters = (props: SliceProps<FactFilters['aspects']>) => (
	<CountFilters
		idPrefix="aspects"
		ids={PTOLEMAIC_ASPECT_IDS}
		labelKey={(id) => `aspect_${id}`}
		max={15}
		dominant
		{...props}
	/>
);

const INNER_PLANETS = [
	{
		body: 'mercury',
		labelKey: 'info_mercury',
		phases: ['prometheus', 'epimetheus'],
		prefix: 'open_mercury_'
	},
	{
		body: 'venus',
		labelKey: 'info_venus',
		phases: ['morning_star', 'evening_star'],
		prefix: 'open_venus_'
	}
] as const;

export function InnerPlanetFilters({
	mercury,
	venus,
	onChange
}: {
	mercury: InnerPlanetFilter;
	venus: InnerPlanetFilter;
	onChange: (patch: Partial<Pick<FactFilters, 'mercury' | 'venus'>>) => void;
}) {
	const { t } = useTranslation();
	const values = { mercury, venus };
	const motions: FilterOption[] = [
		{ value: 'direct', label: t('open_motion_direct') },
		{ value: 'retrograde', label: t('open_motion_retrograde') }
	];
	return (
		<>
			{INNER_PLANETS.map(({ body, labelKey, phases, prefix }) => (
				<div key={body} className="space-y-1.5">
					<FieldLabel>{t(labelKey)}</FieldLabel>
					<div className="grid grid-cols-2 gap-2">
						<OptionSelect
							value={values[body].phase}
							options={phases.map((phase) => ({ value: phase, label: t(`${prefix}${phase}`) }))}
							onValueChange={(phase) => onChange({ [body]: { ...values[body], phase } })}
						/>
						<OptionSelect
							value={values[body].motion}
							options={motions}
							onValueChange={(motion) => onChange({ [body]: { ...values[body], motion } })}
						/>
					</div>
				</div>
			))}
		</>
	);
}

export function LunarPhaseFilter({ value, onChange }: SliceProps<string[]>) {
	const { t } = useTranslation();
	return (
		<CheckList
			idPrefix="lunar"
			items={LUNAR_CYCLE_PHASE_IDS.map((id) => ({ value: id, label: t(`open_phase_${id}`) }))}
			selected={value}
			onSelectedChange={onChange}
		/>
	);
}

export function OrientationFilter({ value, onChange }: SliceProps<string>) {
	const { t } = useTranslation();
	return (
		<OptionSelect
			value={value}
			options={['extroversion', 'introversion', 'balanced'].map((id) => ({
				value: id,
				label: t(`open_orientation_${id}`)
			}))}
			onValueChange={onChange}
		/>
	);
}

export function HorizonFilter({ value, onChange }: SliceProps<string>) {
	const { t } = useTranslation();
	return (
		<OptionSelect
			value={value}
			options={HORIZON_OPTIONS.map((id) => ({ value: id, label: t(`open_horizon_${id}`) }))}
			onValueChange={onChange}
		/>
	);
}

export function AngularPlanetFilter({ value, onChange }: SliceProps<FactFilters['angular']>) {
	const { t } = useTranslation();
	return (
		<>
			<div className="grid grid-cols-2 gap-2">
				<div className="space-y-1">
					<FieldLabel>{t('open_filter_planet')}</FieldLabel>
					<OptionSelect
						value={value.planet}
						options={planetOptions(t)}
						onValueChange={(planet) => onChange({ ...value, planet })}
					/>
				</div>
				<div className="space-y-1">
					<FieldLabel>{t('open_filter_axis')}</FieldLabel>
					<OptionSelect
						value={value.axis}
						options={AXIS_IDS.map((id) => ({ value: id, label: t(AXIS_LABEL_KEYS[id]!) }))}
						onValueChange={(axis) => onChange({ ...value, axis })}
					/>
				</div>
			</div>
			<CheckRow
				id="angular-multiple"
				checked={value.multiple}
				onCheckedChange={() => onChange({ ...value, multiple: !value.multiple })}
			>
				{t('open_angular_multiple')}
			</CheckRow>
		</>
	);
}

export function UnaspectedFilter({ value, onChange }: SliceProps<string[]>) {
	const { t } = useTranslation();
	return (
		<CheckList
			idPrefix="unaspected"
			items={planetOptions(t)}
			selected={value}
			onSelectedChange={onChange}
			columns={2}
		/>
	);
}

export function ChartRulerFilter({ value, onChange }: SliceProps<FactFilters['ruler']>) {
	const { t } = useTranslation();
	return (
		<>
			<SegmentedControl
				value={value.system}
				options={[
					{ value: 'modern', label: t('open_ruler_modern') },
					{ value: 'traditional', label: t('open_ruler_traditional') }
				]}
				onValueChange={(system) => onChange({ ...value, system })}
				ariaLabel={t('open_ruler_system')}
			/>
			<div className="grid grid-cols-3 gap-2">
				<div className="space-y-1">
					<FieldLabel>{t('open_filter_planet')}</FieldLabel>
					<OptionSelect
						value={value.planet}
						options={planetOptions(
							t,
							value.system === 'traditional' ? TRADITIONAL_PLANET_IDS : FACT_PLANET_IDS
						)}
						onValueChange={(planet) => onChange({ ...value, planet })}
					/>
				</div>
				<div className="space-y-1">
					<FieldLabel>{t('open_filter_sign')}</FieldLabel>
					<OptionSelect
						value={value.sign}
						options={signOptions(t)}
						onValueChange={(sign) => onChange({ ...value, sign })}
					/>
				</div>
				<div className="space-y-1">
					<FieldLabel>{t('open_filter_house')}</FieldLabel>
					<OptionSelect
						value={value.house}
						options={houseOptions()}
						onValueChange={(house) => onChange({ ...value, house })}
					/>
				</div>
			</div>
		</>
	);
}

/** Final dispositor: any / one planet / none (mutual reception or loop). */
export function DispositorFilter({
	value,
	onChange,
	system
}: SliceProps<string> & { system: 'traditional' | 'modern' }) {
	const { t } = useTranslation();
	return (
		<OptionSelect
			value={value}
			options={[
				...planetOptions(t, system === 'traditional' ? TRADITIONAL_PLANET_IDS : FACT_PLANET_IDS),
				{ value: 'none', label: t('open_dispositor_none') }
			]}
			onValueChange={onChange}
		/>
	);
}
