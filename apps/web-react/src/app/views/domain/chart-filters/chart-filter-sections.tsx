import { useTranslation } from 'react-i18next';
import { Plus, X } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { cn } from '@/app/components/ui/utils';
import { useAppFormFieldTheme } from '@/app/components/form-field-theme';
import { CheckList, FieldLabel, OptionSelect } from '@/app/views/data/filter-controls';
import { ASPECT_ROWS } from '@/lib/astrology/aspects';
import { DOMAIN_CATALOG } from '@/lib/astrology/domainCatalog';
import { FACT_PLANET_IDS, type FactPlanetId } from '@/lib/astrology/factFilters';
import {
	DATE_PART_IDS,
	emptyAspectFilter,
	type AspectFilter,
	type ChartQuery,
	type HouseFilter,
	type PlanetFilter
} from '@/lib/astrology/chartQuery';
import { CHART_TYPE_OPTIONS } from '@/lib/chartTypes';
import { degreeOptions, houseOptions, motionOptions, planetOptions, signOptions } from './options';

/** Content of each chart filter group (no surrounding section), driven by a `ChartQuery` slice. */

type SliceProps<T> = { value: T; onChange: (value: T) => void };

export function ChartTypeFilter({ value, onChange }: SliceProps<string[]>) {
	const { t } = useTranslation();
	return (
		<CheckList
			idPrefix="type"
			items={CHART_TYPE_OPTIONS.map((option) => ({
				value: option.id,
				label: t(option.labelKey),
				indent: option.indent,
				heading: option.group
			}))}
			selected={value}
			onSelectedChange={onChange}
		/>
	);
}

export function TagFilter({
	value,
	onChange,
	availableTags
}: SliceProps<string> & { availableTags: readonly string[] }) {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme();
	return (
		<>
			<div>
				<FieldLabel>{t('open_filter_tag_fulltext')}</FieldLabel>
				<Input
					type="search"
					value={value}
					onChange={(event) => onChange(event.target.value)}
					placeholder={t('open_filter_tag_fulltext')}
					className={cn(ft.inputCompact, 'mt-1.5')}
				/>
			</div>
			<div className="flex flex-wrap gap-1.5">
				{availableTags.map((tag) => (
					<Button
						key={tag}
						type="button"
						size="sm"
						variant="outline"
						className="h-7 rounded-full px-2 text-xs"
						onClick={() => onChange(tag)}
					>
						{tag}
					</Button>
				))}
			</div>
		</>
	);
}

const DATE_PART_RANGE: Record<(typeof DATE_PART_IDS)[number], [number, number | undefined]> = {
	day: [1, 31],
	month: [1, 12],
	year: [1, undefined],
	hour: [0, 23],
	minute: [0, 59],
	second: [0, 59]
};

export function DateFilter({ value, onChange }: SliceProps<ChartQuery['date']>) {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme();
	return (
		<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
			{DATE_PART_IDS.map((part) => (
				<div key={part}>
					<FieldLabel>{t(`open_date_${part}`)}</FieldLabel>
					<Input
						type="number"
						value={value[part]}
						onChange={(event) => onChange({ ...value, [part]: event.target.value })}
						min={DATE_PART_RANGE[part][0]}
						max={DATE_PART_RANGE[part][1]}
						className={cn(ft.inputCompact, 'mt-1.5')}
					/>
				</div>
			))}
		</div>
	);
}

export function LocationFilter({ value, onChange }: SliceProps<string>) {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme();
	return (
		<Input
			type="search"
			value={value}
			onChange={(event) => onChange(event.target.value)}
			placeholder={t('open_filter_location_fulltext')}
			className={ft.inputCompact}
		/>
	);
}

