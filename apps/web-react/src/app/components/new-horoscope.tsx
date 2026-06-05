import { useEffect, useMemo, useState } from 'react';
import { format, isValid, parse } from 'date-fns';
import { cs, enUS, es, fr } from 'date-fns/locale';
import { Calendar as CalendarIcon, Check, ChevronDown, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Calendar } from './ui/calendar';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from './ui/command';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { LocationSelector } from './location-selector';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { TimeRollerPicker } from './time-roller-picker';
import { AppMainContentContainer, AppMainContentRoot } from './app-main-content';
import { cn } from './ui/utils';
import { useAppFormFieldTheme } from './form-field-theme';
import type { Theme } from './astrology-sidebar';
import {
	appChartFromNewHoroscopeInput,
	type AppChart,
	type WorkspaceDefaultsState
} from '@/lib/tauri/chartPayload';
import { resolveLocation, searchLocations } from '@/lib/tauri/workspace';

type ChartKind = 'radix' | 'event' | 'horary';
type LatDir = 'north' | 'south';
type LonDir = 'east' | 'west';
type LocationRegime = 'auto' | 'manual';

const TIMEZONES: string[] =
	typeof Intl !== 'undefined' && 'supportedValuesOf' in Intl
		? (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf(
				'timeZone'
			)
		: [];

function mergeDatePart(target: Date, pickedDate: Date): Date {
	const next = new Date(target);
	next.setFullYear(pickedDate.getFullYear(), pickedDate.getMonth(), pickedDate.getDate());
	return next;
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

function parseDateTimeString(dateTime: string): Date {
	if (!dateTime) return new Date();
	const normalized = dateTime.includes('T') ? dateTime : dateTime.replace(' ', 'T');
	const d = new Date(normalized);
	return isNaN(d.getTime()) ? new Date() : d;
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

function TagInput({
	tags,
	onChange,
	placeholder,
	panelBg,
	panelBorder,
	contentPrimary,
	contentMuted,
	softBg,
	accent
}: {
	tags: string[];
	onChange: (tags: string[]) => void;
	placeholder?: string;
	panelBg: string;
	panelBorder: string;
	contentPrimary: string;
	contentMuted: string;
	softBg: string;
	accent: string;
}) {
	const [input, setInput] = useState('');

	const commit = (raw: string) => {
		const next = raw
			.split(',')
			.map((t) => t.trim())
			.filter((t) => t.length > 0 && !tags.includes(t));
		if (next.length > 0) onChange([...tags, ...next]);
		setInput('');
	};

	return (
		<div
			className={cn(
				'flex min-h-10 flex-wrap items-center gap-1.5 rounded-xl border px-3 py-2 transition-all',
				'focus-within:ring-2 focus-within:border-transparent',
				panelBg,
				panelBorder
			)}
			style={
				{
					'--tw-ring-color': `var(--theme-accent)`
				} as React.CSSProperties
			}
		>
			{tags.map((tag) => (
				<span
					key={tag}
					className={cn(
						'flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-medium',
						'bg-[color:var(--theme-selected-bg)]',
						contentPrimary
					)}
				>
					{tag}
					<button
						type="button"
						onClick={() => onChange(tags.filter((t) => t !== tag))}
						className={cn('ml-0.5 rounded-full p-0.5 transition-colors', `hover:text-[color:var(--theme-accent)]`, contentMuted)}
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
	);
}

function TimezoneSelect({
	value,
	onValueChange,
	placeholder,
	triggerClassName,
	contentClassName,
	itemClassName
}: {
	value: string;
	onValueChange: (v: string) => void;
	placeholder?: string;
	triggerClassName?: string;
	contentClassName?: string;
	itemClassName?: string;
}) {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState('');

	const filtered = useMemo(() => {
		const q = search.trim().toLowerCase();
		if (!q) return TIMEZONES.slice(0, 120);
		return TIMEZONES.filter((tz) => tz.toLowerCase().includes(q)).slice(0, 120);
	}, [search]);

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
			<PopoverContent className={cn('w-[var(--radix-popover-trigger-width)] p-0', contentClassName)} align="end">
				<Command className="bg-transparent text-[color:var(--theme-content-primary)]">
					<CommandInput
						value={search}
						onValueChange={setSearch}
						placeholder={placeholder ?? 'Search…'}
						className="text-[color:var(--theme-content-primary)] placeholder:text-[color:var(--theme-content-muted)]"
					/>
					<CommandList>
						{filtered.length === 0 && <CommandEmpty>No timezone found.</CommandEmpty>}
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
								<Check
									className={cn('mr-2 h-4 w-4', value === tz ? 'opacity-100' : 'opacity-0')}
								/>
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

	const [locationName, setLocationName] = useState(() => initialValues?.name ?? '');
	const [location, setLocation] = useState(() => initialValues?.location ?? workspaceDefaults.locationName ?? '');
	const [tags, setTags] = useState<string[]>(() => initialValues?.tags ?? []);
	const [selectedDateTime, setSelectedDateTime] = useState<Date>(() =>
		initialValues?.dateTime ? parseDateTimeString(initialValues.dateTime) : new Date()
	);
	const [chartKind, setChartKind] = useState<ChartKind>(() =>
		initialValues ? chartTypeToKind(initialValues.chartType) : 'radix'
	);
	const [locationRegime, setLocationRegime] = useState<LocationRegime>(() =>
		initialValues?.latitude != null ? 'manual' : 'auto'
	);
	const [latitude, setLatitude] = useState(() =>
		initialValues?.latitude != null ? formatCoordinateMagnitude(initialValues.latitude) : ''
	);
	const [longitude, setLongitude] = useState(() =>
		initialValues?.longitude != null ? formatCoordinateMagnitude(initialValues.longitude) : ''
	);
	const [timezone, setTimezone] = useState(() => initialValues?.timezone ?? workspaceDefaults.timezone ?? '');
	const [latitudeDir, setLatitudeDir] = useState<LatDir>(() =>
		(initialValues?.latitude ?? 0) >= 0 ? 'north' : 'south'
	);
	const [longitudeDir, setLongitudeDir] = useState<LonDir>(() =>
		(initialValues?.longitude ?? 0) >= 0 ? 'east' : 'west'
	);
	const [rodenRating, setRodenRating] = useState(() => initialValues?.rodenRating ?? '');
	const [isResolvingLocation, setIsResolvingLocation] = useState(false);

	const [datePopoverOpen, setDatePopoverOpen] = useState(false);

	const dateFnsLocale = useMemo(() => {
		const base = i18n.language.split('-')[0]?.toLowerCase() ?? 'en';
		if (base === 'cs') return cs;
		if (base === 'fr') return fr;
		if (base === 'es') return es;
		return enUS;
	}, [i18n.language]);

	const [draftDateValue, setDraftDateValue] = useState(() =>
		format(selectedDateTime, 'P', { locale: dateFnsLocale })
	);

	useEffect(() => {
		setDraftDateValue(format(selectedDateTime, 'P', { locale: dateFnsLocale }));
	}, [selectedDateTime, dateFnsLocale]);

	const commitDraftDateValue = () => {
		const parsed = parse(draftDateValue.trim(), 'P', new Date(), { locale: dateFnsLocale });
		if (!isValid(parsed)) {
			setDraftDateValue(format(selectedDateTime, 'P', { locale: dateFnsLocale }));
			return;
		}
		setSelectedDateTime((prev) => mergeDatePart(prev, parsed));
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
		resolvedLongitude: number
	) => {
		setLocation(displayName);
		setLatitude(formatCoordinateMagnitude(resolvedLatitude));
		setLongitude(formatCoordinateMagnitude(resolvedLongitude));
		setLatitudeDir(resolvedLatitude >= 0 ? 'north' : 'south');
		setLongitudeDir(resolvedLongitude >= 0 ? 'east' : 'west');
	};

	const resolveCurrentLocation = async () => {
		if (!currentLocationQuery) {
			toast.error(t('toast_location_required'));
			return null;
		}

		setIsResolvingLocation(true);
		try {
			const resolved = await resolveLocation(currentLocationQuery);
			applyResolvedLocation(resolved.display_name, resolved.latitude, resolved.longitude);
			toast.success(t('toast_location_resolved'), {
				description: `${resolved.latitude.toFixed(4)}, ${resolved.longitude.toFixed(4)}`
			});
			return resolved;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			toast.error(t('toast_location_resolve_failed'), { description: message });
			return null;
		} finally {
			setIsResolvingLocation(false);
		}
	};

	const handleCreate = async () => {
		const name = locationName.trim();
		if (!name) {
			toast.error(t('toast_chart_name_required'));
			return;
		}

		let resolvedLocation = location;
		let resolvedLatitude = latitude;
		let resolvedLongitude = longitude;
		let resolvedLatitudeDir = latitudeDir;
		let resolvedLongitudeDir = longitudeDir;

		if ((!resolvedLatitude.trim() || !resolvedLongitude.trim()) && currentLocationQuery) {
			const resolved = await resolveCurrentLocation();
			if (resolved) {
				resolvedLocation = resolved.display_name;
				resolvedLatitude = formatCoordinateMagnitude(resolved.latitude);
				resolvedLongitude = formatCoordinateMagnitude(resolved.longitude);
				resolvedLatitudeDir = resolved.latitude >= 0 ? 'north' : 'south';
				resolvedLongitudeDir = resolved.longitude >= 0 ? 'east' : 'west';
			}
		}

		const chart = appChartFromNewHoroscopeInput({
			locationName,
			chartKind,
			dateTime: selectedDateTime,
			location: resolvedLocation,
			tags: tags.join(', '),
			latitude: resolvedLatitude,
			longitude: resolvedLongitude,
			latitudeDir: resolvedLatitudeDir,
			longitudeDir: resolvedLongitudeDir,
			timezone,
			advancedMode: locationRegime === 'manual',
			rodenRating: rodenRating || undefined,
			workspaceDefaults,
			existingIds: existingChartIds
		});

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
						{isEditMode ? t('edit_radix_title', { defaultValue: 'Edit Chart' }) : t('new_radix_title')}
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

					<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
						<div className="flex flex-col gap-2">
							<Label htmlFor="new-chart-date" className={cn('mb-1.5 block', ft.label)}>
								{t('new_date')}
							</Label>
							<Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
								<div
									className={cn(
										'flex min-h-10 w-full items-stretch overflow-hidden rounded-xl border text-base shadow-inner transition-all md:text-sm',
										'border-[color:var(--theme-panel-border)] bg-[color:var(--theme-panel-bg)] text-[color:var(--theme-content-primary)] backdrop-blur-sm',
										'focus-within:border-transparent focus-within:ring-2 focus-within:ring-[var(--theme-accent)]'
									)}
								>
									<Input
										id="new-chart-date"
										type="text"
										inputMode="numeric"
										value={draftDateValue}
										onChange={(event) => setDraftDateValue(event.target.value)}
										onBlur={commitDraftDateValue}
										onKeyDown={(event) => {
											if (event.key === 'Enter') {
												commitDraftDateValue();
												setDatePopoverOpen(false);
											}
										}}
										className="h-full flex-1 rounded-none border-0 bg-transparent px-4 py-2.5 shadow-none focus-visible:ring-0"
										placeholder={format(new Date(), 'P', { locale: dateFnsLocale })}
									/>
									<PopoverTrigger asChild>
										<Button
											type="button"
											variant="ghost"
											className="h-full rounded-none border-l border-[color:var(--theme-panel-border)] px-3 shadow-none hover:bg-[color:var(--theme-soft-bg)]"
										>
											<CalendarIcon className={cn('h-4 w-4 shrink-0', ft.iconColor)} />
										</Button>
									</PopoverTrigger>
								</div>
								<PopoverContent className={cn('w-auto p-0', ft.datePicker)} align="end">
									<Calendar
										mode="single"
										selected={selectedDateTime}
										onSelect={(d) => {
											if (d) setSelectedDateTime((prev) => mergeDatePart(prev, d));
											setDatePopoverOpen(false);
										}}
										locale={dateFnsLocale}
										initialFocus
										defaultMonth={selectedDateTime}
									/>
								</PopoverContent>
							</Popover>
						</div>

						<div className="flex flex-col gap-2">
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
					</div>

					{/* Location regime */}
					<div>
						<div className="mb-3 flex items-center justify-between">
							<Label className={ft.label}>{t('new_location')}</Label>
							<div className="flex items-center gap-2">
								<span className={cn('text-sm', ft.muted)}>
									{locationRegime === 'auto' ? t('new_time_regime_auto') : t('new_time_regime_manual')}
								</span>
								<Switch
									id="location-regime"
									checked={locationRegime === 'manual'}
									onCheckedChange={(checked) =>
										setLocationRegime(checked ? 'manual' : 'auto')
									}
									className={cn(
										'data-[state=checked]:bg-[color:var(--theme-accent)]',
										ft.switchUnchecked
									)}
								/>
							</div>
						</div>

						{locationRegime === 'auto' ? (
							<LocationSelector
								id="location"
								value={location}
								onValueChange={setLocation}
								options={locationOptions}
								placeholder={t('new_placeholder_any_location')}
								searchPlaceholder={t('new_location_search')}
								emptyLabel={t('new_placeholder_any_location')}
								loadingLabel={t('new_resolving_location')}
								className={ft.selectTrigger}
								iconClassName={ft.iconColor}
								searchLocations={searchLocations}
								onResolvedLocationSelect={(result) =>
									applyResolvedLocation(result.display_name, result.latitude, result.longitude)
								}
							/>
						) : (
							<div className={cn('space-y-3', ft.advancedPanel)}>
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
											className={cn(ft.input, 'shadow-inner flex-1')}
										/>
										<Select value={latitudeDir} onValueChange={(v) => setLatitudeDir(v as LatDir)}>
											<SelectTrigger className={cn(ft.selectTrigger, 'shadow-inner w-28 shrink-0')}>
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
											className={cn(ft.input, 'shadow-inner flex-1')}
										/>
										<Select
											value={longitudeDir}
											onValueChange={(v) => setLongitudeDir(v as LonDir)}
										>
											<SelectTrigger className={cn(ft.selectTrigger, 'shadow-inner w-28 shrink-0')}>
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

								{/* Timezone */}
								<div>
									<Label htmlFor="timezone" className={cn('mb-1.5 block', ft.label)}>
										{t('new_utc_shift_definition')}
									</Label>
									<TimezoneSelect
										value={timezone}
										onValueChange={setTimezone}
										placeholder={t('new_timezone_placeholder')}
										triggerClassName={cn(ft.selectTrigger, 'shadow-inner px-4 py-2.5')}
										contentClassName={ft.selectContent}
										itemClassName={ft.selectItem}
									/>
								</div>
							</div>
						)}
					</div>

					{/* Tags */}
					<div>
						<Label className={cn('mb-1.5 block', ft.label)}>{t('new_tags')}</Label>
						<TagInput
							tags={tags}
							onChange={setTags}
							placeholder={t('new_tags_comma_hint')}
							panelBg="bg-[color:var(--theme-panel-bg)] backdrop-blur-sm"
							panelBorder="border border-[color:var(--theme-panel-border)]"
							contentPrimary="text-[color:var(--theme-content-primary)]"
							contentMuted="text-[color:var(--theme-content-muted)]"
							softBg="bg-[color:var(--theme-soft-bg)]"
							accent="text-[color:var(--theme-accent)]"
						/>
					</div>

					{/* Roden Rating */}
					<div>
						<Label htmlFor="roden-rating" className={cn('mb-1.5 block', ft.label)}>
							{t('new_roden_rating', { defaultValue: 'Roden Rating' })}
						</Label>
						<Select value={rodenRating} onValueChange={setRodenRating}>
							<SelectTrigger id="roden-rating" className={cn(ft.selectTrigger, 'shadow-inner')}>
								<SelectValue placeholder={t('new_roden_rating_placeholder', { defaultValue: 'Select rating…' })} />
							</SelectTrigger>
							<SelectContent className={ft.selectContent}>
								{RODEN_RATINGS.map((opt) => (
									<SelectItem key={opt.id} value={opt.id} className={ft.selectItem}>
										{opt.id} – {t(opt.labelKey, { defaultValue: opt.id })}
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
							{isEditMode ? t('edit_save_submit', { defaultValue: 'Save Chart' }) : t('new_create_submit')}
						</Button>
					</div>
				</div>
			</AppMainContentContainer>
		</AppMainContentRoot>
	);
}
