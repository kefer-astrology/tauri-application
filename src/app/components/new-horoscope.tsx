import React, { useMemo, useState } from 'react';
import { Calendar, ChevronDown, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Card, CardContent } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { cn } from './ui/utils';
import { getAppFormFieldTheme } from './form-field-theme';
import type { Theme } from './astrology-sidebar';
import twilightBg from '@/assets/4dcbee9e5042848c83d74ae11e665f672e4fffc2.png';
import {
	appChartFromNewHoroscopeInput,
	type AppChart,
	type WorkspaceDefaultsState
} from '@/lib/tauri/chartPayload';

type ChartKind = 'radix' | 'event' | 'horary';
type LatDir = 'north' | 'south';
type LonDir = 'east' | 'west';

function chartLocaleTag(lng: string): string {
	const base = lng.split('-')[0]?.toLowerCase() ?? 'en';
	if (base === 'cs') return 'cs-CZ';
	if (base === 'fr') return 'fr-FR';
	if (base === 'es') return 'es-ES';
	return 'en-US';
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
	const ft = useMemo(() => getAppFormFieldTheme(theme), [theme]);

	const [locationName, setLocationName] = useState('');
	const [location, setLocation] = useState('');
	const [advancedLocation, setAdvancedLocation] = useState('');
	const [tags, setTags] = useState('');
	const [date, setDate] = useState('');
	const [time, setTime] = useState('');
	const [chartKind, setChartKind] = useState<ChartKind>('radix');
	const [advancedMode, setAdvancedMode] = useState(false);
	const [latitude, setLatitude] = useState('');
	const [longitude, setLongitude] = useState('');
	const [timezone, setTimezone] = useState('');
	const [latitudeDir, setLatitudeDir] = useState<LatDir>('north');
	const [longitudeDir, setLongitudeDir] = useState<LonDir>('east');

	const [datePickerOpen, setDatePickerOpen] = useState(false);

	const localeTag = chartLocaleTag(i18n.language);

	const handleCreate = async () => {
		const name = locationName.trim();
		if (!name) {
			toast.error(t('toast_chart_name_required'));
			return;
		}
		const chart = appChartFromNewHoroscopeInput({
			locationName,
			chartKind,
			date,
			time,
			location,
			advancedLocation,
			tags,
			latitude,
			longitude,
			timezone,
			advancedMode,
			workspaceDefaults,
			existingIds: existingChartIds
		});
		await onCreated?.(chart);
	};

	const monthNames = useMemo(
		() =>
			Array.from({ length: 12 }, (_, monthIndex) =>
				new Intl.DateTimeFormat(localeTag, { month: 'long' }).format(new Date(2000, monthIndex, 1))
			),
		[localeTag]
	);

	const weekdayShort = useMemo(() => {
		const monday = new Date(2024, 0, 1);
		return Array.from({ length: 7 }, (_, i) => {
			const d = new Date(monday);
			d.setDate(monday.getDate() + i);
			return new Intl.DateTimeFormat(localeTag, { weekday: 'short' }).format(d);
		});
	}, [localeTag]);

	const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
	const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
	const [selectedDay, setSelectedDay] = useState<number | null>(null);

	const getDaysInMonth = (year: number, month: number) => {
		return new Date(year, month + 1, 0).getDate();
	};

	const getFirstDayOfMonth = (year: number, month: number) => {
		return new Date(year, month, 1).getDay();
	};

	const handleDateSelect = (day: number) => {
		setSelectedDay(day);
		const formattedDate = `${String(day).padStart(2, '0')}/${String(selectedMonth + 1).padStart(2, '0')}/${selectedYear}`;
		setDate(formattedDate);
		setDatePickerOpen(false);
	};

	const yearOptions = useMemo(
		() => Array.from({ length: 150 }, (_, i) => selectedYear - 75 + i),
		[selectedYear]
	);

	const bgStyle =
		theme === 'midnight'
			? {
					background:
						'radial-gradient(ellipse at center, #0D1B2E 0%, #0A1528 25%, #0B1729 60%, #0E1A2D 100%)'
				}
			: theme === 'twilight'
				? {
						backgroundImage: `url(${twilightBg})`,
						backgroundSize: 'cover',
						backgroundPosition: 'center',
						backgroundRepeat: 'no-repeat',
						backgroundAttachment: 'fixed'
					}
				: undefined;

	return (
		<div className={cn('min-h-screen px-4 py-6 sm:px-6 lg:px-8', ft.formPageBg)} style={bgStyle}>
			<div className="mx-auto max-w-2xl">
				<h1 className={cn('mb-5 text-xl font-semibold', ft.title)}>{t('new_radix_title')}</h1>

				<Card className={cn('gap-0 border p-0 shadow-lg', ft.settingsCard)}>
					<CardContent className="space-y-4 p-6">
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
							<div className="relative">
								<Label htmlFor="date" className={cn('mb-1.5 block', ft.label)}>
									{t('new_date')}
								</Label>
								<div className="relative">
									<Input
										type="text"
										id="date"
										value={date}
										onChange={(e) => setDate(e.target.value)}
										placeholder={t('new_date_placeholder')}
										className={cn(ft.input, 'pr-12 shadow-inner')}
									/>
									<button
										type="button"
										onClick={() => setDatePickerOpen(!datePickerOpen)}
										className={cn(
											'absolute top-1/2 right-3 -translate-y-1/2 rounded p-1 transition-colors',
											ft.datePickerButton
										)}
									>
										<Calendar className={cn('h-5 w-5', ft.iconColor)} />
									</button>
								</div>

								{datePickerOpen && (
									<div className={cn('absolute z-20 mt-2', ft.datePicker)}>
										<div className="mb-4 flex items-center justify-between">
											<button
												type="button"
												onClick={() =>
													setSelectedMonth(selectedMonth === 0 ? 11 : selectedMonth - 1)
												}
												className={cn('rounded p-1 transition-colors', ft.datePickerButton)}
											>
												<ChevronDown className={cn('h-5 w-5 rotate-90', ft.iconColor)} />
											</button>
											<div className="flex gap-2">
												<Select
													value={String(selectedMonth)}
													onValueChange={(v) => setSelectedMonth(Number(v))}
												>
													<SelectTrigger
														size="sm"
														className={cn(ft.inputCompact, 'h-8 min-h-8 w-[min(11rem,42vw)]')}
													>
														<SelectValue />
													</SelectTrigger>
													<SelectContent className={ft.selectContent}>
														{monthNames.map((month, idx) => (
															<SelectItem key={idx} value={String(idx)} className={ft.selectItem}>
																{month}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
												<Select
													value={String(selectedYear)}
													onValueChange={(v) => setSelectedYear(Number(v))}
												>
													<SelectTrigger
														size="sm"
														className={cn(ft.inputCompact, 'h-8 min-h-8 w-[5.5rem]')}
													>
														<SelectValue />
													</SelectTrigger>
													<SelectContent className={cn(ft.selectContent, 'max-h-60')}>
														{yearOptions.map((year) => (
															<SelectItem key={year} value={String(year)} className={ft.selectItem}>
																{year}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											</div>
											<button
												type="button"
												onClick={() =>
													setSelectedMonth(selectedMonth === 11 ? 0 : selectedMonth + 1)
												}
												className={cn('rounded p-1 transition-colors', ft.datePickerButton)}
											>
												<ChevronDown className={cn('h-5 w-5 -rotate-90', ft.iconColor)} />
											</button>
										</div>

										<div className="mb-2 grid grid-cols-7 gap-1">
											{weekdayShort.map((day) => (
												<div
													key={day}
													className={cn(
														'py-1 text-center text-xs font-medium',
														ft.datePickerHeader
													)}
												>
													{day}
												</div>
											))}
										</div>

										<div className="grid grid-cols-7 gap-1">
											{Array.from({
												length: (getFirstDayOfMonth(selectedYear, selectedMonth) + 6) % 7
											}).map((_, idx) => (
												<div key={`empty-${idx}`} />
											))}
											{Array.from(
												{ length: getDaysInMonth(selectedYear, selectedMonth) },
												(_, i) => i + 1
											).map((day) => (
												<button
													key={day}
													type="button"
													onClick={() => handleDateSelect(day)}
													className={cn(
														'flex aspect-square items-center justify-center rounded text-sm transition-colors',
														ft.datePickerDay,
														selectedDay === day && ft.datePickerDayActive
													)}
												>
													{day}
												</button>
											))}
										</div>
									</div>
								)}
							</div>

							<div className="relative">
								<Label htmlFor="time" className={cn('mb-1.5 block', ft.label)}>
									{t('new_time')}
								</Label>
								<div className="relative">
									<Input
										type="time"
										id="time"
										value={time}
										onChange={(e) => setTime(e.target.value)}
										className={cn(
											ft.input,
											'pr-10 shadow-inner [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-3 [&::-webkit-calendar-picker-indicator]:h-5 [&::-webkit-calendar-picker-indicator]:w-5 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0'
										)}
									/>
									<div className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">
										<Clock className={cn('h-5 w-5', ft.iconColor)} />
									</div>
								</div>
							</div>
						</div>

						<div>
							<Label htmlFor="location" className={cn('mb-1.5 block', ft.label)}>
								{t('new_location')}
							</Label>
							<Input
								type="text"
								id="location"
								value={location}
								onChange={(e) => setLocation(e.target.value)}
								placeholder={t('new_placeholder_any_location')}
								disabled={advancedMode}
								className={cn(
									ft.input,
									'shadow-inner',
									advancedMode && cn(ft.inputDisabled, 'border')
								)}
							/>
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
								<div>
									<Label htmlFor="advancedLocation" className={cn('mb-1.5 block', ft.label)}>
										{t('new_location')}
									</Label>
									<Input
										type="text"
										id="advancedLocation"
										value={advancedLocation}
										onChange={(e) => setAdvancedLocation(e.target.value)}
										placeholder={t('new_placeholder_prague')}
										className={cn(ft.input, 'shadow-inner')}
									/>
								</div>

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
													'w-full rounded-lg border px-4 py-2.5 text-base md:text-sm',
													ft.inputDisabled
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
							<button type="button" className={ft.footerCancel} onClick={() => onBack?.()}>
								{t('new_back')}
							</button>
							<button type="button" className={ft.footerPrimary} onClick={() => void handleCreate()}>
								{t('new_create_submit')}
							</button>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
