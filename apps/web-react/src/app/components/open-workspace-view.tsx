import {
	useEffect,
	useMemo,
	useRef,
	useState,
	type CSSProperties,
	type PointerEvent as ReactPointerEvent,
	type ReactNode
} from 'react';
import { useTranslation } from 'react-i18next';
import { FolderOpen, PanelRightOpen, Plus, Star, X } from 'lucide-react';
import { AppMainContentContainer, AppMainContentRoot } from './app-main-content';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { cn } from './ui/utils';
import { useAppFormFieldTheme } from './form-field-theme';
import type { Theme } from './astrology-sidebar';
import { useWorkspaceCharts } from '../providers/workspace-charts';
import { tagColor } from '@/lib/chartTags';
import type { AppChart } from '@/lib/tauri/chartPayload';
import { ASPECT_ROWS } from '@/lib/astrology/aspects';
import {
	chartSearchMetadata,
	degreeInSign,
	houseForLongitude,
	SEARCH_PLANET_IDS,
	signIndex,
	type ChartSearchMetadata,
	type SearchPlanetId
} from '@/lib/astrology/chartSearch';

type OpenMode = 'my_radixes' | 'database';
type PlanetFilter = { sign: string; degree: string; house: string; motion: string };
type HouseFilter = { sign: string; degree: string };
type AspectFilter = { id: number; left: string; aspect: string; right: string };

export type OpenWorkspaceViewProps = {
	theme: Theme;
	workspacePath: string | null;
	onOpenWorkspace: () => void | Promise<void>;
	onActivateChart: (chartId: string) => void;
};

const CHART_TYPE_OPTIONS = [
	{ id: 'natal', values: ['NATAL'], labelKey: 'new_type_radix' },
	{ id: 'event', values: ['EVENT'], labelKey: 'new_type_event' },
	{ id: 'horary', values: ['HORARY'], labelKey: 'new_type_horary' },
	{ id: 'transit', values: ['TRANSIT'], labelKey: 'open_type_transit' },
	{
		id: 'primary_direction',
		values: ['PRIMARY_DIRECTION', 'PRIMARY_DIRECTIONS'],
		labelKey: 'open_type_primary_direction'
	},
	{
		id: 'secondary_direction',
		values: ['SECONDARY_DIRECTION', 'SECONDARY_DIRECTIONS'],
		labelKey: 'open_type_secondary_direction'
	},
	{ id: 'solar', values: ['SOLAR', 'SOLAR_RETURN'], labelKey: 'open_type_solar' },
	{
		id: 'relative',
		values: ['RELATIVE', 'RELATIVE_RETURN', 'RELATIV'],
		labelKey: 'revolution_kind_relative'
	},
	{ id: 'lunar', values: ['LUNAR', 'LUNAR_RETURN'], labelKey: 'open_type_lunar' },
	{ id: 'synastry', values: ['SYNASTRY'], labelKey: 'open_type_synastry' }
] as const;

const PLANET_LABEL_KEYS: Record<SearchPlanetId, string> = {
	sun: 'planet_sun',
	moon: 'planet_moon',
	mercury: 'planet_mercury',
	venus: 'planet_venus',
	mars: 'planet_mars',
	jupiter: 'planet_jupiter',
	saturn: 'planet_saturn',
	uranus: 'planet_uranus',
	neptune: 'planet_neptune',
	pluto: 'planet_pluto'
};

const ZODIAC_KEYS = [
	'open_sign_aries',
	'open_sign_taurus',
	'open_sign_gemini',
	'open_sign_cancer',
	'open_sign_leo',
	'open_sign_virgo',
	'open_sign_libra',
	'open_sign_scorpio',
	'open_sign_sagittarius',
	'open_sign_capricorn',
	'open_sign_aquarius',
	'open_sign_pisces'
] as const;

const SHAPE_OPTIONS: Array<{ id: string; labelKey: string; indent?: number; group?: boolean }> = [
	{ id: 'bundle', labelKey: 'open_shape_bundle' },
	{ id: 'bowl', labelKey: 'open_shape_bowl' },
	{ id: 'bowl_east', labelKey: 'open_shape_bowl_east', indent: 1 },
	{ id: 'bowl_west', labelKey: 'open_shape_bowl_west', indent: 1 },
	{ id: 'bowl_day', labelKey: 'open_shape_bowl_day', indent: 1 },
	{ id: 'bowl_night', labelKey: 'open_shape_bowl_night', indent: 1 },
	{ id: 'bowl_leader', labelKey: 'open_shape_leading_planet', indent: 1, group: true },
	...SEARCH_PLANET_IDS.map((planet) => ({
		id: `bowl_leader_${planet}`,
		labelKey: PLANET_LABEL_KEYS[planet],
		indent: 2
	})),
	{ id: 'bucket', labelKey: 'open_shape_bucket' },
	...(['moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'] as SearchPlanetId[]).map(
		(planet) => ({
			id: `bucket_${planet}`,
			labelKey: `open_shape_bucket_${planet}`,
			indent: 1
		})
	),
	{ id: 'seesaw', labelKey: 'open_shape_seesaw' },
	{ id: 'locomotive', labelKey: 'open_shape_locomotive' },
	{ id: 'locomotive_leader', labelKey: 'open_shape_leading_planet', indent: 1, group: true },
	...SEARCH_PLANET_IDS.map((planet) => ({
		id: `locomotive_leader_${planet}`,
		labelKey: PLANET_LABEL_KEYS[planet],
		indent: 2
	})),
	{ id: 'splash', labelKey: 'open_shape_splash' },
	{ id: 'shifted_center', labelKey: 'open_shape_shifted_center' },
	{ id: 'stellium', labelKey: 'info_stellium' }
];

