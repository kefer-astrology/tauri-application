import { useMemo, useState } from 'react';
import {
	ChevronDown,
	ChevronRight,
	Pencil,
	Calendar,
	Clock,
	MapPin,
	ChevronLeft,
	X
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { cn } from './ui/utils';
import { useAppFormFieldTheme } from './form-field-theme';
import { Theme } from './astrology-sidebar';
import { useWorkspaceCharts } from '../providers/workspace-charts';
import {
	HoroscopeWheel,
	type HoroscopeWheelBody,
	type HoroscopeWheelObjectHover,
	type RadixAspectDrawInput
} from './horoscope-wheel';
import { toast } from 'sonner';
import {
	DEFAULT_OBSERVABLE_OBJECT_IDS,
	OBSERVABLE_OBJECTS,
	getObservableObjectLabel,
	getObservableCategoryLabel,
	type ObservableObjectCategory
} from '@/lib/astrology/observableObjects';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { tagColor } from '@/lib/chartTags';
import type { WorkspaceDefaultsState } from '@/lib/tauri/chartPayload';
import type { ElementColors } from '@/lib/astrology/elementColors';
import { signIndexToZodiacId, type AstrologyGlyphSetId } from '@/lib/astrology/glyphs';
import { AstrologyGlyph } from '@/ui/astrology-glyph';

interface HoroscopeDashboardProps {
	theme: Theme;
	workspaceDefaults: WorkspaceDefaultsState;
	glyphSet: AstrologyGlyphSetId;
	elementColors: ElementColors;
	lightPlanetFill: string;
	onEdit?: (chart: import('@/lib/tauri/chartPayload').AppChart) => void;
	onObservableObjectsChange?: (chartId: string, bodies: string[]) => void;
}

interface PlanetPosition {
	id: string;
	label: string;
	icon: string;
	degrees: number;
	signZodiacId: string;
	signGlyphFallback: string;
	minutes: number;
	seconds: number;
	retrograde: boolean;
}

const ZODIAC_UNICODE_FALLBACK = [
	'♈',
	'♉',
	'♊',
	'♋',
	'♌',
	'♍',
	'♎',
	'♏',
	'♐',
	'♑',
	'♒',
	'♓'
] as const;

const POSITION_META: Record<string, { labelKey?: string; fallbackLabel: string; icon: string }> = {
	sun: { labelKey: 'planet_sun', fallbackLabel: 'Sun', icon: '☉' },
	moon: { labelKey: 'planet_moon', fallbackLabel: 'Moon', icon: '☽' },
	mercury: { labelKey: 'planet_mercury', fallbackLabel: 'Mercury', icon: '☿' },
	venus: { labelKey: 'planet_venus', fallbackLabel: 'Venus', icon: '♀' },
	mars: { labelKey: 'planet_mars', fallbackLabel: 'Mars', icon: '♂' },
	jupiter: { labelKey: 'planet_jupiter', fallbackLabel: 'Jupiter', icon: '♃' },
	saturn: { labelKey: 'planet_saturn', fallbackLabel: 'Saturn', icon: '♄' },
	uranus: { labelKey: 'planet_uranus', fallbackLabel: 'Uranus', icon: '♅' },
	neptune: { labelKey: 'planet_neptune', fallbackLabel: 'Neptune', icon: '♆' },
	pluto: { labelKey: 'planet_pluto', fallbackLabel: 'Pluto', icon: '♇' },
	asc: { labelKey: 'point_asc', fallbackLabel: 'ASC', icon: 'Asc' },
	desc: { labelKey: 'point_dsc', fallbackLabel: 'DSC', icon: 'Dsc' },
	mc: { labelKey: 'point_mc', fallbackLabel: 'MC', icon: 'MC' },
	ic: { labelKey: 'point_ic', fallbackLabel: 'IC', icon: 'IC' },
	north_node: { labelKey: 'point_north_node', fallbackLabel: 'North Node', icon: '☊' },
	south_node: { labelKey: 'point_south_node', fallbackLabel: 'South Node', icon: '☋' },
	true_north_node: {
		labelKey: 'point_true_north_node',
		fallbackLabel: 'True North Node',
		icon: '☊'
	},
	true_south_node: {
		labelKey: 'point_true_south_node',
		fallbackLabel: 'True South Node',
		icon: '☋'
	},
	lilith: { labelKey: 'point_lilith', fallbackLabel: 'Lilith', icon: '⚸' },
	chiron: { labelKey: 'point_chiron', fallbackLabel: 'Chiron', icon: '⚷' },
	ceres: { labelKey: 'point_ceres', fallbackLabel: 'Ceres', icon: 'Ce' },
	pallas: { labelKey: 'point_pallas', fallbackLabel: 'Pallas', icon: 'Pa' },
	juno: { labelKey: 'point_juno', fallbackLabel: 'Juno', icon: 'Ju' },
	vesta: { labelKey: 'point_vesta', fallbackLabel: 'Vesta', icon: 'Ve' }
};

function parseRadixAspect(raw: unknown): RadixAspectDrawInput | null {
	if (!raw || typeof raw !== 'object') return null;
	const o = raw as Record<string, unknown>;
	const from = typeof o.from === 'string' ? o.from : null;
	const to = typeof o.to === 'string' ? o.to : null;
	const type = typeof o.type === 'string' ? o.type : null;
	const orbRaw = o.orb;
	const orb =
		typeof orbRaw === 'number' ? orbRaw : typeof orbRaw === 'string' ? Number(orbRaw) : NaN;
	if (!from || !to || !type || !Number.isFinite(orb)) return null;
	return { from, to, type, orb };
}

const ANGLE_POSITION_IDS = new Set(
	OBSERVABLE_OBJECTS.filter((item) => item.category === 'angles').map((item) => item.id)
);

function normalizeLongitude(value: unknown): number | null {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return ((value % 360) + 360) % 360;
	}
	if (value && typeof value === 'object') {
		const longitude = (value as { longitude?: unknown }).longitude;
		if (typeof longitude === 'number' && Number.isFinite(longitude)) {
			return ((longitude % 360) + 360) % 360;
		}
	}
	return null;
}

