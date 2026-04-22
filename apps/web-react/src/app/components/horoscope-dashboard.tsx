import { useState } from 'react';
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
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { cn } from './ui/utils';
import { useAppFormFieldTheme } from './form-field-theme';
import { HoroscopeContextTabs } from './horoscope-context-tabs';
import { Theme } from './astrology-sidebar';
import { useWorkspaceCharts } from '../providers/workspace-charts';
import { HoroscopeWheel, type HoroscopeWheelBody } from './horoscope-wheel';

interface HoroscopeDashboardProps {
	theme: Theme;
}

interface PlanetPosition {
	id: string;
	label: string;
	icon: string;
	degrees: number;
	signIcon: string;
	minutes: number;
	seconds: number;
}

const SIGN_GLYPHS = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];

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
	asc: { fallbackLabel: 'Asc', icon: 'Asc' },
	desc: { fallbackLabel: 'Dsc', icon: 'Dsc' },
	mc: { fallbackLabel: 'MC', icon: 'MC' },
	ic: { fallbackLabel: 'IC', icon: 'IC' }
};

const WHEEL_BODY_ORDER: HoroscopeWheelBody[] = [
	'sun',
	'moon',
	'mercury',
	'venus',
	'mars',
	'jupiter',
	'saturn',
	'uranus',
	'neptune',
	'pluto'
];

const SIDEBAR_POSITION_ORDER = [...WHEEL_BODY_ORDER, 'asc', 'mc', 'desc', 'ic'] as const;

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

function longitudeToPosition(id: string, longitude: number, t: (key: string) => string): PlanetPosition {
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
		signIcon: SIGN_GLYPHS[signIndex] ?? '♈',
		minutes,
		seconds
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

	const match = value.match(
		/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/
	);
	if (!match) return null;

	const [, dd, mm, yyyy, hh = '00', min = '00', ss = '00'] = match;
	return new Date(
		Number(yyyy),
		Number(mm) - 1,
		Number(dd),
		Number(hh),
		Number(min),
		Number(ss)
	);
}

function formatCoords(latitude?: number, longitude?: number) {
	if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
	return `${latitude!.toFixed(4)}, ${longitude!.toFixed(4)}`;
}

