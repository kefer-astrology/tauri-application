import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { cs, enUS, es, fr } from 'date-fns/locale';
import { Check, ChevronDown, Pencil, Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from './ui/command';
import { ColorInput } from './ui/color-input';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { DatePickerInput } from './date-picker-input';
import { LocationSelector } from './location-selector';
import { ModeSwitcherList } from './mode-switcher';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent } from './ui/tabs';
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle
} from './ui/sheet';
import { TimeRollerPicker } from './time-roller-picker';
import { AppMainContentContainer, AppMainContentRoot } from './app-main-content';
import { cn } from './ui/utils';
import { useAppFormFieldTheme } from './form-field-theme';
import type { Theme } from './astrology-sidebar';
import { tagColor, tagDefaultColor } from '@/lib/chartTags';
import {
	appChartFromNewHoroscopeInput,
	gregorianWallDateToJulianCalendarDate,
	julianCalendarDateToGregorianWallDate,
	julianDayToUtcIso,
	type AppChart,
	type NewHoroscopeTimeSystem,
	utcDateToJulianDay,
	wallTimeToUtcIso,
	type WorkspaceDefaultsState
} from '@/lib/tauri/chartPayload';
import { resolveLocation, resolveTimezone, searchLocations } from '@/lib/tauri/workspace';

type ChartKind = 'radix' | 'event' | 'horary';
type LatDir = 'north' | 'south';
type LonDir = 'east' | 'west';
type LocationRegime = 'auto' | 'manual';
type TimeRegime = 'auto' | 'manual';

const TIME_SYSTEMS: { id: NewHoroscopeTimeSystem; labelKey: string }[] = [
	{ id: 'gregorian', labelKey: 'new_time_system_gregorian' },
	{ id: 'julian_calendar', labelKey: 'new_time_system_julian_calendar' },
	{ id: 'julian_day', labelKey: 'new_time_system_julian_day' }
];

function supportedTimeSystem(value?: string | null): NewHoroscopeTimeSystem {
	return value === 'julian_day' || value === 'julian_calendar' ? value : 'gregorian';
}