function longitudeToPosition(
	id: string,
	longitude: number,
	retrograde: boolean,
	t: (key: string) => string
): PlanetPosition {
	const withinSign = longitude % 30;
	const totalSeconds = Math.round(withinSign * 3600);
	const degrees = Math.floor(totalSeconds / 3600) % 30;
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	const signIndex = Math.floor(longitude / 30) % 12;
	const meta = POSITION_META[id] ?? { fallbackLabel: id, icon: id.slice(0, 3) };
	return {
		id,
		label: meta.labelKey ? t(meta.labelKey) : meta.fallbackLabel,
		icon: meta.icon,
		degrees,
		signZodiacId: signIndexToZodiacId(signIndex),
		signGlyphFallback: ZODIAC_UNICODE_FALLBACK[signIndex] ?? '♈',
		minutes,
		seconds,
		retrograde
	};
}

function parseChartDateTime(value?: string): Date | null {
	if (!value?.trim()) return null;
	const direct = new Date(value);
	if (!Number.isNaN(direct.getTime())) return direct;

	const normalized = value.includes('T')
		? value
		: /^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}(?::\d{2})?)$/.test(value)
			? value.replace(' ', 'T') + 'Z'
			: value;
	const normalizedDate = new Date(normalized);
	if (!Number.isNaN(normalizedDate.getTime())) return normalizedDate;

	const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
	if (!match) return null;

	const [, dd, mm, yyyy, hh = '00', min = '00', ss = '00'] = match;
	return new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min), Number(ss));
}

function formatCoords(latitude?: number, longitude?: number) {
	if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
	return `${latitude!.toFixed(4)}, ${longitude!.toFixed(4)}`;
}