const CONFIGURATION_OPTIONS: Array<{ id: string; labelKey: string; indent?: number }> = [
	{ id: 't_square', labelKey: 'open_configuration_t_square' },
	{ id: 't_square_cardinal', labelKey: 'open_modality_cardinal', indent: 1 },
	{ id: 't_square_fixed', labelKey: 'open_modality_fixed', indent: 1 },
	{ id: 't_square_mutable', labelKey: 'open_modality_mutable', indent: 1 },
	{ id: 'grand_cross', labelKey: 'open_configuration_grand_cross' },
	{ id: 'grand_cross_cardinal', labelKey: 'open_modality_cardinal', indent: 1 },
	{ id: 'grand_cross_fixed', labelKey: 'open_modality_fixed', indent: 1 },
	{ id: 'grand_cross_mutable', labelKey: 'open_modality_mutable', indent: 1 },
	{ id: 'grand_trine', labelKey: 'open_configuration_grand_trine' },
	{ id: 'grand_trine_fire', labelKey: 'open_element_fire', indent: 1 },
	{ id: 'grand_trine_earth', labelKey: 'open_element_earth', indent: 1 },
	{ id: 'grand_trine_air', labelKey: 'open_element_air', indent: 1 },
	{ id: 'grand_trine_water', labelKey: 'open_element_water', indent: 1 },
	{ id: 'hexagram', labelKey: 'open_configuration_hexagram' },
	{ id: 'mystic_rectangle', labelKey: 'open_configuration_mystic_rectangle' },
	{ id: 'pentagram', labelKey: 'open_configuration_pentagram' },
	{ id: 'double_quincunx', labelKey: 'open_configuration_double_quincunx' },
	{ id: 'kite', labelKey: 'open_configuration_kite' },
	{ id: 'kite_fire', labelKey: 'open_configuration_kite_fire', indent: 1 },
	{ id: 'kite_earth', labelKey: 'open_configuration_kite_earth', indent: 1 },
	{ id: 'kite_air', labelKey: 'open_configuration_kite_air', indent: 1 },
	{ id: 'kite_water', labelKey: 'open_configuration_kite_water', indent: 1 },
	{ id: 'double_biquintile', labelKey: 'open_configuration_double_biquintile' }
];

const emptyPlanetFilter = (): PlanetFilter => ({
	sign: 'any',
	degree: 'any',
	house: 'any',
	motion: 'any'
});
const emptyHouseFilter = (): HouseFilter => ({ sign: 'any', degree: 'any' });
const initialPlanetFilters = () =>
	Object.fromEntries(SEARCH_PLANET_IDS.map((id) => [id, emptyPlanetFilter()])) as Record<
		SearchPlanetId,
		PlanetFilter
	>;
const initialHouseFilters = () =>
	Object.fromEntries(
		Array.from({ length: 12 }, (_, index) => [index + 1, emptyHouseFilter()])
	) as Record<number, HouseFilter>;

function splitDateTime(value: string) {
	if (!value) return { date: '', time: '' };
	const parsed = new Date(value);
	if (!Number.isNaN(parsed.getTime())) {
		return {
			date: parsed.toLocaleDateString(),
			time: parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
		};
	}
	const [date = '', time = ''] = value.trim().replace('T', ' ').split(/\s+/, 2);
	return { date, time: time.replace(/Z$/, '') };
}