const DISCOVERED_TIMEZONES: string[] =
	typeof Intl !== 'undefined' && 'supportedValuesOf' in Intl
		? (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf(
				'timeZone'
			)
		: [];

const TIMEZONES = Array.from(
	new Set([
		'UTC',
		'Europe/Prague',
		'Europe/London',
		'America/New_York',
		'America/Los_Angeles',
		'Asia/Kolkata',
		'Asia/Kathmandu',
		'Australia/Sydney',
		...DISCOVERED_TIMEZONES
	])
).sort((a, b) => a.localeCompare(b));

const TIMEZONE_REGIONS = Array.from(
	new Set(TIMEZONES.map((timezone) => timezone.split('/')[0]).filter(Boolean))
).sort((a, b) => a.localeCompare(b));

const UTC_OFFSETS = Array.from({ length: 113 }, (_, index) => {
	const totalMinutes = index * 15 - 14 * 60;
	const sign = totalMinutes >= 0 ? '+' : '-';
	const magnitude = Math.abs(totalMinutes);
	const hours = Math.floor(magnitude / 60);
	const minutes = magnitude % 60;
	return `UTC${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
});

function timezoneRegion(timezone: string): string {
	const region = timezone.split('/')[0] ?? '';
	return TIMEZONE_REGIONS.includes(region) ? region : (TIMEZONE_REGIONS[0] ?? 'UTC');
}

function timezoneMatchesRegion(timezone: string, region: string): boolean {
	return timezone === region || timezone.startsWith(`${region}/`);
}

function formatCoordinateMagnitude(value: number): string {
	return Math.abs(value).toFixed(4);
}

function chartTypeToKind(chartType: string): ChartKind {
	if (chartType === 'NATAL') return 'radix';
	if (chartType === 'EVENT') return 'event';
	if (chartType === 'HORARY') return 'horary';
	return 'radix';
}

function parseUtcOffsetMinutes(value?: string): number | null {
	if (!value) return null;
	const match = /^UTC([+-])(\d{2}):(\d{2})$/.exec(value);
	if (!match) return null;
	const minutes = Number(match[2]) * 60 + Number(match[3]);
	return match[1] === '+' ? minutes : -minutes;
}

function parseDateTimeString(dateTime: string, timezone?: string, utcOffset?: string): Date {
	if (!dateTime) return new Date();
	const normalized = dateTime.includes('T') ? dateTime : dateTime.replace(' ', 'T');
	const d = new Date(normalized);
	if (isNaN(d.getTime())) return new Date();
	if (!timezone || !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized)) return d;
	const offsetMinutes = parseUtcOffsetMinutes(utcOffset ?? timezone);
	if (offsetMinutes !== null) {
		const wallTime = new Date(d.getTime() + offsetMinutes * 60_000);
		return new Date(
			wallTime.getUTCFullYear(),
			wallTime.getUTCMonth(),
			wallTime.getUTCDate(),
			wallTime.getUTCHours(),
			wallTime.getUTCMinutes(),
			wallTime.getUTCSeconds()
		);
	}
	try {
		const parts = new Intl.DateTimeFormat('en-US', {
			timeZone: timezone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hourCycle: 'h23'
		}).formatToParts(d);
		const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
		return new Date(
			Number(values.year),
			Number(values.month) - 1,
			Number(values.day),
			Number(values.hour),
			Number(values.minute),
			Number(values.second)
		);
	} catch {
		return d;
	}
}

function signedCoordinate(
	value: string,
	positiveDirection: LatDir | LonDir,
	selectedDirection: LatDir | LonDir
): number | null {
	const normalized = value.trim();
	if (!normalized) return null;
	const parsed = Number(normalized);
	if (!Number.isFinite(parsed)) return null;
	return selectedDirection === positiveDirection ? Math.abs(parsed) : -Math.abs(parsed);
}

const RODEN_RATINGS: { id: string; labelKey: string }[] = [
	{ id: 'AA', labelKey: 'new_roden_rating_aa' },
	{ id: 'A', labelKey: 'new_roden_rating_a' },
	{ id: 'B', labelKey: 'new_roden_rating_b' },
	{ id: 'C', labelKey: 'new_roden_rating_c' },
	{ id: 'DD', labelKey: 'new_roden_rating_dd' },
	{ id: 'X', labelKey: 'new_roden_rating_x' }
];

const CHART_TYPE_ORDER: { id: ChartKind; labelKey: string }[] = [
	{ id: 'radix', labelKey: 'new_type_radix' },
	{ id: 'event', labelKey: 'new_type_event' },
	{ id: 'horary', labelKey: 'new_type_horary' }
];

const LAT_DIRS: { id: LatDir; labelKey: string }[] = [
	{ id: 'north', labelKey: 'new_dir_north' },
	{ id: 'south', labelKey: 'new_dir_south' }
];

const LON_DIRS: { id: LonDir; labelKey: string }[] = [
	{ id: 'east', labelKey: 'new_dir_east' },
	{ id: 'west', labelKey: 'new_dir_west' }
];

function parseTags(raw: string): string[] {
	return raw
		.split(/[,\n]/)
		.map((t) => t.trim())
		.filter((t) => t.length > 0);
}

function mergeTags(existing: string[], incoming: string[]): string[] {
	const next = [...existing];
	for (const tag of incoming) {
		if (!next.includes(tag)) next.push(tag);
	}
	return next;
}

function TagInput({
	tags,
	tagColors,
	onChange,
	onOpenAdvanced,
	advancedLabel,
	placeholder,
	panelBg,
	panelBorder,
	contentPrimary,
	contentMuted,
	iconClassName
}: {
	tags: string[];
	tagColors: Record<string, string>;
	onChange: (tags: string[]) => void;
	onOpenAdvanced: () => void;
	advancedLabel: string;
	placeholder?: string;
	panelBg: string;
	panelBorder: string;
	contentPrimary: string;
	contentMuted: string;
	iconClassName: string;
}) {
	const [input, setInput] = useState('');

	const commit = (raw: string) => {
		const next = parseTags(raw);
		if (next.length > 0) onChange(mergeTags(tags, next));
		setInput('');
	};

	return (
		<div
			className={cn(
				'flex min-h-10 w-full items-stretch overflow-hidden rounded-xl border text-base shadow-inner transition-all md:text-sm',
				'focus-within:border-transparent focus-within:ring-2',
				panelBg,
				panelBorder
			)}
			style={
				{
					'--tw-ring-color': `var(--theme-accent)`
				} as CSSProperties
			}
		>
			<div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 px-3 py-2">
				{tags.map((tag, index) => (
					<span
						key={tag}
						className={cn(
							'flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-medium',
							'bg-[color:var(--theme-selected-bg)]',
							contentPrimary
						)}
					>
						<span
							className="h-2.5 w-2.5 rounded-full"
							style={{ backgroundColor: tagColor(tagColors, tag, index) }}
						/>
						{tag}
						<button
							type="button"
							onClick={() => onChange(tags.filter((t) => t !== tag))}
							className={cn(
								'ml-0.5 rounded-full p-0.5 transition-colors',
								`hover:text-[color:var(--theme-accent)]`,
								contentMuted
							)}
						>
							<X className="h-3 w-3" />
						</button>
					</span>
				))}
				<input
					value={input}
					onChange={(e) => setInput(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === 'Enter' || e.key === ',') {
							e.preventDefault();
							commit(input);
						}
						if (e.key === 'Backspace' && !input && tags.length > 0) {
							onChange(tags.slice(0, -1));
						}
					}}
					onBlur={() => {
						if (input.trim()) commit(input);
					}}
					placeholder={tags.length === 0 ? placeholder : undefined}
					className={cn(
						'min-w-[6rem] flex-1 bg-transparent text-base outline-none md:text-sm',
						`placeholder:${contentMuted}`,
						contentPrimary
					)}
				/>
			</div>
			<Button
				type="button"
				variant="ghost"
				onClick={onOpenAdvanced}
				className="h-auto min-h-10 self-stretch rounded-none border-l border-[color:var(--theme-panel-border)] px-3 shadow-none hover:bg-[color:var(--theme-soft-bg)]"
				aria-label={advancedLabel}
			>
				<Pencil className={cn('h-4 w-4 shrink-0', iconClassName)} />
			</Button>
		</div>
	);
}

function AdvancedTagSheet({
	open,
	onOpenChange,
	tags,
	tagColors,
	onChange,
	onRename,
	onColorChange,
	theme
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	tags: string[];
	tagColors: Record<string, string>;
	onChange: (tags: string[]) => void;
	onRename: (tag: string, nextName: string) => void;
	onColorChange: (tag: string, color: string) => void;
	theme: Theme;
}) {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme(theme);
	const [draft, setDraft] = useState('');
	const [draftNames, setDraftNames] = useState<Record<string, string>>({});

	useEffect(() => {
		if (!open) return;
		setDraftNames(Object.fromEntries(tags.map((tag) => [tag, tag])));
	}, [open, tags]);

	const addDraftTags = () => {
		const next = parseTags(draft);
		if (next.length === 0) return;
		onChange(mergeTags(tags, next));
		setDraft('');
	};

	const commitTagName = (tag: string) => {
		const nextName = (draftNames[tag] ?? tag).trim();
		if (!nextName || nextName === tag) {
			setDraftNames((prev) => ({ ...prev, [tag]: tag }));
			return;
		}
		onRename(tag, nextName);
	};

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				side="right"
				className={cn(
					'w-full gap-0 p-0 sm:max-w-md',
					'border-[color:var(--theme-panel-border)] shadow-2xl',
					'bg-[color:var(--theme-panel-bg-solid)] text-[color:var(--theme-content-primary)]'
				)}
			>
				<div className="flex h-full min-h-0 flex-col">
					<SheetHeader className="shrink-0 px-5 py-4">
						<SheetTitle className={cn('text-lg font-semibold', ft.title)}>
							{t('new_tags')}
						</SheetTitle>
						<SheetDescription className={cn('text-sm', ft.muted)}>
							{t('new_tags_comma_hint')}
						</SheetDescription>
					</SheetHeader>

					<div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
						<div className="space-y-2">
							<Label htmlFor="advanced-tags" className={ft.label}>
								{t('new_tags')}
							</Label>
							<div className="flex gap-2">
								<Input
									id="advanced-tags"
									value={draft}
									onChange={(event) => setDraft(event.target.value)}
									onKeyDown={(event) => {
										if (event.key === 'Enter') {
											event.preventDefault();
											addDraftTags();
										}
									}}
									placeholder={t('placeholder_tags_example')}
									className={cn(ft.input, 'shadow-inner')}
								/>
								<Button
									type="button"
									size="icon"
									className={cn(ft.footerPrimary, 'h-10 w-10 flex-none rounded-xl')}
									onClick={addDraftTags}
									aria-label={t('new_tags')}
								>
									<Plus className="h-4 w-4" />
								</Button>
							</div>
						</div>

						<div className="space-y-2">
							<div className={cn('text-sm font-medium', ft.label)}>{t('table_tags')}</div>
							{tags.length > 0 ? (
								<div className="space-y-2">
									{tags.map((tag, index) => (
										<div
											key={tag}
											className={cn(
												'flex items-center gap-2 rounded-xl border px-3 py-2',
												'border-[color:var(--theme-panel-border)] bg-[color:var(--theme-soft-bg)]'
											)}
										>
											<ColorInput
												value={tagColor(tagColors, tag, index)}
												onChange={(event) => onColorChange(tag, event.currentTarget.value)}
												className="h-8 w-9 rounded-lg"
												aria-label={`${t('new_tags')} ${tag}`}
											/>
											<Input
												value={draftNames[tag] ?? tag}
												onChange={(event) =>
													setDraftNames((prev) => ({ ...prev, [tag]: event.target.value }))
												}
												onBlur={() => commitTagName(tag)}
												onKeyDown={(event) => {
													if (event.key === 'Enter') {
														event.preventDefault();
														commitTagName(tag);
													}
													if (event.key === 'Escape') {
														setDraftNames((prev) => ({ ...prev, [tag]: tag }));
													}
												}}
												className={cn(ft.input, 'h-8 min-w-0 flex-1 rounded-lg shadow-inner')}
												aria-label={`${t('new_tags')} ${tag}`}
											/>
											<Button
												type="button"
												variant="ghost"
												size="icon"
												className={cn('h-8 w-8 flex-none rounded-lg', ft.muted)}
												onClick={() => onChange(tags.filter((item) => item !== tag))}
												aria-label={`${t('button_close')} ${tag}`}
											>
												<X className="h-4 w-4" />
											</Button>
										</div>
									))}
								</div>
							) : (
								<div className={cn('rounded-xl border border-dashed px-3 py-4 text-sm', ft.muted)}>
									{t('placeholder_tags_example')}
								</div>
							)}
						</div>
					</div>

					<SheetFooter className="shrink-0 border-t border-[color:var(--theme-panel-border)] px-5 py-4">
						<Button
							type="button"
							variant="outline"
							className={cn(ft.footerCancel, '!flex-none')}
							onClick={() => onOpenChange(false)}
						>
							{t('button_close')}
						</Button>
					</SheetFooter>
				</div>
			</SheetContent>
		</Sheet>
	);
}

function TimezoneSelect({
	value,
	onValueChange,
	options = TIMEZONES,
	placeholder,
	emptyLabel,
	triggerClassName,
	contentClassName,
	itemClassName
}: {
	value: string;
	onValueChange: (v: string) => void;
	options?: string[];
	placeholder: string;
	emptyLabel: string;
	triggerClassName?: string;
	contentClassName?: string;
	itemClassName?: string;
}) {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState('');

	const filtered = useMemo(() => {
		const q = search.trim().toLowerCase();
		if (!q) return options.slice(0, 120);
		return options.filter((tz) => tz.toLowerCase().includes(q)).slice(0, 120);
	}, [options, search]);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					role="combobox"
					aria-expanded={open}
					className={cn(
						'flex h-auto min-h-10 w-full items-center justify-between gap-2 text-left',
						triggerClassName
					)}
				>
					<span className={value ? '' : 'opacity-50'}>{value || placeholder}</span>
					<ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
				</button>
			</PopoverTrigger>
			<PopoverContent
				className={cn('w-[var(--radix-popover-trigger-width)] p-0', contentClassName)}
				align="end"
			>
				<Command className="bg-transparent text-[color:var(--theme-content-primary)]">
					<CommandInput
						value={search}
						onValueChange={setSearch}
						placeholder={placeholder}
						className="text-[color:var(--theme-content-primary)] placeholder:text-[color:var(--theme-content-muted)]"
					/>
					<CommandList>
						{filtered.length === 0 && <CommandEmpty>{emptyLabel}</CommandEmpty>}
						{filtered.map((tz) => (
							<CommandItem
								key={tz}
								value={tz}
								onSelect={() => {
									onValueChange(tz);
									setOpen(false);
									setSearch('');
								}}
								className={cn(
									'data-[selected=true]:bg-[color:var(--theme-soft-bg)] data-[selected=true]:text-[color:var(--theme-content-primary)]',
									itemClassName
								)}
							>
								<Check className={cn('mr-2 h-4 w-4', value === tz ? 'opacity-100' : 'opacity-0')} />
								{tz}
							</CommandItem>
						))}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}

interface NewHoroscopeProps {
	theme?: Theme;
	/** Return to main horoscope view (sidebar **Horoskop**). */
	onBack?: () => void;
	workspaceDefaults: WorkspaceDefaultsState;
	existingChartIds: ReadonlySet<string>;
	/** Persist + navigate home; chart is appended to workspace context tabs. */
	onCreated?: (chart: AppChart) => void | Promise<void>;
	/** Pre-fill the form with an existing chart for editing. */
	initialValues?: AppChart;
	/** Called instead of onCreated when editing an existing chart. */
	onSaved?: (chart: AppChart) => void | Promise<void>;
}

export function NewHoroscope({
	theme = 'noon',
	onBack,
	workspaceDefaults,
	existingChartIds,
	onCreated,
	initialValues,
	onSaved
}: NewHoroscopeProps) {
	const { t, i18n } = useTranslation();
	const ft = useAppFormFieldTheme(theme);

	const isEditMode = initialValues != null;
	const initialTimezone = initialValues?.timezone ?? workspaceDefaults.timezone;
	const initialTimeSystem = supportedTimeSystem(initialValues?.timeSystem);
	const initialSelectedDateTime = initialValues?.dateTime
		? parseDateTimeString(initialValues.dateTime, initialTimezone, initialValues.utcOffset)
		: new Date();

	const [locationName, setLocationName] = useState(() => initialValues?.name ?? '');
	const [location, setLocation] = useState(
		() => initialValues?.location ?? workspaceDefaults.locationName ?? ''
	);
	const [tags, setTags] = useState<string[]>(() => initialValues?.tags ?? []);
	const [tagColors, setTagColors] = useState<Record<string, string>>(
		() => initialValues?.tagColors ?? {}
	);
	const [tagSheetOpen, setTagSheetOpen] = useState(false);
	const [selectedDateTime, setSelectedDateTime] = useState<Date>(initialSelectedDateTime);
	const [timeSystem, setTimeSystem] = useState<NewHoroscopeTimeSystem>(initialTimeSystem);
	const [julianDay, setJulianDay] = useState(() =>
		utcDateToJulianDay(
			initialValues?.dateTime ? new Date(initialValues.dateTime) : new Date()
		).toFixed(8)
	);
	const [julianCalendarDate, setJulianCalendarDate] = useState(() =>
		gregorianWallDateToJulianCalendarDate(initialSelectedDateTime)
	);
	const [chartKind, setChartKind] = useState<ChartKind>(() =>
		initialValues ? chartTypeToKind(initialValues.chartType) : 'radix'
	);
	const [locationRegime, setLocationRegime] = useState<LocationRegime>(
		() => initialValues?.locationRegime ?? (initialValues?.latitude != null ? 'manual' : 'auto')
	);
	const [timeRegime, setTimeRegime] = useState<TimeRegime>(
		() => initialValues?.timeRegime ?? (initialValues?.timezone ? 'manual' : 'auto')
	);
	const [latitude, setLatitude] = useState(() =>
		initialValues?.latitude != null ? formatCoordinateMagnitude(initialValues.latitude) : ''
	);
	const [longitude, setLongitude] = useState(() =>
		initialValues?.longitude != null ? formatCoordinateMagnitude(initialValues.longitude) : ''
	);
	const [timezone, setTimezone] = useState(() => initialTimezone ?? '');
	const [timezoneRegionValue, setTimezoneRegionValue] = useState(() =>
		timezoneRegion(initialTimezone)
	);
	const [utcOffset, setUtcOffset] = useState(() => initialValues?.utcOffset ?? 'auto');
	const [latitudeDir, setLatitudeDir] = useState<LatDir>(() =>
		(initialValues?.latitude ?? 0) >= 0 ? 'north' : 'south'
	);
	const [longitudeDir, setLongitudeDir] = useState<LonDir>(() =>
		(initialValues?.longitude ?? 0) >= 0 ? 'east' : 'west'
	);
	const [rodenRating, setRodenRating] = useState(() => initialValues?.rodenRating ?? '');
	const [isResolvingLocation, setIsResolvingLocation] = useState(false);
	const [resolvedLocationValue, setResolvedLocationValue] = useState('');

	const timezonesInRegion = useMemo(
		() => TIMEZONES.filter((candidate) => timezoneMatchesRegion(candidate, timezoneRegionValue)),
		[timezoneRegionValue]
	);

	const dateFnsLocale = useMemo(() => {
		const base = i18n.language.split('-')[0]?.toLowerCase() ?? 'en';
		if (base === 'cs') return cs;
		if (base === 'fr') return fr;
		if (base === 'es') return es;
		return enUS;
	}, [i18n.language]);

	const applyTags = (nextTags: string[]) => {
		const uniqueTags = mergeTags([], nextTags);
		setTags(uniqueTags);
		setTagColors((prev) => {
			const next: Record<string, string> = {};
			uniqueTags.forEach((tag, index) => {
				next[tag] = prev[tag] ?? tagDefaultColor(index);
			});
			return next;
		});
	};

	const applyTagColor = (tag: string, color: string) => {
		setTagColors((prev) => ({ ...prev, [tag]: color }));
	};

	const applyTagRename = (tag: string, nextName: string) => {
		const normalized = nextName.trim();
		if (!normalized || normalized === tag) return;

		const nextTags = tags.reduce<string[]>((acc, current) => {
			const value = current === tag ? normalized : current;
			if (!acc.includes(value)) acc.push(value);
			return acc;
		}, []);

		setTags(nextTags);
		setTagColors((prev) => {
			const next: Record<string, string> = {};
			nextTags.forEach((nextTag, index) => {
				next[nextTag] =
					nextTag === normalized
						? (prev[normalized] ?? prev[tag] ?? tagDefaultColor(index))
						: (prev[nextTag] ?? tagDefaultColor(index));
			});
			return next;
		});
	};

	const locationOptions = useMemo(
		() =>
			[
				workspaceDefaults.locationName,
				'Prague, Czech Republic',
				'Brno, Czech Republic',
				'Pardubice, Czech Republic',
				'Bratislava, Slovakia',
				'Vienna, Austria'
			].filter(Boolean),
		[workspaceDefaults.locationName]
	);

	const currentLocationQuery = location.trim();

	const applyResolvedLocation = (
		displayName: string,
		resolvedLatitude: number,
		resolvedLongitude: number,
		resolvedTimezone?: string
	) => {
		setLocation(displayName);
		setResolvedLocationValue(displayName);
		setLatitude(formatCoordinateMagnitude(resolvedLatitude));
		setLongitude(formatCoordinateMagnitude(resolvedLongitude));
		setLatitudeDir(resolvedLatitude >= 0 ? 'north' : 'south');
		setLongitudeDir(resolvedLongitude >= 0 ? 'east' : 'west');
		if (timeRegime === 'auto' && resolvedTimezone) setTimezone(resolvedTimezone);
		if (timeRegime === 'auto' && resolvedTimezone) {
			setTimezoneRegionValue(timezoneRegion(resolvedTimezone));
		}
		toast.success(t('toast_location_resolved'), {
			description: `${resolvedLatitude.toFixed(4)}, ${resolvedLongitude.toFixed(4)}`
		});
	};

	const resolveCurrentLocation = async () => {
		if (!currentLocationQuery) {
			toast.error(t('toast_location_required'));
			return null;
		}

		setIsResolvingLocation(true);
		try {
			const resolved = await resolveLocation(currentLocationQuery);
			applyResolvedLocation(
				resolved.display_name,
				resolved.latitude,
				resolved.longitude,
				resolved.timezone
			);
			return resolved;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			toast.error(t('toast_location_resolve_failed'), { description: message });
			return null;
		} finally {
			setIsResolvingLocation(false);
		}
	};

	const handleTimeSystemChange = (next: NewHoroscopeTimeSystem) => {
		try {
			if (next === 'julian_day') {
				const instant =
					timeSystem === 'julian_day'
						? new Date(julianDayToUtcIso(julianDay))
						: new Date(
								wallTimeToUtcIso(
									timeSystem === 'julian_calendar'
										? julianCalendarDateToGregorianWallDate(julianCalendarDate, selectedDateTime)
										: selectedDateTime,
									timezone,
									timeRegime === 'manual' && utcOffset !== 'auto' ? utcOffset : undefined
								)
							);
				setJulianDay(utcDateToJulianDay(instant).toFixed(8));
			} else if (timeSystem === 'julian_day') {
				const wallTime = parseDateTimeString(
					julianDayToUtcIso(julianDay),
					timezone,
					timeRegime === 'manual' && utcOffset !== 'auto' ? utcOffset : undefined
				);
				setSelectedDateTime(wallTime);
				if (next === 'julian_calendar') {
					setJulianCalendarDate(gregorianWallDateToJulianCalendarDate(wallTime));
				}
			} else if (next === 'julian_calendar') {
				setJulianCalendarDate(gregorianWallDateToJulianCalendarDate(selectedDateTime));
			} else if (timeSystem === 'julian_calendar') {
				setSelectedDateTime(
					julianCalendarDateToGregorianWallDate(julianCalendarDate, selectedDateTime)
				);
			}
			setTimeSystem(next);
		} catch (error) {
			toast.error(t('toast_time_invalid'), {
				description: error instanceof Error ? error.message : String(error)
			});
		}
	};

	const handleCreate = async () => {
		const name = locationName.trim();
		if (!name) {
			toast.error(t('toast_chart_name_required'));
			return;
		}
		if (!currentLocationQuery) {
			toast.error(t('toast_location_required'));
			return;
		}

		let resolvedLocation = location;
		let resolvedLatitude = latitude;
		let resolvedLongitude = longitude;
		let resolvedLatitudeDir = latitudeDir;
		let resolvedLongitudeDir = longitudeDir;

		if (
			locationRegime === 'auto' &&
			currentLocationQuery &&
			resolvedLocationValue !== currentLocationQuery
		) {
			const resolved = await resolveCurrentLocation();
			if (!resolved) return;
			resolvedLocation = resolved.display_name;
			resolvedLatitude = formatCoordinateMagnitude(resolved.latitude);
			resolvedLongitude = formatCoordinateMagnitude(resolved.longitude);
			resolvedLatitudeDir = resolved.latitude >= 0 ? 'north' : 'south';
			resolvedLongitudeDir = resolved.longitude >= 0 ? 'east' : 'west';
		}

		const latitudeValue = signedCoordinate(resolvedLatitude, 'north', resolvedLatitudeDir);
		const longitudeValue = signedCoordinate(resolvedLongitude, 'east', resolvedLongitudeDir);
		if (
			latitudeValue === null ||
			longitudeValue === null ||
			Math.abs(latitudeValue) > 90 ||
			Math.abs(longitudeValue) > 180
		) {
			toast.error(t('toast_coordinates_invalid'));
			return;
		}

		let resolvedTimezone = timezone;
		if (timeRegime === 'auto') {
			try {
				resolvedTimezone = await resolveTimezone(latitudeValue, longitudeValue);
				setTimezone(resolvedTimezone);
				setTimezoneRegionValue(timezoneRegion(resolvedTimezone));
			} catch (error) {
				toast.error(t('toast_location_resolve_failed'), {
					description: error instanceof Error ? error.message : String(error)
				});
				return;
			}
		}

		let chart: AppChart;
		try {
			chart = appChartFromNewHoroscopeInput({
				locationName,
				chartKind,
				dateTime: selectedDateTime,
				timeSystem,
				julianDay,
				julianCalendarDate,
				location: resolvedLocation,
				tags: tags.join(', '),
				tagColors: Object.fromEntries(
					tags.map((tag, index) => [tag, tagColors[tag] ?? tagDefaultColor(index)])
				),
				latitude: resolvedLatitude,
				longitude: resolvedLongitude,
				latitudeDir: resolvedLatitudeDir,
				longitudeDir: resolvedLongitudeDir,
				timezone: resolvedTimezone,
				utcOffset: timeRegime === 'manual' && utcOffset !== 'auto' ? utcOffset : undefined,
				locationRegime,
				timeRegime,
				rodenRating: rodenRating || undefined,
				workspaceDefaults,
				existingIds: existingChartIds
			});
		} catch (error) {
			toast.error(t('toast_time_invalid'), {
				description: error instanceof Error ? error.message : String(error)
			});
			return;
		}

		if (isEditMode && initialValues) {
			await onSaved?.({ ...chart, id: initialValues.id });
		} else {
			await onCreated?.(chart);
		}
	};

	return (
		<AppMainContentRoot className={cn(ft.formPageBg, theme === 'twilight' && 'kefer-twilight-bg')}>
			<AppMainContentContainer layout="center-column">
				{/* <h1 className={cn('mb-5 text-xl font-semibold', ft.title)}>
						{isEditMode ? t('edit_radix_title') : t('new_radix_title')}
					</h1> */}

				<div className="space-y-4">
					<div>
						<Label htmlFor="locationName" className={cn('mb-1.5 block', ft.label)}>
							{t('new_name')}
						</Label>
						<Input
							id="locationName"
							value={locationName}
							onChange={(e) => setLocationName(e.target.value)}
							className={cn(ft.input, 'shadow-inner')}
						/>
					</div>

					<div>
						<Label htmlFor="chart-type" className={cn('mb-1.5 block', ft.label)}>
							{t('new_type')}
						</Label>
						<Select value={chartKind} onValueChange={(v) => setChartKind(v as ChartKind)}>
							<SelectTrigger id="chart-type" className={cn(ft.selectTrigger, 'shadow-inner')}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent className={ft.selectContent}>
								{CHART_TYPE_ORDER.map((opt) => (
									<SelectItem key={opt.id} value={opt.id} className={ft.selectItem}>
										{t(opt.labelKey)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<Tabs
						value={timeRegime}
						onValueChange={(value) => setTimeRegime(value as TimeRegime)}
						className="gap-3"
					>
						<div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
							<div className="flex flex-col gap-2">
								<Label htmlFor="new-chart-date" className={cn('mb-1.5 block', ft.label)}>
									{timeSystem === 'julian_day'
										? t('new_julian_day')
										: timeSystem === 'julian_calendar'
											? t('new_julian_calendar_date')
											: t('new_date')}
								</Label>
								{timeSystem === 'julian_day' ? (
									<Input
										id="new-chart-date"
										type="text"
										inputMode="decimal"
										value={julianDay}
										onChange={(event) => setJulianDay(event.target.value)}
										placeholder="2451545.0"
										className={cn(ft.input, 'shadow-inner')}
									/>
								) : timeSystem === 'julian_calendar' ? (
									<Input
										id="new-chart-date"
										type="text"
										inputMode="numeric"
										value={julianCalendarDate}
										onChange={(event) => setJulianCalendarDate(event.target.value)}
										placeholder="YYYY-MM-DD"
										className={cn(ft.input, 'shadow-inner')}
									/>
								) : (
									<DatePickerInput
										id="new-chart-date"
										label={t('new_date')}
										value={selectedDateTime}
										onValueChange={setSelectedDateTime}
										locale={dateFnsLocale}
										showLabel={false}
										iconClassName={ft.iconColor}
										panelClassName={ft.datePicker}
									/>
								)}
							</div>

							<div className={cn('flex flex-col gap-2', timeSystem === 'julian_day' && 'hidden')}>
								<TimeRollerPicker
									id="new-chart-time"
									label={t('new_time')}
									value={selectedDateTime}
									onValueChange={setSelectedDateTime}
									labelClassName={ft.label}
									iconClassName={ft.iconColor}
									panelClassName={ft.selectContent}
								/>
							</div>

							<div className="flex flex-col gap-2">
								<Label className={cn('mb-1.5 block', ft.label)}>{t('new_time_regime')}</Label>
								<ModeSwitcherList
									ariaLabel={t('new_time_regime')}
									options={[
										{ value: 'auto', label: t('new_time_regime_auto') },
										{ value: 'manual', label: t('new_time_regime_manual') }
									]}
									className="min-w-[11rem]"
								/>
							</div>
						</div>

						<TabsContent value="manual" className={cn('space-y-3', ft.advancedPanel)}>
							<div>
								<Label className={cn('mb-1.5 block', ft.label)}>{t('new_timezone_region')}</Label>
								<Select
									value={timezoneRegionValue}
									onValueChange={(region) => {
										setTimezoneRegionValue(region);
										if (!timezoneMatchesRegion(timezone, region)) {
											setTimezone(
												TIMEZONES.find((candidate) => timezoneMatchesRegion(candidate, region)) ??
													timezone
											);
										}
									}}
								>
									<SelectTrigger className={cn(ft.selectTrigger, 'shadow-inner')}>
										<SelectValue />
									</SelectTrigger>
									<SelectContent className={ft.selectContent}>
										{TIMEZONE_REGIONS.map((region) => (
											<SelectItem key={region} value={region} className={ft.selectItem}>
												{region}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div>
								<Label className={cn('mb-1.5 block', ft.label)}>{t('new_timezone')}</Label>
								<TimezoneSelect
									value={timezone}
									onValueChange={setTimezone}
									options={timezonesInRegion}
									placeholder={t('new_timezone_placeholder')}
									emptyLabel={t('new_timezone_no_results')}
									triggerClassName={cn(ft.selectTrigger, 'shadow-inner px-4 py-2.5')}
									contentClassName={ft.selectContent}
									itemClassName={ft.selectItem}
								/>
							</div>
							<div>
								<Label className={cn('mb-1.5 block', ft.label)}>{t('new_utc_offset')}</Label>
								<Select value={utcOffset} onValueChange={setUtcOffset}>
									<SelectTrigger className={cn(ft.selectTrigger, 'shadow-inner')}>
										<SelectValue />
									</SelectTrigger>
									<SelectContent className={ft.selectContent}>
										<SelectItem value="auto" className={ft.selectItem}>
											{t('new_time_regime_auto')}
										</SelectItem>
										{UTC_OFFSETS.map((offset) => (
											<SelectItem key={offset} value={offset} className={ft.selectItem}>
												{offset}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div>
								<Label className={cn('mb-1.5 block', ft.label)}>{t('new_time_system')}</Label>
								<Select
									value={timeSystem}
									onValueChange={(value) => handleTimeSystemChange(value as NewHoroscopeTimeSystem)}
								>
									<SelectTrigger className={cn(ft.selectTrigger, 'shadow-inner')}>
										<SelectValue />
									</SelectTrigger>
									<SelectContent className={ft.selectContent}>
										{TIME_SYSTEMS.map((option) => (
											<SelectItem key={option.id} value={option.id} className={ft.selectItem}>
												{t(option.labelKey)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</TabsContent>
					</Tabs>

					<Tabs
						value={locationRegime}
						onValueChange={(value) => setLocationRegime(value as LocationRegime)}
						className="gap-3"
					>
						<div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
							<TabsContent value="auto" className="flex flex-col gap-2">
								<Label className={cn('mb-1.5 block', ft.label)}>{t('new_location')}</Label>
								<LocationSelector
									id="location"
									value={location}
									onValueChange={(value) => {
										setLocation(value);
										setResolvedLocationValue('');
									}}
									options={locationOptions}
									placeholder={t('new_placeholder_any_location')}
									searchPlaceholder={t('new_location_search')}
									emptyLabel={t('new_placeholder_any_location')}
									loadingLabel={t('new_resolving_location')}
									className={ft.selectTrigger}
									iconClassName={ft.iconColor}
									searchLocations={searchLocations}
									onResolvedLocationSelect={(result) =>
										applyResolvedLocation(
											result.display_name,
											result.latitude,
											result.longitude,
											result.timezone
										)
									}
								/>
							</TabsContent>

							<div className="flex flex-col gap-2 md:col-start-2">
								<Label className={cn('mb-1.5 block', ft.label)}>{t('new_location_regime')}</Label>
								<ModeSwitcherList
									ariaLabel={t('new_location_regime')}
									options={[
										{ value: 'auto', label: t('new_time_regime_auto') },
										{ value: 'manual', label: t('new_time_regime_manual') }
									]}
									className="min-w-[11rem]"
								/>
							</div>
						</div>

						<TabsContent value="manual" className={cn('space-y-3', ft.advancedPanel)}>
							<div>
								<Label htmlFor="manual-location" className={cn('mb-1.5 block', ft.label)}>
									{t('new_location')}
								</Label>
								<Input
									id="manual-location"
									value={location}
									onChange={(event) => {
										setLocation(event.target.value);
										setResolvedLocationValue('');
									}}
									placeholder={t('new_placeholder_any_location')}
									className={cn(ft.input, 'shadow-inner')}
								/>
							</div>
							{/* Latitude */}
							<div>
								<Label htmlFor="latitude" className={cn('mb-1.5 block', ft.label)}>
									{t('current_info_latitude')}
								</Label>
								<div className="flex gap-2">
									<Input
										type="text"
										id="latitude"
										value={latitude}
										onChange={(e) => setLatitude(e.target.value)}
										placeholder="50.0755"
										className={cn(ft.input, 'flex-1 shadow-inner')}
									/>
									<Select value={latitudeDir} onValueChange={(v) => setLatitudeDir(v as LatDir)}>
										<SelectTrigger className={cn(ft.selectTrigger, 'w-28 shrink-0 shadow-inner')}>
											<SelectValue />
										</SelectTrigger>
										<SelectContent className={ft.selectContent}>
											{LAT_DIRS.map((dir) => (
												<SelectItem key={dir.id} value={dir.id} className={ft.selectItem}>
													{t(dir.labelKey)}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>

							{/* Longitude */}
							<div>
								<Label htmlFor="longitude" className={cn('mb-1.5 block', ft.label)}>
									{t('current_info_longitude')}
								</Label>
								<div className="flex gap-2">
									<Input
										type="text"
										id="longitude"
										value={longitude}
										onChange={(e) => setLongitude(e.target.value)}
										placeholder="14.4378"
										className={cn(ft.input, 'flex-1 shadow-inner')}
									/>
									<Select value={longitudeDir} onValueChange={(v) => setLongitudeDir(v as LonDir)}>
										<SelectTrigger className={cn(ft.selectTrigger, 'w-28 shrink-0 shadow-inner')}>
											<SelectValue />
										</SelectTrigger>
										<SelectContent className={ft.selectContent}>
											{LON_DIRS.map((dir) => (
												<SelectItem key={dir.id} value={dir.id} className={ft.selectItem}>
													{t(dir.labelKey)}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>
						</TabsContent>
					</Tabs>

					{/* Tags */}
					<div>
						<Label className={cn('mb-1.5 block', ft.label)}>{t('new_tags')}</Label>
						<TagInput
							tags={tags}
							tagColors={tagColors}
							onChange={applyTags}
							onOpenAdvanced={() => setTagSheetOpen(true)}
							advancedLabel={t('new_tags')}
							placeholder={t('new_tags_comma_hint')}
							panelBg="bg-[color:var(--theme-panel-bg)] backdrop-blur-sm"
							panelBorder="border border-[color:var(--theme-panel-border)]"
							contentPrimary="text-[color:var(--theme-content-primary)]"
							contentMuted="text-[color:var(--theme-content-muted)]"
							iconClassName={ft.iconColor}
						/>
					</div>

					{/* Roden Rating */}
					<div>
						<Label htmlFor="roden-rating" className={cn('mb-1.5 block', ft.label)}>
							{t('new_roden_rating')}
						</Label>
						<Select value={rodenRating} onValueChange={setRodenRating}>
							<SelectTrigger id="roden-rating" className={cn(ft.selectTrigger, 'shadow-inner')}>
								<SelectValue placeholder={t('new_roden_rating_placeholder')} />
							</SelectTrigger>
							<SelectContent className={ft.selectContent}>
								{RODEN_RATINGS.map((opt) => (
									<SelectItem key={opt.id} value={opt.id} className={ft.selectItem}>
										{opt.id} – {t(opt.labelKey)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="flex gap-4 pt-4">
						{isEditMode && (
							<Button
								type="button"
								variant="ghost"
								className={ft.footerCancel}
								onClick={() => onBack?.()}
							>
								{t('new_back')}
							</Button>
						)}
						<Button
							type="button"
							variant="ghost"
							className={cn(ft.footerPrimary, !isEditMode && 'flex-1')}
							onClick={() => void handleCreate()}
						>
							{isEditMode ? t('edit_save_submit') : t('new_create_submit')}
						</Button>
					</div>
				</div>
				<AdvancedTagSheet
					open={tagSheetOpen}
					onOpenChange={setTagSheetOpen}
					tags={tags}
					tagColors={tagColors}
					onChange={applyTags}
					onRename={applyTagRename}
					onColorChange={applyTagColor}
					theme={theme}
				/>
			</AppMainContentContainer>
		</AppMainContentRoot>
	);
}