export function HoroscopeDashboard({
	theme,
	workspaceDefaults,
	glyphSet,
	elementColors,
	lightPlanetFill,
	onEdit,
	onObservableObjectsChange
}: HoroscopeDashboardProps) {
	const { t, i18n } = useTranslation();
	const { selectedChart, shiftSelectedChartTime, transitOverlay, clearTransitOverlay } =
		useWorkspaceCharts();
	const ft = useAppFormFieldTheme(theme);
	const [profileCollapsed, setProfileCollapsed] = useState(false);
	const [astrolabeCollapsed, setAstrolabeCollapsed] = useState(false);
	const [positionsCollapsed, setPositionsCollapsed] = useState(false);
	const [timeUnit, setTimeUnit] = useState<'sec' | 'min' | 'hr' | 'day' | 'month' | 'yr'>('day');
	const [timeAmount, setTimeAmount] = useState(1);
	const [showPositionModal, setShowPositionModal] = useState(false);
	const [pickerBodies, setPickerBodies] = useState<string[]>([]);
	const [isSteppingTime, setIsSteppingTime] = useState(false);
	const [hoveredWheelObject, setHoveredWheelObject] = useState<HoroscopeWheelObjectHover | null>(
		null
	);

	const observableCategories = useMemo(() => {
		const categoryOrder: ObservableObjectCategory[] = [
			'luminaries',
			'personal_planets',
			'social_outer_planets',
			'angles',
			'lunar_nodes',
			'calculated_points',
			'asteroids'
		];
		return categoryOrder.map((category) => ({
			id: category,
			label: getObservableCategoryLabel(category, t),
			items: OBSERVABLE_OBJECTS.filter((item) => item.category === category)
		}));
	}, [t]);

	const borderColor = 'border-[color:var(--token-border-subtle)]';
	const textColor = ft.title;
	const mutedColor = ft.muted;
	const hoverBg = 'hover:bg-[color:var(--token-hover-subtle)]';
	const controlRow = cn(
		'flex items-center gap-2 rounded-xl border px-3 py-2',
		borderColor,
		'bg-[color:var(--token-surface-subtle)]'
	);
	const nativeSelect = cn(
		ft.inputCompact,
		'h-9 w-full min-w-0 flex-1 text-sm rounded-xl [color-scheme:inherit]'
	);
	const panelCardClass = 'gap-0 overflow-hidden transition-all duration-300';
	const parsedChartDateTime = parseChartDateTime(selectedChart?.dateTime);
	const activeTransitOverlay =
		transitOverlay && transitOverlay.sourceChartId === selectedChart?.id ? transitOverlay : null;
	const parsedTransitDateTime = parseChartDateTime(activeTransitOverlay?.dateTime);
	const chartTypeLabel =
		selectedChart?.chartType === 'EVENT'
			? t('new_type_event')
			: selectedChart?.chartType === 'HORARY'
				? t('new_type_horary')
				: t('new_type_radix');
	const chartDateLabel =
		parsedChartDateTime?.toLocaleDateString(i18n.language, {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		}) ??
		selectedChart?.dateTime?.split(' ')[0] ??
		t('demo_chart_date_line');
	const chartTimeLabel =
		parsedChartDateTime?.toLocaleTimeString(i18n.language, {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		}) ??
		selectedChart?.dateTime?.split(' ').slice(1).join(' ') ??
		t('demo_chart_time_line');
	const transitDateTimeLabel =
		parsedTransitDateTime?.toLocaleString(i18n.language, {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		}) ??
		activeTransitOverlay?.dateTime ??
		'';
	const chartLocationLabel = selectedChart?.location || t('demo_chart_location');
	const chartCoordsLabel =
		formatCoords(selectedChart?.latitude, selectedChart?.longitude) ?? t('demo_chart_coords');
	const chartHouseSystemLabel =
		[selectedChart?.zodiacType, selectedChart?.houseSystem].filter(Boolean).join(' / ') ||
		t('demo_chart_house_system');
	const chartTags = selectedChart?.tags?.filter(Boolean) ?? [];
	const computedPositions = (selectedChart?.computed?.positions ?? {}) as Record<string, unknown>;
	const computedMotion = selectedChart?.computed?.motion ?? {};
	const computedAxes = selectedChart?.computed?.axes;
	const positionOrder =
		selectedChart?.observableObjects && selectedChart.observableObjects.length > 0
			? selectedChart.observableObjects
			: workspaceDefaults.defaultBodies.length > 0
				? workspaceDefaults.defaultBodies
				: DEFAULT_OBSERVABLE_OBJECT_IDS;
	const enabledPositionIds = new Set(positionOrder);
	const showAsc = enabledPositionIds.has('asc');
	const showDsc = enabledPositionIds.has('desc');
	const showMc = enabledPositionIds.has('mc');
	const showIc = enabledPositionIds.has('ic');
	const chartAscLongitude =
		normalizeLongitude(computedAxes?.asc ?? computedPositions.asc) ?? undefined;
	const axisLongitudes = {
		asc: showAsc ? chartAscLongitude : undefined,
		dsc: showDsc
			? (normalizeLongitude(computedAxes?.desc ?? computedPositions.desc) ?? undefined)
			: undefined,
		mc: showMc
			? (normalizeLongitude(computedAxes?.mc ?? computedPositions.mc) ?? undefined)
			: undefined,
		ic: showIc
			? (normalizeLongitude(computedAxes?.ic ?? computedPositions.ic) ?? undefined)
			: undefined
	};
	const wheelBodyOrder: HoroscopeWheelBody[] = positionOrder.filter(
		(id) => !ANGLE_POSITION_IDS.has(id)
	);
	const wheelBodyLongitudes = Object.fromEntries(
		wheelBodyOrder
			.map((body) => {
				const longitude = normalizeLongitude(computedPositions[body]);
				return [body, longitude];
			})
			.filter((entry): entry is [HoroscopeWheelBody, number] => entry[1] !== null)
	) as Partial<Record<string, number>>;
	const positionRows: PlanetPosition[] = positionOrder.flatMap((id) => {
		const longitude = normalizeLongitude(computedPositions[id]);
		const retrograde = computedMotion[id]?.retrograde ?? false;
		return longitude === null ? [] : [longitudeToPosition(id, longitude, retrograde, t)];
	});
	const showAxisLines = showAsc || showDsc || showMc || showIc;

	const radixAspects: RadixAspectDrawInput[] = (selectedChart?.computed?.aspects ?? [])
		.map(parseRadixAspect)
		.filter((a): a is RadixAspectDrawInput => a !== null);
	const transitPositions = (activeTransitOverlay?.transitChart.computed?.positions ?? {}) as Record<
		string,
		unknown
	>;
	const transitWheelBodyOrder: HoroscopeWheelBody[] = activeTransitOverlay?.transitingBodies ?? [];
	const transitWheelBodyLongitudes = Object.fromEntries(
		transitWheelBodyOrder
			.map((body) => {
				const longitude = normalizeLongitude(transitPositions[body]);
				return [body, longitude];
			})
			.filter((entry): entry is [HoroscopeWheelBody, number] => entry[1] !== null)
	) as Partial<Record<string, number>>;
	const hoveredWheelDetails = useMemo(() => {
		if (!hoveredWheelObject) return null;
		const sourcePositions =
			hoveredWheelObject.layer === 'transit' ? transitPositions : computedPositions;
		const sourceMotion =
			hoveredWheelObject.layer === 'transit'
				? (activeTransitOverlay?.transitChart.computed?.motion ?? {})
				: computedMotion;
		const longitude = normalizeLongitude(sourcePositions[hoveredWheelObject.bodyId]);
		if (longitude === null) return null;
		const position = longitudeToPosition(
			hoveredWheelObject.bodyId,
			longitude,
			sourceMotion[hoveredWheelObject.bodyId]?.retrograde ?? false,
			t
		);
		const layerLabel =
			hoveredWheelObject.layer === 'transit'
				? t('transits_general_transit_transit')
				: (selectedChart?.name ?? t('new_type_radix'));
		return {
			...hoveredWheelObject,
			longitude,
			position,
			layerLabel
		};
	}, [
		activeTransitOverlay?.transitChart.computed?.motion,
		computedMotion,
		computedPositions,
		hoveredWheelObject,
		selectedChart?.name,
		t,
		transitPositions
	]);
	const hoveredWheelTooltipStyle = hoveredWheelDetails
		? {
				left: Math.max(
					8,
					Math.min(
						hoveredWheelDetails.clientX + 14,
						(typeof window === 'undefined' ? 1200 : window.innerWidth) - 260
					)
				),
				top: Math.max(
					8,
					Math.min(
						hoveredWheelDetails.clientY + 14,
						(typeof window === 'undefined' ? 800 : window.innerHeight) - 142
					)
				)
			}
		: undefined;

	const getMaxAmount = () => {
		if (timeUnit === 'sec' || timeUnit === 'min' || timeUnit === 'yr') return 10;
		if (timeUnit === 'hr') return 12;
		if (timeUnit === 'month') return 12;
		return 30; // day
	};

	const stepChartTime = async (direction: -1 | 1) => {
		if (!selectedChart || isSteppingTime) return;
		setIsSteppingTime(true);
		try {
			await shiftSelectedChartTime({
				unit: timeUnit,
				amount: timeAmount * direction
			});
		} catch (error) {
			console.error('Astrolabe time step failed:', error);
			toast.error(t('toast_save_failed'), {
				description: error instanceof Error ? error.message : String(error)
			});
		} finally {
			setIsSteppingTime(false);
		}
	};

	return (
		<div className="flex h-full min-h-0 flex-col overflow-hidden" data-tour="radix-workspace">
			{/* Main Content - 3 Column Layout */}
			<div className="grid min-h-0 flex-1 grid-cols-[288px_minmax(0,1fr)_224px] gap-6 overflow-hidden p-4">
				{/* Left Column */}
				<div className="flex min-h-0 min-w-0 flex-col gap-4">
					{/* Profile Panel */}
					<Card variant="themed" theme={theme} className={panelCardClass} data-tour="radix-profile">
						<div
							className={`flex items-center justify-between px-4 py-3 ${hoverBg} cursor-pointer`}
							onClick={() => setProfileCollapsed(!profileCollapsed)}
						>
							<div className="flex items-center gap-2">
								{profileCollapsed ? (
									<ChevronRight className={`h-4 w-4 ${mutedColor}`} />
								) : (
									<ChevronDown className={`h-4 w-4 ${mutedColor}`} />
								)}
								<h3 className={cn('font-medium', textColor)}>
									{selectedChart?.name ?? t('demo_chart_name')}
								</h3>
							</div>
							<Button
								variant="ghost"
								size="icon"
								className={cn('rounded-lg', hoverBg)}
								disabled={!selectedChart}
								onClick={(e) => {
									e.stopPropagation();
									if (selectedChart) onEdit?.(selectedChart);
								}}
							>
								<Pencil className={`h-4 w-4 ${mutedColor}`} />
							</Button>
						</div>

						{!profileCollapsed && (
							<div className="space-y-3 px-4 pb-4">
								<div className={cn('space-y-1 text-sm', mutedColor)}>
									<div>{chartTypeLabel}</div>
									<div>{chartDateLabel}</div>
									<div>{chartTimeLabel}</div>
									<div>{chartLocationLabel}</div>
									<div>{chartCoordsLabel}</div>
									<div>{chartHouseSystemLabel}</div>
								</div>

								{chartTags.length > 0 ? (
									<div className="flex flex-wrap gap-2 pt-2">
										{chartTags.map((tag, index) => (
											<Badge key={tag} variant="outline" className="gap-1.5 px-2 py-1 text-xs">
												<span
													className="h-2 w-2 rounded-full"
													style={{
														backgroundColor: tagColor(selectedChart?.tagColors, tag, index)
													}}
												/>
												{tag}
											</Badge>
										))}
									</div>
								) : null}
								{activeTransitOverlay ? (
									<div
										className={cn(
											'mt-3 flex items-center justify-between gap-3 rounded-xl border px-3 py-2',
											borderColor,
											'bg-[color:var(--theme-soft-bg)]/50'
										)}
									>
										<div className="min-w-0">
											<div className={cn('truncate text-xs font-semibold', textColor)}>
												{t('transit_overlay_label')}
											</div>
											<div className={cn('truncate text-xs', mutedColor)}>
												{t('transits_period_to')}: {transitDateTimeLabel}
											</div>
										</div>
										<Button
											type="button"
											variant="ghost"
											size="icon"
											className={cn('h-7 w-7 shrink-0 rounded-lg', hoverBg)}
											onClick={(event) => {
												event.stopPropagation();
												clearTransitOverlay();
											}}
											aria-label={t('transit_overlay_clear')}
										>
											<X className={cn('h-3.5 w-3.5', mutedColor)} />
										</Button>
									</div>
								) : null}
							</div>
						)}
					</Card>

					{/* Astrolabe Panel */}
					<Card
						variant="themed"
						theme={theme}
						className={panelCardClass}
						data-tour="radix-astrolabe"
					>
						<div
							className={`flex items-center justify-between px-4 py-3 ${hoverBg} cursor-pointer`}
							onClick={() => setAstrolabeCollapsed(!astrolabeCollapsed)}
						>
							<div className="flex items-center gap-2">
								{astrolabeCollapsed ? (
									<ChevronRight className={`h-4 w-4 ${mutedColor}`} />
								) : (
									<ChevronDown className={`h-4 w-4 ${mutedColor}`} />
								)}
								<h3 className={`font-medium ${textColor}`}>{t('astrolabe')}</h3>
							</div>
						</div>

						{!astrolabeCollapsed && (
							<div className="space-y-3 px-4 pb-4">
								{/* Time Stepper */}
								<div className="flex items-center gap-2">
									<Button
										variant="outline"
										size="icon"
										className={cn('rounded-full', borderColor, hoverBg, textColor)}
										onClick={() => void stepChartTime(-1)}
										disabled={isSteppingTime || !selectedChart}
									>
										<ChevronLeft className="h-4 w-4" />
									</Button>

									<Select
										value={String(timeAmount)}
										onValueChange={(value) => setTimeAmount(Number(value))}
									>
										<SelectTrigger className={nativeSelect}>
											<SelectValue />
										</SelectTrigger>
										<SelectContent className={ft.selectContent}>
											{Array.from({ length: getMaxAmount() }, (_, i) => i + 1).map((n) => (
												<SelectItem key={n} value={String(n)} className={ft.selectItem}>
													{n}
												</SelectItem>
											))}
										</SelectContent>
									</Select>

									<Select
										value={timeUnit}
										onValueChange={(value) =>
											setTimeUnit(value as 'sec' | 'min' | 'hr' | 'day' | 'month' | 'yr')
										}
									>
										<SelectTrigger className={nativeSelect}>
											<SelectValue />
										</SelectTrigger>
										<SelectContent className={ft.selectContent}>
											<SelectItem value="sec" className={ft.selectItem}>
												{t('astrolabe_unit_sec')}
											</SelectItem>
											<SelectItem value="min" className={ft.selectItem}>
												{t('astrolabe_unit_min')}
											</SelectItem>
											<SelectItem value="hr" className={ft.selectItem}>
												{t('astrolabe_unit_hr')}
											</SelectItem>
											<SelectItem value="day" className={ft.selectItem}>
												{t('astrolabe_unit_day')}
											</SelectItem>
											<SelectItem value="month" className={ft.selectItem}>
												{t('astrolabe_unit_month')}
											</SelectItem>
											<SelectItem value="yr" className={ft.selectItem}>
												{t('astrolabe_unit_yr')}
											</SelectItem>
										</SelectContent>
									</Select>

									<Button
										variant="outline"
										size="icon"
										className={cn('rounded-full', borderColor, hoverBg, textColor)}
										onClick={() => void stepChartTime(1)}
										disabled={isSteppingTime || !selectedChart}
									>
										<ChevronRight className="h-4 w-4" />
									</Button>
								</div>

								{/* Date Input */}
								<div className={controlRow}>
									<Input
										readOnly
										value={chartDateLabel}
										className={cn(
											ft.input,
											'flex-1 cursor-default border-0 bg-transparent px-0 py-0 text-sm shadow-none focus-visible:ring-0'
										)}
									/>
									<Calendar className={cn('h-4 w-4 shrink-0', mutedColor)} />
								</div>

								<div className={controlRow}>
									<Input
										readOnly
										value={chartTimeLabel}
										className={cn(
											ft.input,
											'flex-1 cursor-default border-0 bg-transparent px-0 py-0 text-sm shadow-none focus-visible:ring-0'
										)}
									/>
									<Clock className={cn('h-4 w-4 shrink-0', mutedColor)} />
								</div>

								<div className={controlRow}>
									<Input
										readOnly
										value={chartLocationLabel}
										className={cn(
											ft.input,
											'flex-1 cursor-default border-0 bg-transparent px-0 py-0 text-sm shadow-none focus-visible:ring-0'
										)}
									/>
									<MapPin className={cn('h-4 w-4 shrink-0', mutedColor)} />
								</div>
							</div>
						)}
					</Card>
				</div>

				{/* Center Column - Full middle track */}
				<div
					className="flex min-h-0 min-w-0 items-center justify-center overflow-hidden"
					data-tour="radix-wheel"
				>
					<div className="aspect-square h-full max-h-full w-full max-w-full">
						<HoroscopeWheel
							theme={theme}
							glyphSet={glyphSet}
							elementColors={elementColors}
							lightPlanetFill={lightPlanetFill}
							bodyLongitudes={wheelBodyLongitudes}
							bodyOrder={wheelBodyOrder}
							transitBodyLongitudes={transitWheelBodyLongitudes}
							transitBodyOrder={transitWheelBodyOrder}
							axisLongitudes={axisLongitudes}
							houseCusps={selectedChart?.computed?.houseCusps}
							ascRotationLongitude={chartAscLongitude}
							useFallbackData={false}
							showPlanetGlyphs
							showAxisLines={showAxisLines}
							radixAspects={radixAspects}
							aspectOrbsForRadix={workspaceDefaults.defaultAspectOrbs}
							aspectColorsForRadix={workspaceDefaults.defaultAspectColors}
							aspectLineTierStyle={workspaceDefaults.aspectLineTierStyle}
							onObjectHover={setHoveredWheelObject}
							onObjectHoverEnd={() => setHoveredWheelObject(null)}
						/>
					</div>
				</div>

				{/* Right Column */}
				<div className="min-h-0 min-w-0">
					<Card
						data-tour="radix-positions"
						variant="themed"
						theme={theme}
						className={cn(panelCardClass, positionsCollapsed ? '' : 'flex h-full flex-col')}
					>
						<div
							className={`flex items-center justify-between px-4 py-3 ${hoverBg} flex-shrink-0 cursor-pointer`}
							onClick={() => setPositionsCollapsed(!positionsCollapsed)}
						>
							<div className="flex items-center gap-2">
								{positionsCollapsed ? (
									<ChevronRight className={`h-4 w-4 ${mutedColor}`} />
								) : (
									<ChevronDown className={`h-4 w-4 ${mutedColor}`} />
								)}
								<h3 className={`font-medium ${textColor}`}>{t('right_panel')}</h3>
							</div>
							<Button
								variant="ghost"
								size="icon"
								className={cn('rounded-lg', hoverBg)}
								onClick={(e) => {
									e.stopPropagation();
									setPickerBodies(
										selectedChart?.observableObjects ?? workspaceDefaults.defaultBodies
									);
									setShowPositionModal(true);
								}}
							>
								<Pencil className={`h-4 w-4 ${mutedColor}`} />
							</Button>
						</div>

						{!positionsCollapsed && (
							<div className="flex-1 overflow-y-auto px-4 pb-4">
								{positionRows.length > 0 ? (
									<>
										<div className="space-y-1.5">
											{positionRows.map((pos) => (
												<div
													key={pos.id}
													className={cn(
														'flex items-center gap-0.5',
														textColor,
														'font-mono text-sm leading-none tabular-nums'
													)}
													title={pos.label}
												>
													<span
														className={cn(
															'inline-flex h-[1.125rem] w-8 shrink-0 items-center justify-center',
															pos.icon.length > 2 ? 'text-[10px] font-semibold' : ''
														)}
													>
														<AstrologyGlyph
															glyphId={pos.id}
															glyphSet={glyphSet}
															fallback={pos.icon}
															size={18}
															title={pos.label}
															className="leading-none"
														/>
													</span>
													<span className="w-12 text-right">{pos.degrees}°</span>
													<span className="inline-flex h-[1.125rem] w-8 shrink-0 items-center justify-center">
														<AstrologyGlyph
															glyphId={pos.signZodiacId}
															glyphSet={glyphSet}
															domain="zodiac"
															fallback={pos.signGlyphFallback}
															size={18}
															title={pos.signZodiacId}
															className="leading-none"
														/>
													</span>
													<span className="w-10 text-right">{pos.minutes}'</span>
													<span className="w-10 text-right">{pos.seconds}"</span>
													<span className="w-6 text-center text-[10px] font-semibold text-[color:var(--theme-accent)] uppercase">
														{pos.retrograde ? 'R' : ''}
													</span>
												</div>
											))}
										</div>
										<div className={`text-center text-xs ${mutedColor} mt-3 italic`}>
											{t('dashboard_positions_scroll_hint')}
										</div>
									</>
								) : (
									<div className={cn('py-6 text-sm', mutedColor)}>
										{t('dashboard_no_positions')}
									</div>
								)}
							</div>
						)}
					</Card>
				</div>
			</div>

			{hoveredWheelDetails && hoveredWheelTooltipStyle ? (
				<div
					className={cn(
						'pointer-events-none fixed z-[60] w-64 rounded-lg border px-3 py-2.5 shadow-xl backdrop-blur-md',
						borderColor,
						'bg-[color:var(--theme-panel-bg)]/95'
					)}
					style={hoveredWheelTooltipStyle}
				>
					<div className="mb-2 flex items-center justify-between gap-3">
						<div className="flex min-w-0 items-center gap-2">
							<AstrologyGlyph
								glyphId={hoveredWheelDetails.bodyId}
								glyphSet={glyphSet}
								fallback={hoveredWheelDetails.position.icon}
								size={18}
								title={hoveredWheelDetails.position.label}
								className="shrink-0"
							/>
							<div className={cn('truncate text-sm font-semibold', textColor)}>
								{hoveredWheelDetails.position.label}
							</div>
						</div>
						<div className={cn('shrink-0 text-[11px] font-medium', mutedColor)}>
							{hoveredWheelDetails.layerLabel}
						</div>
					</div>
					<div className="space-y-1 font-mono text-xs tabular-nums">
						<div className="flex items-center justify-between gap-3">
							<span className={mutedColor}>{t('aspectarium_position')}</span>
							<span className={cn('flex items-center gap-1', textColor)}>
								{hoveredWheelDetails.position.degrees}°
								<AstrologyGlyph
									glyphId={hoveredWheelDetails.position.signZodiacId}
									glyphSet={glyphSet}
									domain="zodiac"
									fallback={hoveredWheelDetails.position.signGlyphFallback}
									size={16}
									title={hoveredWheelDetails.position.signZodiacId}
								/>
								{hoveredWheelDetails.position.minutes}' {hoveredWheelDetails.position.seconds}"
							</span>
						</div>
						<div className="flex items-center justify-between gap-3">
							<span className={mutedColor}>{t('aspectarium_absolute_longitude')}</span>
							<span className={textColor}>{hoveredWheelDetails.longitude.toFixed(2)}°</span>
						</div>
						<div className="flex items-center justify-between gap-3">
							<span className={mutedColor}>{t('open_filter_motion')}</span>
							<span className={textColor}>
								{hoveredWheelDetails.position.retrograde ? 'R' : 'D'}
							</span>
						</div>
					</div>
				</div>
			) : null}

			{/* Position Selection Modal */}
			{showPositionModal && (
				<div className="popup-backdrop fixed inset-0 z-50 flex items-center justify-center">
					<Card
						variant="themed"
						theme={theme}
						className="max-h-[80vh] w-[min(100vw-2rem,500px)] gap-0 overflow-hidden"
					>
						<div className={`flex items-center justify-between border-b px-6 py-4 ${borderColor}`}>
							<h3 className={`text-lg font-medium ${textColor}`}>
								{t('dashboard_positions_picker_title')}
							</h3>
							<Button
								variant="ghost"
								size="icon"
								onClick={() => setShowPositionModal(false)}
								className={cn('rounded-lg', hoverBg)}
							>
								<X className={`h-5 w-5 ${mutedColor}`} />
							</Button>
						</div>
						<div className="max-h-[60vh] space-y-4 overflow-y-auto px-6 py-4">
							<p className={`text-sm ${mutedColor}`}>{t('dashboard_positions_picker_hint')}</p>
							<div className="grid gap-4 md:grid-cols-2">
								{observableCategories.map((category) => (
									<div
										key={category.id}
										className="rounded-xl bg-[color:var(--theme-soft-bg)]/45 p-4"
									>
										<h3 className={`mb-3 text-sm font-semibold ${textColor}`}>{category.label}</h3>
										<div className="space-y-2">
											{category.items.map((item) => (
												<Label
													key={item.id}
													className="flex cursor-pointer items-center gap-3 text-sm"
												>
													<Checkbox
														checked={pickerBodies.includes(item.id)}
														onCheckedChange={() =>
															setPickerBodies((prev) =>
																prev.includes(item.id)
																	? prev.filter((id) => id !== item.id)
																	: [...prev, item.id]
															)
														}
													/>
													<AstrologyGlyph
														glyphId={item.id}
														glyphSet={glyphSet}
														fallback={item.icon}
														size={18}
														className="text-foreground"
														title={getObservableObjectLabel(item, t)}
													/>
													<span className={mutedColor}>{getObservableObjectLabel(item, t)}</span>
												</Label>
											))}
										</div>
									</div>
								))}
							</div>
						</div>
						<div className={cn('flex justify-end gap-3 border-t px-6 py-4', ft.footerBorder)}>
							<Button
								type="button"
								variant="outline"
								onClick={() => setShowPositionModal(false)}
								className={cn(ft.footerCancel, '!flex-none')}
							>
								{t('cancel')}
							</Button>
							<Button
								type="button"
								className={cn(ft.footerPrimary, '!flex-none')}
								onClick={() => {
									if (selectedChart) {
										onObservableObjectsChange?.(selectedChart.id, pickerBodies);
									}
									setShowPositionModal(false);
								}}
							>
								{t('sidebar_save')}
							</Button>
						</div>
					</Card>
				</div>
			)}
		</div>
	);
}