function parsedChartDate(value: string): Date | null {
	const parsed = new Date(value.includes('T') ? value : value.replace(' ', 'T'));
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function chartTypeId(chart: AppChart): string | null {
	const value = chart.chartType?.trim().toUpperCase();
	return (
		CHART_TYPE_OPTIONS.find((option) => (option.values as readonly string[]).includes(value))?.id ??
		null
	);
}

function chartTypeLabel(chart: AppChart, t: (key: string) => string) {
	const id = chartTypeId(chart);
	const option = CHART_TYPE_OPTIONS.find((candidate) => candidate.id === id);
	return option ? t(option.labelKey) : chart.chartType;
}

function includesNormalized(value: string | undefined, query: string) {
	return !query || (value ?? '').toLocaleLowerCase().includes(query.toLocaleLowerCase());
}

function aspectFilterMatches(metadata: ChartSearchMetadata, filter: AspectFilter) {
	if (filter.left === 'any' && filter.aspect === 'any' && filter.right === 'any') return true;
	return metadata.aspects.some((aspect) => {
		if (filter.aspect !== 'any' && aspect.type !== filter.aspect) return false;
		const direct =
			(filter.left === 'any' || aspect.from === filter.left) &&
			(filter.right === 'any' || aspect.to === filter.right);
		const reverse =
			(filter.left === 'any' || aspect.to === filter.left) &&
			(filter.right === 'any' || aspect.from === filter.right);
		return direct || reverse;
	});
}

function FieldLabel({ children, className }: { children: ReactNode; className?: string }) {
	return <Label className={cn('text-xs font-medium', className)}>{children}</Label>;
}

export function OpenWorkspaceView({
	theme,
	workspacePath,
	onOpenWorkspace,
	onActivateChart
}: OpenWorkspaceViewProps) {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme(theme);
	const { charts, selectedChartId } = useWorkspaceCharts();
	const [openMode, setOpenMode] = useState<OpenMode>('my_radixes');
	const splitPaneRef = useRef<HTMLDivElement>(null);
	const [filterPaneWidth, setFilterPaneWidth] = useState<number | null>(null);
	const [resizingFilters, setResizingFilters] = useState(false);
	const [selectedRows, setSelectedRows] = useState<string[]>([]);
	const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
	const [focusedChartId, setFocusedChartId] = useState<string | null>(selectedChartId);
	const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
	const [tagQuery, setTagQuery] = useState('');
	const [contentQuery, setContentQuery] = useState('');
	const [dateParts, setDateParts] = useState({
		day: '',
		month: '',
		year: '',
		hour: '',
		minute: '',
		second: ''
	});
	const [locationQuery, setLocationQuery] = useState('');
	const [planetFilters, setPlanetFilters] =
		useState<Record<SearchPlanetId, PlanetFilter>>(initialPlanetFilters);
	const [aspectFilters, setAspectFilters] = useState<AspectFilter[]>([
		{ id: 1, left: 'any', aspect: 'any', right: 'any' }
	]);
	const [nextAspectId, setNextAspectId] = useState(2);
	const [houseFilters, setHouseFilters] =
		useState<Record<number, HouseFilter>>(initialHouseFilters);
	const [selectedShapes, setSelectedShapes] = useState<string[]>([]);
	const [selectedConfigurations, setSelectedConfigurations] = useState<string[]>([]);

	const favorites = useMemo(() => new Set(favoriteIds), [favoriteIds]);
	const availableTags = useMemo(
		() =>
			Array.from(new Set(charts.flatMap((chart) => chart.tags ?? [])))
				.filter(Boolean)
				.sort(),
		[charts]
	);
	const metadataByChart = useMemo(
		() => new Map(charts.map((chart) => [chart.id, chartSearchMetadata(chart)])),
		[charts]
	);

	const filtered = useMemo(() => {
		if (openMode === 'database') return [] as AppChart[];
		const normalizedTagQuery = tagQuery.trim().toLocaleLowerCase();
		const normalizedContentQuery = contentQuery.trim().toLocaleLowerCase();
		const normalizedLocationQuery = locationQuery.trim().toLocaleLowerCase();
		return charts.filter((chart) => {
			if (selectedTypes.length > 0 && !selectedTypes.includes(chartTypeId(chart) ?? ''))
				return false;
			if (
				normalizedTagQuery &&
				!(chart.tags ?? []).some((tag) => tag.toLocaleLowerCase().includes(normalizedTagQuery))
			)
				return false;
			if (normalizedLocationQuery && !includesNormalized(chart.location, normalizedLocationQuery))
				return false;
			if (normalizedContentQuery) {
				const searchable = [
					chart.name,
					chart.location,
					chart.dateTime,
					chartTypeLabel(chart, t),
					...(chart.tags ?? [])
				]
					.join(' ')
					.toLocaleLowerCase();
				if (!searchable.includes(normalizedContentQuery)) return false;
			}

			const date = parsedChartDate(chart.dateTime);
			if (Object.values(dateParts).some(Boolean)) {
				if (!date) return false;
				const actual = {
					day: date.getDate(),
					month: date.getMonth() + 1,
					year: date.getFullYear(),
					hour: date.getHours(),
					minute: date.getMinutes(),
					second: date.getSeconds()
				};
				if (
					Object.entries(dateParts).some(
						([key, expected]) => expected && actual[key as keyof typeof actual] !== Number(expected)
					)
				)
					return false;
			}

			const metadata = metadataByChart.get(chart.id)!;
			for (const planet of SEARCH_PLANET_IDS) {
				const filter = planetFilters[planet];
				if (Object.values(filter).every((value) => value === 'any')) continue;
				const longitude = metadata.positions[planet];
				if (longitude === undefined) return false;
				if (filter.sign !== 'any' && signIndex(longitude) !== Number(filter.sign)) return false;
				if (filter.degree !== 'any' && degreeInSign(longitude) !== Number(filter.degree))
					return false;
				if (
					filter.house !== 'any' &&
					houseForLongitude(longitude, metadata.houseCusps) !== Number(filter.house)
				)
					return false;
				if (filter.motion !== 'any') {
					const motion = chart.computed?.motion?.[planet];
					if (!motion) return false;
					const actualMotion =
						Math.abs(motion.speed) < 0.0001
							? 'stationary'
							: motion.retrograde
								? 'retrograde'
								: 'direct';
					if (actualMotion !== filter.motion) return false;
				}
			}
			if (!aspectFilters.every((filter) => aspectFilterMatches(metadata, filter))) return false;
			for (let house = 1; house <= 12; house += 1) {
				const filter = houseFilters[house];
				if (filter.sign === 'any' && filter.degree === 'any') continue;
				const cusp = metadata.houseCusps[house - 1];
				if (cusp === undefined) return false;
				if (filter.sign !== 'any' && signIndex(cusp) !== Number(filter.sign)) return false;
				if (filter.degree !== 'any' && degreeInSign(cusp) !== Number(filter.degree)) return false;
			}
			if (selectedShapes.length > 0 && !selectedShapes.some((shape) => metadata.shapes.has(shape)))
				return false;
			if (
				selectedConfigurations.length > 0 &&
				!selectedConfigurations.some((configuration) => metadata.configurations.has(configuration))
			)
				return false;
			return true;
		});
	}, [
		aspectFilters,
		charts,
		contentQuery,
		dateParts,
		houseFilters,
		locationQuery,
		metadataByChart,
		openMode,
		planetFilters,
		selectedConfigurations,
		selectedShapes,
		selectedTypes,
		t,
		tagQuery
	]);

	useEffect(() => {
		if (selectedChartId) setFocusedChartId(selectedChartId);
	}, [selectedChartId]);

	useEffect(() => {
		if (focusedChartId && filtered.some((chart) => chart.id === focusedChartId)) return;
		setFocusedChartId(filtered[0]?.id ?? null);
	}, [filtered, focusedChartId]);

	const toggleListValue = (setter: React.Dispatch<React.SetStateAction<string[]>>, id: string) =>
		setter((current) =>
			current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
		);
	const updatePlanetFilter = (planet: SearchPlanetId, patch: Partial<PlanetFilter>) =>
		setPlanetFilters((current) => ({ ...current, [planet]: { ...current[planet], ...patch } }));
	const updateHouseFilter = (house: number, patch: Partial<HouseFilter>) =>
		setHouseFilters((current) => ({ ...current, [house]: { ...current[house], ...patch } }));
	const updateAspectFilter = (id: number, patch: Partial<AspectFilter>) =>
		setAspectFilters((current) =>
			current.map((filter) => (filter.id === id ? { ...filter, ...patch } : filter))
		);

	const resetFilters = () => {
		setSelectedTypes([]);
		setTagQuery('');
		setContentQuery('');
		setDateParts({ day: '', month: '', year: '', hour: '', minute: '', second: '' });
		setLocationQuery('');
		setPlanetFilters(initialPlanetFilters());
		setAspectFilters([{ id: 1, left: 'any', aspect: 'any', right: 'any' }]);
		setNextAspectId(2);
		setHouseFilters(initialHouseFilters());
		setSelectedShapes([]);
		setSelectedConfigurations([]);
	};

	const AnyItem = () => (
		<SelectItem value="any" className={ft.selectItem}>
			—
		</SelectItem>
	);
	const planetItems = SEARCH_PLANET_IDS.map((planet) => ({
		id: planet,
		label: t(PLANET_LABEL_KEYS[planet])
	}));
	const gridColumns =
		'grid-cols-[40px_40px_minmax(12rem,1.5fr)_minmax(8rem,1fr)_minmax(10rem,1fr)_minmax(7rem,.8fr)_minmax(6rem,.7fr)_minmax(10rem,1.2fr)]';
	const resizeFilterPane = (event: ReactPointerEvent<HTMLButtonElement>) => {
		if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
		const bounds = splitPaneRef.current?.getBoundingClientRect();
		if (!bounds) return;
		const minWidth = 260;
		const maxWidth = Math.min(560, Math.max(minWidth, bounds.width * 0.48));
		setFilterPaneWidth(Math.min(maxWidth, Math.max(minWidth, event.clientX - bounds.left)));
	};
	const finishFilterResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
		if (event.currentTarget.hasPointerCapture(event.pointerId)) {
			event.currentTarget.releasePointerCapture(event.pointerId);
		}
		setResizingFilters(false);
	};

	return (
		<AppMainContentRoot className={cn(ft.formPageBg, 'h-full')} layout="edge-to-edge">
			<AppMainContentContainer maxWidth="full" className="flex h-full min-h-0 flex-1 flex-col">
				<div
					ref={splitPaneRef}
					className={cn(
						'flex h-full min-h-[calc(100vh-8rem)] flex-1 flex-col xl:min-h-[42rem] xl:flex-row',
						resizingFilters && 'xl:cursor-col-resize xl:select-none'
					)}
				>
					<aside
						data-titlebar-secondary-rail="responsive"
						className="relative flex h-full min-h-0 w-full shrink-0 flex-col overflow-hidden border-b xl:w-[var(--open-filter-width)] xl:border-r xl:border-b-0"
						style={
							{
								'--open-filter-width':
									filterPaneWidth === null ? 'clamp(17rem, 30%, 30rem)' : `${filterPaneWidth}px`,
								background:
									'linear-gradient(to bottom, var(--theme-secondary-sidebar-start) 0%, var(--theme-secondary-sidebar-end) 100%)',
								borderColor: 'var(--theme-sidebar-border)',
								color: 'var(--theme-nav-text-primary)'
							} as CSSProperties
						}
					>
						<button
							type="button"
							className={cn(
								'absolute top-0 right-0 z-30 hidden h-full w-2 cursor-col-resize touch-none xl:block',
								'after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-[color:var(--theme-panel-border)]',
								'hover:after:w-0.5 hover:after:bg-[color:var(--theme-accent)]',
								resizingFilters && 'after:w-0.5 after:bg-[color:var(--theme-accent)]'
							)}
							onPointerDown={(event) => {
								event.preventDefault();
								event.currentTarget.setPointerCapture(event.pointerId);
								setResizingFilters(true);
							}}
							onPointerMove={resizeFilterPane}
							onPointerUp={finishFilterResize}
							onPointerCancel={finishFilterResize}
							onLostPointerCapture={() => setResizingFilters(false)}
							onDoubleClick={() => setFilterPaneWidth(null)}
							aria-label={t('open_resize_filters')}
							title={t('open_resize_filters')}
						/>
						<div className={cn('shrink-0 border-b px-4 sm:px-6', ft.footerBorder)}>
							<div className="flex min-h-16 items-center">
								{[
									{ id: 'my_radixes', label: t('open_mode_my_radixes') },
									{ id: 'database', label: t('open_mode_database') }
								].map((tab) => (
									<Button
										key={tab.id}
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => setOpenMode(tab.id as OpenMode)}
										className={cn(
											'relative h-16 min-w-0 flex-1 rounded-none px-2 text-center text-sm',
											openMode === tab.id ? ft.title : ft.muted
										)}
									>
										<span className="truncate">{tab.label}</span>
										{openMode === tab.id && (
											<span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[color:var(--theme-accent)]" />
										)}
									</Button>
								))}
							</div>
						</div>
						<div className="px-4 pt-3 pb-1 sm:px-6">
							<p className={cn('truncate text-xs', ft.muted)}>
								{workspacePath ?? t('open_table_empty')}
							</p>
						</div>
						<div className="min-h-0 flex-1 overflow-y-auto pb-20">
							<Accordion type="multiple" className="w-full">
								<AccordionItem value="chart-type" className="border-none">
									<AccordionTrigger className="px-4 py-3 hover:no-underline sm:px-6">
										{t('open_filter_chart_type')}
									</AccordionTrigger>
									<AccordionContent className="space-y-2 px-4 sm:px-6">
										{CHART_TYPE_OPTIONS.map((option) => (
											<div key={option.id} className="flex items-center gap-2">
												<Checkbox
													id={`type-${option.id}`}
													checked={selectedTypes.includes(option.id)}
													onCheckedChange={() => toggleListValue(setSelectedTypes, option.id)}
												/>
												<Label
													htmlFor={`type-${option.id}`}
													className={cn('cursor-pointer text-sm', ft.bodyText)}
												>
													{t(option.labelKey)}
												</Label>
											</div>
										))}
									</AccordionContent>
								</AccordionItem>

								<AccordionItem value="tags" className="border-none">
									<AccordionTrigger className="px-4 py-3 hover:no-underline sm:px-6">
										{t('new_tags')}
									</AccordionTrigger>
									<AccordionContent className="space-y-3 px-4 sm:px-6">
										<div>
											<FieldLabel>{t('open_filter_tag_fulltext')}</FieldLabel>
											<Input
												type="search"
												value={tagQuery}
												onChange={(event) => setTagQuery(event.target.value)}
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
													onClick={() => setTagQuery(tag)}
												>
													{tag}
												</Button>
											))}
										</div>
										<div>
											<FieldLabel>{t('open_filter_content_search')}</FieldLabel>
											<Input
												type="search"
												value={contentQuery}
												onChange={(event) => setContentQuery(event.target.value)}
												placeholder={t('open_filter_content_search')}
												className={cn(ft.inputCompact, 'mt-1.5')}
											/>
										</div>
									</AccordionContent>
								</AccordionItem>

								<AccordionItem value="date" className="border-none">
									<AccordionTrigger className="px-4 py-3 hover:no-underline sm:px-6">
										{t('new_date')}
									</AccordionTrigger>
									<AccordionContent className="grid grid-cols-2 gap-3 px-4 sm:grid-cols-3 sm:px-6">
										{(['day', 'month', 'year', 'hour', 'minute', 'second'] as const).map((part) => (
											<div key={part}>
												<FieldLabel>{t(`open_date_${part}`)}</FieldLabel>
												<Input
													type="number"
													value={dateParts[part]}
													onChange={(event) =>
														setDateParts((current) => ({ ...current, [part]: event.target.value }))
													}
													min={part === 'second' || part === 'minute' || part === 'hour' ? 0 : 1}
													max={
														part === 'month' ? 12 : part === 'day' ? 31 : part === 'hour' ? 23 : 59
													}
													className={cn(ft.inputCompact, 'mt-1.5')}
												/>
											</div>
										))}
									</AccordionContent>
								</AccordionItem>

								<AccordionItem value="location" className="border-none">
									<AccordionTrigger className="px-4 py-3 hover:no-underline sm:px-6">
										{t('new_location')}
									</AccordionTrigger>
									<AccordionContent className="px-4 sm:px-6">
										<Input
											type="search"
											value={locationQuery}
											onChange={(event) => setLocationQuery(event.target.value)}
											placeholder={t('open_filter_location_fulltext')}
											className={ft.inputCompact}
										/>
									</AccordionContent>
								</AccordionItem>

								<AccordionItem value="planets" className="border-none">
									<AccordionTrigger className="px-4 py-3 hover:no-underline sm:px-6">
										{t('open_filter_planets')}
									</AccordionTrigger>
									<AccordionContent className="px-4 sm:px-6">
										<div className="overflow-x-auto">
											<div className="min-w-[30rem]">
												<div
													className={cn(
														'mb-2 grid grid-cols-[80px_1fr_64px_64px_94px] gap-2 text-xs font-medium',
														ft.muted
													)}
												>
													<div />
													<div>{t('open_filter_sign')}</div>
													<div>{t('open_filter_degree')}</div>
													<div>{t('open_filter_house')}</div>
													<div>{t('open_filter_motion')}</div>
												</div>
												<div className="space-y-2">
													{planetItems.map(({ id, label }) => {
														const filter = planetFilters[id];
														return (
															<div
																key={id}
																className="grid grid-cols-[80px_1fr_64px_64px_94px] items-center gap-2 text-sm"
															>
																<div className={cn('truncate', ft.bodyText)}>{label}</div>
																<Select
																	value={filter.sign}
																	onValueChange={(value) => updatePlanetFilter(id, { sign: value })}
																>
																	<SelectTrigger
																		className={cn(ft.inputCompact, 'w-full px-2 text-xs')}
																	>
																		<SelectValue />
																	</SelectTrigger>
																	<SelectContent className={ft.selectContent}>
																		<AnyItem />
																		{ZODIAC_KEYS.map((key, index) => (
																			<SelectItem
																				key={key}
																				value={String(index)}
																				className={ft.selectItem}
																			>
																				{t(key)}
																			</SelectItem>
																		))}
																	</SelectContent>
																</Select>
																<Select
																	value={filter.degree}
																	onValueChange={(value) =>
																		updatePlanetFilter(id, { degree: value })
																	}
																>
																	<SelectTrigger
																		className={cn(ft.inputCompact, 'w-full px-2 text-xs')}
																	>
																		<SelectValue />
																	</SelectTrigger>
																	<SelectContent className={ft.selectContent}>
																		<AnyItem />
																		{Array.from({ length: 30 }, (_, index) => index + 1).map(
																			(degree) => (
																				<SelectItem
																					key={degree}
																					value={String(degree)}
																					className={ft.selectItem}
																				>
																					{degree}°
																				</SelectItem>
																			)
																		)}
																	</SelectContent>
																</Select>
																<Select
																	value={filter.house}
																	onValueChange={(value) =>
																		updatePlanetFilter(id, { house: value })
																	}
																>
																	<SelectTrigger
																		className={cn(ft.inputCompact, 'w-full px-2 text-xs')}
																	>
																		<SelectValue />
																	</SelectTrigger>
																	<SelectContent className={ft.selectContent}>
																		<AnyItem />
																		{Array.from({ length: 12 }, (_, index) => index + 1).map(
																			(house) => (
																				<SelectItem
																					key={house}
																					value={String(house)}
																					className={ft.selectItem}
																				>
																					{house}.
																				</SelectItem>
																			)
																		)}
																	</SelectContent>
																</Select>
																<Select
																	value={filter.motion}
																	onValueChange={(value) =>
																		updatePlanetFilter(id, { motion: value })
																	}
																>
																	<SelectTrigger
																		className={cn(ft.inputCompact, 'w-full px-2 text-xs')}
																	>
																		<SelectValue />
																	</SelectTrigger>
																	<SelectContent className={ft.selectContent}>
																		<AnyItem />
																		<SelectItem value="direct" className={ft.selectItem}>
																			{t('open_motion_direct')}
																		</SelectItem>
																		<SelectItem value="stationary" className={ft.selectItem}>
																			{t('open_motion_stationary')}
																		</SelectItem>
																		<SelectItem value="retrograde" className={ft.selectItem}>
																			{t('open_motion_retrograde')}
																		</SelectItem>
																	</SelectContent>
																</Select>
															</div>
														);
													})}
												</div>
											</div>
										</div>
									</AccordionContent>
								</AccordionItem>

								<AccordionItem value="aspects" className="border-none">
									<AccordionTrigger className="px-4 py-3 hover:no-underline sm:px-6">
										{t('open_filter_aspects')}
									</AccordionTrigger>
									<AccordionContent className="space-y-2 px-4 sm:px-6">
										<div
											className={cn(
												'grid grid-cols-[1fr_1fr_1fr_28px] gap-2 text-xs font-medium',
												ft.muted
											)}
										>
											<div>{t('open_filter_planet')}</div>
											<div>{t('open_filter_aspect')}</div>
											<div>{t('open_filter_planet')}</div>
											<div />
										</div>
										{aspectFilters.map((filter) => (
											<div
												key={filter.id}
												className="grid grid-cols-[1fr_1fr_1fr_28px] items-center gap-2"
											>
												{(['left', 'aspect', 'right'] as const).map((field) => (
													<Select
														key={field}
														value={filter[field]}
														onValueChange={(value) =>
															updateAspectFilter(filter.id, { [field]: value })
														}
													>
														<SelectTrigger className={cn(ft.inputCompact, 'min-w-0 px-2 text-xs')}>
															<SelectValue />
														</SelectTrigger>
														<SelectContent className={ft.selectContent}>
															<AnyItem />
															{field === 'aspect'
																? ASPECT_ROWS.map((aspect) => (
																		<SelectItem
																			key={aspect.id}
																			value={aspect.id}
																			className={ft.selectItem}
																		>
																			{t(aspect.labelKey)}
																		</SelectItem>
																	))
																: planetItems.map((planet) => (
																		<SelectItem
																			key={planet.id}
																			value={planet.id}
																			className={ft.selectItem}
																		>
																			{planet.label}
																		</SelectItem>
																	))}
														</SelectContent>
													</Select>
												))}
												<Button
													type="button"
													variant="ghost"
													size="icon"
													className="size-7"
													disabled={aspectFilters.length === 1}
													onClick={() =>
														setAspectFilters((current) =>
															current.filter((item) => item.id !== filter.id)
														)
													}
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
											onClick={() => {
												setAspectFilters((current) => [
													...current,
													{ id: nextAspectId, left: 'any', aspect: 'any', right: 'any' }
												]);
												setNextAspectId((value) => value + 1);
											}}
										>
											<Plus className="size-3.5" />
											{t('open_filter_add_condition')}
										</Button>
									</AccordionContent>
								</AccordionItem>

								<AccordionItem value="houses" className="border-none">
									<AccordionTrigger className="px-4 py-3 hover:no-underline sm:px-6">
										{t('open_filter_houses')}
									</AccordionTrigger>
									<AccordionContent className="px-4 sm:px-6">
										<div className="mx-auto max-w-sm">
											<div
												className={cn(
													'mb-2 grid grid-cols-[72px_1fr_80px] gap-2 text-xs font-medium',
													ft.muted
												)}
											>
												<div />
												<div>{t('open_filter_sign')}</div>
												<div>{t('open_filter_degree')}</div>
											</div>
											<div className="space-y-2">
												{Array.from({ length: 12 }, (_, index) => index + 1).map((house) => {
													const filter = houseFilters[house];
													return (
														<div
															key={house}
															className="grid grid-cols-[72px_1fr_80px] items-center gap-2"
														>
															<span className={cn('text-sm', ft.bodyText)}>
																{house}.{' '}
																{house === 1
																	? '(ASC)'
																	: house === 4
																		? '(IC)'
																		: house === 7
																			? '(DSC)'
																			: house === 10
																				? '(MC)'
																				: ''}
															</span>
															<Select
																value={filter.sign}
																onValueChange={(value) => updateHouseFilter(house, { sign: value })}
															>
																<SelectTrigger className={cn(ft.inputCompact, 'px-2 text-xs')}>
																	<SelectValue />
																</SelectTrigger>
																<SelectContent className={ft.selectContent}>
																	<AnyItem />
																	{ZODIAC_KEYS.map((key, sign) => (
																		<SelectItem
																			key={key}
																			value={String(sign)}
																			className={ft.selectItem}
																		>
																			{t(key)}
																		</SelectItem>
																	))}
																</SelectContent>
															</Select>
															<Select
																value={filter.degree}
																onValueChange={(value) =>
																	updateHouseFilter(house, { degree: value })
																}
															>
																<SelectTrigger className={cn(ft.inputCompact, 'px-2 text-xs')}>
																	<SelectValue />
																</SelectTrigger>
																<SelectContent className={ft.selectContent}>
																	<AnyItem />
																	{Array.from({ length: 30 }, (_, degree) => degree + 1).map(
																		(degree) => (
																			<SelectItem
																				key={degree}
																				value={String(degree)}
																				className={ft.selectItem}
																			>
																				{degree}°
																			</SelectItem>
																		)
																	)}
																</SelectContent>
															</Select>
														</div>
													);
												})}
											</div>
										</div>
									</AccordionContent>
								</AccordionItem>

								<AccordionItem value="shapes" className="border-none">
									<AccordionTrigger className="px-4 py-3 hover:no-underline sm:px-6">
										{t('open_filter_chart_shape')}
									</AccordionTrigger>
									<AccordionContent className="space-y-2 px-4 sm:px-6">
										{SHAPE_OPTIONS.map((option) =>
											option.group ? (
												<p
													key={option.id}
													className={cn('pt-1 text-xs font-medium', ft.muted)}
													style={{ paddingLeft: `${(option.indent ?? 0) * 16}px` }}
												>
													{t(option.labelKey)}
												</p>
											) : (
												<div
													key={option.id}
													className="flex items-center gap-2"
													style={{ paddingLeft: `${(option.indent ?? 0) * 16}px` }}
												>
													<Checkbox
														id={`shape-${option.id}`}
														checked={selectedShapes.includes(option.id)}
														onCheckedChange={() => toggleListValue(setSelectedShapes, option.id)}
													/>
													<Label
														htmlFor={`shape-${option.id}`}
														className={cn('cursor-pointer text-sm', ft.bodyText)}
													>
														{t(option.labelKey)}
													</Label>
												</div>
											)
										)}
									</AccordionContent>
								</AccordionItem>

								<AccordionItem value="configurations" className="border-none">
									<AccordionTrigger className="px-4 py-3 hover:no-underline sm:px-6">
										{t('info_planetary_configuration')}
									</AccordionTrigger>
									<AccordionContent className="space-y-2 px-4 sm:px-6">
										{CONFIGURATION_OPTIONS.map((option) => (
											<div
												key={option.id}
												className="flex items-center gap-2"
												style={{ paddingLeft: `${(option.indent ?? 0) * 16}px` }}
											>
												<Checkbox
													id={`configuration-${option.id}`}
													checked={selectedConfigurations.includes(option.id)}
													onCheckedChange={() =>
														toggleListValue(setSelectedConfigurations, option.id)
													}
												/>
												<Label
													htmlFor={`configuration-${option.id}`}
													className={cn('cursor-pointer text-sm', ft.bodyText)}
												>
													{t(option.labelKey)}
												</Label>
											</div>
										))}
									</AccordionContent>
								</AccordionItem>
							</Accordion>
						</div>
						<div
							className="absolute right-0 bottom-0 left-0 z-10 p-3 sm:px-6"
							style={{
								background:
									'linear-gradient(to top, var(--theme-secondary-sidebar-end) 0%, var(--theme-overlay-bg) 65%, transparent 100%)'
							}}
						>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className={cn('h-8 w-full text-xs', ft.footerCancel)}
								onClick={resetFilters}
							>
								{t('clear')}
							</Button>
						</div>
					</aside>

					<section className="relative flex min-w-0 flex-1 flex-col">
						<div className={cn('shrink-0 border-b px-4 sm:px-6', ft.footerBorder)}>
							<div className={cn('grid min-h-16 items-center gap-2 text-sm', gridColumns)}>
								<div />
								<div />
								<div className={cn('font-medium', ft.label)}>{t('table_name')}</div>
								<div className={cn('font-medium', ft.label)}>{t('table_chart_type')}</div>
								<div className={cn('font-medium', ft.label)}>{t('table_tags')}</div>
								<div className={cn('font-medium', ft.label)}>{t('new_date')}</div>
								<div className={cn('font-medium', ft.label)}>{t('new_time')}</div>
								<div className={cn('font-medium', ft.label)}>{t('table_place')}</div>
							</div>
						</div>
						<div className="flex-1 overflow-auto pb-16">
							{openMode === 'database' ? (
								<div className="flex min-h-full flex-col items-center justify-center gap-2 p-8 text-center">
									<p className={cn('text-lg font-medium', ft.title)}>{t('open_mode_database')}</p>
									<p className={cn('max-w-md text-sm', ft.muted)}>{t('database_placeholder')}</p>
								</div>
							) : filtered.length === 0 ? (
								<div className="flex min-h-full items-center justify-center p-8 text-center">
									<p className={cn('max-w-md text-sm', ft.muted)}>
										{charts.length === 0 ? t('open_table_empty') : t('open_search_no_results')}
									</p>
								</div>
							) : (
								filtered.map((chart) => {
									const dateTime = splitDateTime(chart.dateTime);
									return (
										<div
											key={chart.id}
											className={cn(
												'grid cursor-pointer items-center gap-2 border-b px-4 py-3 text-sm transition-colors sm:px-6',
												gridColumns,
												focusedChartId === chart.id
													? 'bg-[color:var(--theme-selected-bg)]'
													: 'hover:bg-[color:var(--token-hover-strong)]'
											)}
											onClick={() => setFocusedChartId(chart.id)}
											onDoubleClick={() => onActivateChart(chart.id)}
										>
											<div
												className="flex items-center"
												onClick={(event) => event.stopPropagation()}
											>
												<Checkbox
													checked={selectedRows.includes(chart.id)}
													onCheckedChange={() =>
														setSelectedRows((current) =>
															current.includes(chart.id)
																? current.filter((id) => id !== chart.id)
																: [...current, chart.id]
														)
													}
												/>
											</div>
											<div
												className="flex items-center"
												onClick={(event) => event.stopPropagation()}
											>
												<Button
													type="button"
													variant="ghost"
													size="icon"
													className="size-7"
													onClick={() =>
														setFavoriteIds((current) =>
															current.includes(chart.id)
																? current.filter((id) => id !== chart.id)
																: [...current, chart.id]
														)
													}
													aria-label={t('favorite')}
												>
													<Star
														className={cn(
															'size-4',
															favorites.has(chart.id)
																? 'fill-[color:var(--theme-accent)] text-[color:var(--theme-accent)]'
																: ft.muted
														)}
													/>
												</Button>
											</div>
											<div className={cn('min-w-0 truncate', ft.bodyText)}>{chart.name}</div>
											<div className={cn('min-w-0 truncate', ft.muted)}>
												{chartTypeLabel(chart, t)}
											</div>
											<div className="min-w-0">
												<div className="flex flex-wrap gap-1">
													{(chart.tags ?? []).map((tag, index) => (
														<Badge
															key={`${chart.id}-${tag}`}
															variant="outline"
															className="gap-1.5 px-2 py-0.5 text-xs"
														>
															<span
																className="size-2 rounded-full"
																style={{ backgroundColor: tagColor(chart.tagColors, tag, index) }}
															/>
															{tag}
														</Badge>
													))}
												</div>
											</div>
											<div className={cn('truncate', ft.muted)}>{dateTime.date}</div>
											<div className={cn('truncate', ft.muted)}>{dateTime.time}</div>
											<div className={cn('min-w-0 truncate', ft.muted)}>{chart.location}</div>
										</div>
									);
								})
							)}
						</div>
						<div className="absolute right-3 bottom-3 z-20 flex gap-1.5 rounded-xl border border-[color:var(--theme-panel-border)] bg-[color:var(--theme-panel-bg-solid)] p-1.5 shadow-lg">
							<Button
								type="button"
								variant="outline"
								size="icon"
								className={cn('size-8', ft.footerCancel)}
								onClick={() => void onOpenWorkspace()}
								aria-label={t('open_workspace')}
								title={t('open_workspace')}
							>
								<FolderOpen className="size-4" />
							</Button>
							<Button
								type="button"
								variant="outline"
								size="icon"
								className={cn('size-8', ft.footerCancel)}
								disabled={!focusedChartId}
								onClick={() => focusedChartId && onActivateChart(focusedChartId)}
								aria-label={t('button_open_chart')}
								title={t('button_open_chart')}
							>
								<PanelRightOpen className="size-4" />
							</Button>
						</div>
					</section>
				</div>
			</AppMainContentContainer>
		</AppMainContentRoot>
	);
}