export function PlanetFilters({ value, onChange }: SliceProps<Record<FactPlanetId, PlanetFilter>>) {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme();
	const update = (planet: FactPlanetId, patch: Partial<PlanetFilter>) =>
		onChange({ ...value, [planet]: { ...value[planet], ...patch } });
	const grid = 'grid grid-cols-[80px_1fr_64px_64px_94px] gap-2';
	return (
		<div className="overflow-x-auto">
			<div className="min-w-[30rem]">
				<div className={cn(grid, 'mb-2 text-xs font-medium', ft.muted)}>
					<div />
					<div>{t('open_filter_sign')}</div>
					<div>{t('open_filter_degree')}</div>
					<div>{t('open_filter_house')}</div>
					<div>{t('open_filter_motion')}</div>
				</div>
				<div className="space-y-2">
					{FACT_PLANET_IDS.map((planet) => (
						<div key={planet} className={cn(grid, 'items-center text-sm')}>
							<div className={cn('truncate', ft.bodyText)}>{t(`planet_${planet}`)}</div>
							<OptionSelect
								value={value[planet].sign}
								options={signOptions(t)}
								onValueChange={(sign) => update(planet, { sign })}
							/>
							<OptionSelect
								value={value[planet].degree}
								options={degreeOptions()}
								onValueChange={(degree) => update(planet, { degree })}
							/>
							<OptionSelect
								value={value[planet].house}
								options={houseOptions()}
								onValueChange={(house) => update(planet, { house })}
							/>
							<OptionSelect
								value={value[planet].motion}
								options={motionOptions(t)}
								onValueChange={(motion) => update(planet, { motion })}
							/>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

export function AspectFilters({ value, onChange }: SliceProps<AspectFilter[]>) {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme();
	const update = (id: number, patch: Partial<AspectFilter>) =>
		onChange(value.map((filter) => (filter.id === id ? { ...filter, ...patch } : filter)));
	const aspectOptions = ASPECT_ROWS.map((aspect) => ({
		value: aspect.id,
		label: t(aspect.labelKey)
	}));
	const grid = 'grid grid-cols-[1fr_1fr_1fr_28px] gap-2';
	return (
		<>
			<div className={cn(grid, 'text-xs font-medium', ft.muted)}>
				<div>{t('open_filter_planet')}</div>
				<div>{t('open_filter_aspect')}</div>
				<div>{t('open_filter_planet')}</div>
				<div />
			</div>
			{value.map((filter) => (
				<div key={filter.id} className={cn(grid, 'items-center')}>
					<OptionSelect
						value={filter.left}
						options={planetOptions(t)}
						onValueChange={(left) => update(filter.id, { left })}
					/>
					<OptionSelect
						value={filter.aspect}
						options={aspectOptions}
						onValueChange={(aspect) => update(filter.id, { aspect })}
					/>
					<OptionSelect
						value={filter.right}
						options={planetOptions(t)}
						onValueChange={(right) => update(filter.id, { right })}
					/>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="size-7"
						disabled={value.length === 1}
						onClick={() => onChange(value.filter((item) => item.id !== filter.id))}
						aria-label={t('open_filter_remove_condition')}
					>
						<X className="size-3.5" />
					</Button>
				</div>
			))}
			<Button
				type="button"
				variant="outline"
				size="sm"
				className={cn('h-8 text-xs', ft.footerCancel)}
				onClick={() =>
					onChange([...value, emptyAspectFilter(Math.max(0, ...value.map((f) => f.id)) + 1)])
				}
			>
				<Plus className="size-3.5" />
				{t('open_filter_add_condition')}
			</Button>
		</>
	);
}

const ANGLE_HOUSE_LABELS: Record<number, string> = {
	1: '(ASC)',
	4: '(IC)',
	7: '(DSC)',
	10: '(MC)'
};

export function HouseFilters({ value, onChange }: SliceProps<Record<number, HouseFilter>>) {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme();
	const update = (house: number, patch: Partial<HouseFilter>) =>
		onChange({ ...value, [house]: { ...value[house]!, ...patch } });
	const grid = 'grid grid-cols-[72px_1fr_80px] gap-2';
	return (
		<div className="mx-auto max-w-sm">
			<div className={cn(grid, 'mb-2 text-xs font-medium', ft.muted)}>
				<div />
				<div>{t('open_filter_sign')}</div>
				<div>{t('open_filter_degree')}</div>
			</div>
			<div className="space-y-2">
				{Array.from({ length: 12 }, (_, index) => index + 1).map((house) => (
					<div key={house} className={cn(grid, 'items-center')}>
						<span className={cn('text-sm', ft.bodyText)}>
							{house}. {ANGLE_HOUSE_LABELS[house] ?? ''}
						</span>
						<OptionSelect
							value={value[house]?.sign ?? ''}
							options={signOptions(t)}
							onValueChange={(sign) => update(house, { sign })}
						/>
						<OptionSelect
							value={value[house]?.degree ?? ''}
							options={degreeOptions()}
							onValueChange={(degree) => update(house, { degree })}
						/>
					</div>
				))}
			</div>
		</div>
	);
}

/** Leader sub-groups render as headings in the shape list. */
const SHAPE_HEADING_IDS = new Set(['bowl_leader', 'locomotive_leader']);

/** Checklist over the Rust domain catalog's chart shapes or configurations. */
export function CatalogFilter({
	catalog,
	value,
	onChange
}: SliceProps<string[]> & { catalog: 'shapes' | 'configurations' }) {
	const { t } = useTranslation();
	const definitions = DOMAIN_CATALOG?.[catalog] ?? [];
	return (
		<CheckList
			idPrefix={catalog}
			items={definitions.map((definition) => ({
				value: definition.id,
				label: t(definition.translation_key),
				indent: definition.parent_id ? 1 : undefined,
				heading: catalog === 'shapes' && SHAPE_HEADING_IDS.has(definition.id)
			}))}
			selected={value}
			onSelectedChange={onChange}
		/>
	);
}
