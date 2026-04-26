import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { cs, enUS, es, fr } from 'date-fns/locale';
import { Calendar as CalendarIcon, LocateFixed } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Calendar } from './ui/calendar';
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

function mergeDatePart(target: Date, pickedDate: Date): Date {
	const next = new Date(target);
	next.setFullYear(pickedDate.getFullYear(), pickedDate.getMonth(), pickedDate.getDate());
	return next;
}

function formatCoordinateMagnitude(value: number): string {
	return Math.abs(value).toFixed(4);
}

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

interface NewHoroscopeProps {
	theme?: Theme;
	/** Return to main horoscope view (sidebar **Horoskop**). */
	onBack?: () => void;
	workspaceDefaults: WorkspaceDefaultsState;
	existingChartIds: ReadonlySet<string>;
	/** Persist + navigate home; chart is appended to workspace context tabs. */
	onCreated?: (chart: AppChart) => void | Promise<void>;
}

export function NewHoroscope({
	theme = 'noon',
	onBack,
	workspaceDefaults,
	existingChartIds,
	onCreated
}: NewHoroscopeProps) {
	const { t, i18n } = useTranslation();
	const ft = useAppFormFieldTheme(theme);

	const [locationName, setLocationName] = useState('');
	const [location, setLocation] = useState('');
	const [tags, setTags] = useState('');
	const [selectedDateTime, setSelectedDateTime] = useState<Date>(() => new Date());
	const [chartKind, setChartKind] = useState<ChartKind>('radix');
	const [advancedMode, setAdvancedMode] = useState(false);
	const [latitude, setLatitude] = useState('');
	const [longitude, setLongitude] = useState('');
	const [timezone, setTimezone] = useState('');
	const [latitudeDir, setLatitudeDir] = useState<LatDir>('north');
	const [longitudeDir, setLongitudeDir] = useState<LonDir>('east');
	const [isResolvingLocation, setIsResolvingLocation] = useState(false);

	const [datePopoverOpen, setDatePopoverOpen] = useState(false);

	const dateFnsLocale = useMemo(() => {
		const base = i18n.language.split('-')[0]?.toLowerCase() ?? 'en';
		if (base === 'cs') return cs;
		if (base === 'fr') return fr;
		if (base === 'es') return es;
		return enUS;
	}, [i18n.language]);

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
			tags,
			latitude: resolvedLatitude,
			longitude: resolvedLongitude,
			latitudeDir: resolvedLatitudeDir,
			longitudeDir: resolvedLongitudeDir,
			timezone,
			advancedMode,
			workspaceDefaults,
			existingIds: existingChartIds
		});
		await onCreated?.(chart);
	};

	const bgStyle =
		theme === 'midnight'
			? {
					background:
						'radial-gradient(ellipse at center, #0D1B2E 0%, #0A1528 25%, #0B1729 60%, #0E1A2D 100%)'
				}
			: undefined;

	return (
		<AppMainContentRoot
			className={cn(ft.formPageBg, theme === 'twilight' && 'kefer-twilight-bg')}
			style={bgStyle}
		>
			<AppMainContentContainer layout="center-column">
				<h1 className={cn('mb-5 text-xl font-semibold', ft.title)}>{t('new_radix_title')}</h1>

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
									<PopoverTrigger asChild>
										<Button
											type="button"
											id="new-chart-date"
											variant="outline"
											className={cn(
												'h-10 w-full justify-start text-left font-normal shadow-inner',
												ft.selectTrigger
											)}
										>
											<CalendarIcon className={cn('mr-2 h-4 w-4 shrink-0', ft.iconColor)} />
											{format(selectedDateTime, 'P', { locale: dateFnsLocale })}
										</Button>
									</PopoverTrigger>
									<PopoverContent className={cn('w-auto p-0', ft.datePicker)} align="start">
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
										triggerClassName={cn(ft.input, ft.selectTrigger)}
										iconClassName={ft.iconColor}
										panelClassName={ft.selectContent}
									/>
								</div>
							</div>

						<div>
							<Label htmlFor="location" className={cn('mb-1.5 block', ft.label)}>
								{t('new_location')}
							</Label>
							<div className="space-y-2">
								<LocationSelector
									id="location"
									value={location}
									onValueChange={setLocation}
									options={locationOptions}
									placeholder={t('new_placeholder_any_location')}
									searchPlaceholder={t('new_location_search')}
									emptyLabel={t('new_placeholder_any_location')}
									loadingLabel={t('new_resolving_location')}
									disabled={advancedMode}
									className={cn(ft.selectTrigger, advancedMode && cn(ft.inputDisabled, 'border'))}
									iconClassName={ft.iconColor}
									searchLocations={searchLocations}
									onResolvedLocationSelect={(result) =>
										applyResolvedLocation(
											result.display_name,
											result.latitude,
											result.longitude
										)
									}
								/>
								<div className="flex justify-end">
									<Button
										type="button"
										variant="outline"
										onClick={() => void resolveCurrentLocation()}
										disabled={advancedMode || isResolvingLocation || !location.trim()}
										className={cn('shadow-inner', ft.selectTrigger)}
									>
										<LocateFixed className={cn('mr-2 h-4 w-4', ft.iconColor)} />
										{isResolvingLocation ? t('new_resolving_location') : t('new_resolve_location')}
									</Button>
								</div>
							</div>
						</div>

						<div>
							<Label htmlFor="tags" className={cn('mb-1.5 block', ft.label)}>
								{t('new_tags')}
							</Label>
							<Input
								type="text"
								id="tags"
								value={tags}
								onChange={(e) => setTags(e.target.value)}
								placeholder={t('new_tags_comma_hint')}
								className={cn(ft.input, 'shadow-inner')}
							/>
						</div>

						<div className="flex items-center justify-between py-3">
							<span className={cn('text-sm font-medium', ft.label)}>
								{t('new_advanced_settings')}
							</span>
							<Switch
								checked={advancedMode}
								onCheckedChange={setAdvancedMode}
								className={cn(
									'h-6 w-11 shrink-0 scale-100 data-[state=checked]:bg-blue-600',
									ft.switchUnchecked
								)}
							/>
						</div>

						{advancedMode && (
							<div className={cn('space-y-4', ft.advancedPanel)}>
								<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
									<div className="space-y-4">
										<div>
											<Label htmlFor="latitude" className={cn('mb-1.5 block', ft.label)}>
												{t('current_info_latitude')}
											</Label>
											<Input
												type="text"
												id="latitude"
												value={latitude}
												onChange={(e) => setLatitude(e.target.value)}
												placeholder="50.0755"
												className={cn(ft.input, 'shadow-inner')}
											/>
										</div>
										<div>
											<Label htmlFor="longitude" className={cn('mb-1.5 block', ft.label)}>
												{t('current_info_longitude')}
											</Label>
											<Input
												type="text"
												id="longitude"
												value={longitude}
												onChange={(e) => setLongitude(e.target.value)}
												placeholder="14.4378"
												className={cn(ft.input, 'shadow-inner')}
											/>
										</div>
										<div>
											<Label htmlFor="timezone" className={cn('mb-1.5 block', ft.label)}>
												{t('new_advanced_timezone')}
											</Label>
											<Input
												type="text"
												id="timezone"
												value={timezone}
												onChange={(e) => setTimezone(e.target.value)}
												placeholder={t('placeholder_utc_offset')}
												className={cn(ft.input, 'shadow-inner')}
											/>
										</div>
									</div>

									<div className="space-y-4">
										<div>
											<Label htmlFor="lat-dir" className={cn('mb-1.5 block', ft.label)}>
												{t('new_lat_direction')}
											</Label>
											<Select
												value={latitudeDir}
												onValueChange={(v) => setLatitudeDir(v as LatDir)}
											>
												<SelectTrigger
													id="lat-dir"
													className={cn(ft.selectTrigger, 'shadow-inner')}
												>
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
										<div>
											<Label htmlFor="lon-dir" className={cn('mb-1.5 block', ft.label)}>
												{t('new_lon_direction')}
											</Label>
											<Select
												value={longitudeDir}
												onValueChange={(v) => setLongitudeDir(v as LonDir)}
											>
												<SelectTrigger
													id="lon-dir"
													className={cn(ft.selectTrigger, 'shadow-inner')}
												>
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
										<div>
											<Label className={cn('mb-1.5 block', ft.label)}>
												{t('new_ephemeris_label')}
											</Label>
											<div
												className={cn(
													'w-full rounded-lg px-4 py-2.5 text-base md:text-sm',
													ft.inputDisabled,
													'border-0'
												)}
											>
												{t('new_engine_swiss')}
											</div>
										</div>
									</div>
								</div>
							</div>
						)}

						<div className="flex gap-4 pt-4">
							<Button
								type="button"
								variant="ghost"
								className={ft.footerCancel}
								onClick={() => onBack?.()}
							>
								{t('new_back')}
							</Button>
							<Button
								type="button"
								variant="ghost"
								className={ft.footerPrimary}
								onClick={() => void handleCreate()}
							>
								{t('new_create_submit')}
							</Button>
						</div>
				</div>
			</AppMainContentContainer>
		</AppMainContentRoot>
	);
}