export function HoroscopeDashboard({ theme }: HoroscopeDashboardProps) {
	const { t, i18n } = useTranslation();
	const { selectedChart } = useWorkspaceCharts();
	const ft = useAppFormFieldTheme(theme);
	const [profileCollapsed, setProfileCollapsed] = useState(false);
	const [astrolabeCollapsed, setAstrolabeCollapsed] = useState(false);
	const [positionsCollapsed, setPositionsCollapsed] = useState(false);
	const [timeUnit, setTimeUnit] = useState<'sec' | 'min' | 'hr' | 'day' | 'month' | 'yr'>('day');
	const [timeAmount, setTimeAmount] = useState(1);
	const [showPositionModal, setShowPositionModal] = useState(false);

	const isDark = theme === 'midnight' || theme === 'twilight';

	const borderColor = isDark ? 'border-white/10' : 'border-gray-200';
	const textColor = ft.title;
	const mutedColor = ft.muted;
	const hoverBg = isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50';
	const controlRow = cn(
		'flex items-center gap-2 rounded-xl border px-3 py-2',
		borderColor,
		isDark ? 'bg-white/5' : 'bg-gray-50'
	);
	const nativeSelect = cn(
		ft.inputCompact,
		'h-9 w-full min-w-0 flex-1 text-sm rounded-xl [color-scheme:inherit]'
	);
	const panelCardClass = 'gap-0 overflow-hidden transition-all duration-300';
	const parsedChartDateTime = parseChartDateTime(selectedChart?.dateTime);
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
		}) ?? selectedChart?.dateTime?.split(' ')[0] ?? t('demo_chart_date_line');
	const chartTimeLabel =
		parsedChartDateTime?.toLocaleTimeString(i18n.language, {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		}) ?? selectedChart?.dateTime?.split(' ').slice(1).join(' ') ?? t('demo_chart_time_line');
	const chartLocationLabel = selectedChart?.location || t('demo_chart_location');
	const chartCoordsLabel =
		formatCoords(selectedChart?.latitude, selectedChart?.longitude) ?? t('demo_chart_coords');
	const chartHouseSystemLabel =
		[selectedChart?.zodiacType, selectedChart?.houseSystem].filter(Boolean).join(' / ') ||
		t('demo_chart_house_system');
	const chartTags = selectedChart?.tags?.filter(Boolean) ?? [];
	const computedPositions = (selectedChart?.computed?.positions ?? {}) as Record<string, unknown>;
	const computedAxes = selectedChart?.computed?.axes;
	const wheelBodyLongitudes = Object.fromEntries(
		WHEEL_BODY_ORDER.map((body) => {
			const longitude = normalizeLongitude(computedPositions[body]);
			return [body, longitude];
		}).filter((entry): entry is [HoroscopeWheelBody, number] => entry[1] !== null)
	) as Partial<Record<HoroscopeWheelBody, number>>;
	const axisLongitudes = {
		asc: normalizeLongitude(computedAxes?.asc ?? computedPositions.asc) ?? undefined,
		dsc: normalizeLongitude(computedAxes?.desc ?? computedPositions.desc) ?? undefined,
		mc: normalizeLongitude(computedAxes?.mc ?? computedPositions.mc) ?? undefined,
		ic: normalizeLongitude(computedAxes?.ic ?? computedPositions.ic) ?? undefined
	};
	const positionRows: PlanetPosition[] = SIDEBAR_POSITION_ORDER.flatMap((id) => {
		const longitude = normalizeLongitude(computedPositions[id]);
		return longitude === null ? [] : [longitudeToPosition(id, longitude, t)];
	});

	const getMaxAmount = () => {
		if (timeUnit === 'sec' || timeUnit === 'min' || timeUnit === 'yr') return 10;
		if (timeUnit === 'hr') return 12;
		if (timeUnit === 'month') return 12;
		return 30; // day
	};

	return (
		<div className="flex h-screen flex-col overflow-hidden">
			{/* Main Content - 3 Column Layout */}
			<div className="grid min-h-0 flex-1 grid-cols-[288px_minmax(0,1fr)_224px] gap-6 overflow-hidden p-4">
				{/* Left Column */}
				<div className="flex min-h-0 min-w-0 flex-col gap-4">
					{/* Profile Panel */}
					<Card variant="themed" theme={theme} className={panelCardClass}>
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
							<button
								className={`rounded-lg p-1.5 ${hoverBg}`}
								onClick={(e) => e.stopPropagation()}
							>
								<Pencil className={`h-4 w-4 ${mutedColor}`} />
							</button>
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
										{chartTags.map((tag) => (
											<Badge key={tag} variant="outline" className="px-2 py-1 text-xs">
												{tag}
											</Badge>
										))}
									</div>
								) : null}
							</div>
						)}
					</Card>

					{/* Astrolabe Panel */}
					<Card variant="themed" theme={theme} className={panelCardClass}>
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
									<button
										className={`rounded-full border p-2 ${borderColor} ${hoverBg} ${textColor}`}
									>
										<ChevronLeft className="h-4 w-4" />
									</button>

									<select
										value={timeAmount}
										onChange={(e) => setTimeAmount(Number(e.target.value))}
										className={nativeSelect}
									>
										{Array.from({ length: getMaxAmount() }, (_, i) => i + 1).map((n) => (
											<option key={n} value={n}>
												{n}
											</option>
										))}
									</select>

									<select
										value={timeUnit}
										onChange={(e) =>
											setTimeUnit(e.target.value as 'sec' | 'min' | 'hr' | 'day' | 'month' | 'yr')
										}
										className={nativeSelect}
									>
										<option value="sec">{t('astrolabe_unit_sec')}</option>
										<option value="min">{t('astrolabe_unit_min')}</option>
										<option value="hr">{t('astrolabe_unit_hr')}</option>
										<option value="day">{t('astrolabe_unit_day')}</option>
										<option value="month">{t('astrolabe_unit_month')}</option>
										<option value="yr">{t('astrolabe_unit_yr')}</option>
									</select>

									<button
										className={`rounded-full border p-2 ${borderColor} ${hoverBg} ${textColor}`}
									>
										<ChevronRight className="h-4 w-4" />
									</button>
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
				<div className="flex min-h-0 min-w-0 items-center justify-center overflow-hidden">
					<div className="aspect-square h-full w-full max-h-full max-w-full">
						<HoroscopeWheel
							theme={theme}
							bodyLongitudes={wheelBodyLongitudes}
							axisLongitudes={axisLongitudes}
							useFallbackData={false}
							showPlanetGlyphs
							showAxisLines
						/>
					</div>
				</div>

				{/* Right Column */}
				<div className="min-h-0 min-w-0">
					<Card
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
							<button
								className={`rounded-lg p-1.5 ${hoverBg}`}
								onClick={(e) => {
									e.stopPropagation();
									setShowPositionModal(true);
								}}
							>
								<Pencil className={`h-4 w-4 ${mutedColor}`} />
							</button>
						</div>

						{!positionsCollapsed && (
							<div className="flex-1 overflow-y-auto px-4 pb-4">
								{positionRows.length > 0 ? (
									<>
										<div className="space-y-1.5">
											{positionRows.map((pos) => (
												<div key={pos.id} className={`flex items-center ${textColor} font-mono text-sm`} title={pos.label}>
													<span
														className={cn(
															'w-8 text-center',
															pos.icon.length > 2 ? 'text-[10px] font-semibold' : 'text-base'
														)}
													>
														{pos.icon}
													</span>
													<span className="w-12 text-right">{pos.degrees}°</span>
													<span className="w-8 text-center text-base">{pos.signIcon}</span>
													<span className="w-10 text-right">{pos.minutes}'</span>
													<span className="w-10 text-right">{pos.seconds}"</span>
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

			<HoroscopeContextTabs theme={theme} />

			{/* Position Selection Modal */}
			{showPositionModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
					<Card
						variant="themed"
						theme={theme}
						className="max-h-[80vh] w-[min(100vw-2rem,500px)] gap-0 overflow-hidden"
					>
						<div className={`flex items-center justify-between border-b px-6 py-4 ${borderColor}`}>
							<h3 className={`text-lg font-medium ${textColor}`}>
								{t('dashboard_positions_picker_title')}
							</h3>
							<button
								onClick={() => setShowPositionModal(false)}
								className={`rounded-lg p-2 ${hoverBg}`}
							>
								<X className={`h-5 w-5 ${mutedColor}`} />
							</button>
						</div>
						<div className="max-h-[60vh] space-y-4 overflow-y-auto px-6 py-4">
							<p className={`text-sm ${mutedColor}`}>{t('dashboard_positions_picker_hint')}</p>
							{/* Add checkboxes similar to Transit settings */}
						</div>
						<div className={cn('flex justify-end gap-3 border-t px-6 py-4', ft.footerBorder)}>
							<button
								type="button"
								onClick={() => setShowPositionModal(false)}
								className={cn(ft.footerCancel, '!flex-none')}
							>
								{t('cancel')}
							</button>
							<button
								type="button"
								onClick={() => setShowPositionModal(false)}
								className={cn(ft.footerPrimary, '!flex-none')}
							>
								{t('sidebar_save')}
							</button>
						</div>
					</Card>
				</div>
			)}
		</div>
	);
}
