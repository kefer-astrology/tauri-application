import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { cs, enUS, es, fr } from 'date-fns/locale';
import { Calendar as CalendarIcon, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Calendar } from './ui/calendar';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
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

function formatDdMmYyyy(d: Date): string {
	return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

type TimeSeg = 'h' | 'm' | 's';

const TIME_SEGS: TimeSeg[] = ['h', 'm', 's'];

function rollParts(parts: { h: number; m: number; s: number }, seg: TimeSeg, delta: number) {
	let sec = parts.h * 3600 + parts.m * 60 + parts.s;
	if (seg === 'h') sec += delta * 3600;
	else if (seg === 'm') sec += delta * 60;
	else sec += delta;
	sec = ((sec % 86400) + 86400) % 86400;
	return {
		h: Math.floor(sec / 3600),
		m: Math.floor((sec % 3600) / 60),
		s: sec % 60
	};
}

function rollingTimeInteract(
	prev: { h: number; m: number; s: number } | null,
	seg: TimeSeg,
	delta: number
) {
	const base = prev ?? { h: 0, m: 0, s: 0 };
	return rollParts(base, seg, delta);
}

function nextTimeSeg(seg: TimeSeg, dir: 1 | -1): TimeSeg {
	const i = TIME_SEGS.indexOf(seg);
	return TIME_SEGS[(i + dir + 3) % 3];
}

function RollingTimeField({
	value,
	onChange,
	id,
	'aria-label': ariaLabel,
	ft
}: {
	value: { h: number; m: number; s: number } | null;
	onChange: (v: { h: number; m: number; s: number }) => void;
	id: string;
	'aria-label': string;
	ft: ReturnType<typeof getAppFormFieldTheme>;
}) {
	const [active, setActive] = useState<TimeSeg>('h');
	const fieldRef = useRef<HTMLDivElement>(null);

	const segActive = cn(
		'rounded px-0.5',
		ft.isDark || ft.isTwilight
			? 'bg-blue-900/55 ring-1 ring-inset ring-blue-400/60'
			: ft.isSunrise
				? 'bg-sky-200/90 ring-1 ring-inset ring-sky-500/45'
				: 'bg-muted ring-1 ring-inset ring-border'
	);

	const displaySeg = (n: number | null) => (n === null ? '--' : String(n).padStart(2, '0'));

	const h = value?.h ?? null;
	const m = value?.m ?? null;
	const s = value?.s ?? null;

	const applyRoll = useCallback(
		(delta: number) => {
			onChange(rollingTimeInteract(value, active, delta));
		},
		[value, active, onChange]
	);

	useEffect(() => {
		const el = fieldRef.current;
		if (!el) return;
		const onWheel = (e: WheelEvent) => {
			if (e.ctrlKey || e.deltaX !== 0 || e.deltaY === 0) return;
			e.preventDefault();
			e.stopPropagation();
			applyRoll(e.deltaY < 0 ? 1 : -1);
		};
		el.addEventListener('wheel', onWheel, { passive: false });
		return () => el.removeEventListener('wheel', onWheel);
	}, [applyRoll]);

	return (
		<div className="relative w-full">
			<div
				ref={fieldRef}
				id={id}
				role="group"
				aria-label={ariaLabel}
				tabIndex={0}
				className={cn(
					ft.input,
					'flex w-full items-center justify-center gap-0 pr-11 font-mono text-base tabular-nums shadow-inner outline-none focus-visible:ring-2 focus-visible:ring-blue-500 md:text-sm',
					!value && ft.muted
				)}
				onKeyDown={(e) => {
					if (e.key === 'ArrowRight') {
						e.preventDefault();
						setActive((cur) => nextTimeSeg(cur, 1));
					} else if (e.key === 'ArrowLeft') {
						e.preventDefault();
						setActive((cur) => nextTimeSeg(cur, -1));
					} else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
						e.preventDefault();
						applyRoll(1);
					} else if (e.key === 'ArrowDown' || e.key === 'PageDown') {
						e.preventDefault();
						applyRoll(-1);
					}
				}}
			>
				<span
					className={cn(
						'inline-block min-w-[2.25rem] cursor-pointer text-center',
						active === 'h' && segActive
					)}
					onClick={(ev) => {
						ev.stopPropagation();
						setActive('h');
					}}
				>
					{displaySeg(h)}
				</span>
				<span className={cn('select-none px-0.5', ft.muted)} aria-hidden>
					:
				</span>
				<span
					className={cn(
						'inline-block min-w-[2.25rem] cursor-pointer text-center',
						active === 'm' && segActive
					)}
					onClick={(ev) => {
						ev.stopPropagation();
						setActive('m');
					}}
				>
					{displaySeg(m)}
				</span>
				<span className={cn('select-none px-0.5', ft.muted)} aria-hidden>
					:
				</span>
				<span
					className={cn(
						'inline-block min-w-[2.25rem] cursor-pointer text-center',
						active === 's' && segActive
					)}
					onClick={(ev) => {
						ev.stopPropagation();
						setActive('s');
					}}
				>
					{displaySeg(s)}
				</span>
			</div>
			<Clock
				className={cn('pointer-events-none absolute top-1/2 right-3 h-5 w-5 -translate-y-1/2', ft.iconColor)}
				aria-hidden
			/>
		</div>
	);
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
	const [pickedDate, setPickedDate] = useState<Date | undefined>(undefined);
	const [timeParts, setTimeParts] = useState<{ h: number; m: number; s: number } | null>(null);
	const [chartKind, setChartKind] = useState<ChartKind>('radix');
	const [advancedMode, setAdvancedMode] = useState(false);
	const [latitude, setLatitude] = useState('');
	const [longitude, setLongitude] = useState('');
	const [timezone, setTimezone] = useState('');
	const [latitudeDir, setLatitudeDir] = useState<LatDir>('north');
	const [longitudeDir, setLongitudeDir] = useState<LonDir>('east');

	const [datePopoverOpen, setDatePopoverOpen] = useState(false);

	const dateFnsLocale = useMemo(() => {
		const base = i18n.language.split('-')[0]?.toLowerCase() ?? 'en';
		if (base === 'cs') return cs;
		if (base === 'fr') return fr;
		if (base === 'es') return es;
		return enUS;
	}, [i18n.language]);

	const dateStr = useMemo(
		() => (pickedDate ? formatDdMmYyyy(pickedDate) : ''),
		[pickedDate]
	);

	const timeStr = useMemo(() => {
		if (timeParts === null) return '';
		return [timeParts.h, timeParts.m, timeParts.s]
			.map((n) => String(n).padStart(2, '0'))
			.join(':');
	}, [timeParts]);

	const handleCreate = async () => {
		const name = locationName.trim();
		if (!name) {
			toast.error(t('toast_chart_name_required'));
			return;
		}
		const chart = appChartFromNewHoroscopeInput({
			locationName,
			chartKind,
			date: dateStr,
			time: timeStr,
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
												ft.selectTrigger,
												!pickedDate && cn(ft.muted)
											)}
										>
											<CalendarIcon className={cn('mr-2 h-4 w-4 shrink-0', ft.iconColor)} />
											{pickedDate ? (
												format(pickedDate, 'P', { locale: dateFnsLocale })
											) : (
												<span>{t('new_date_placeholder')}</span>
											)}
										</Button>
									</PopoverTrigger>
									<PopoverContent className={cn('w-auto p-0', ft.datePicker)} align="start">
										<Calendar
											mode="single"
											selected={pickedDate}
											onSelect={(d) => {
												setPickedDate(d);
												setDatePopoverOpen(false);
											}}
											locale={dateFnsLocale}
											initialFocus
											defaultMonth={pickedDate ?? new Date()}
										/>
									</PopoverContent>
								</Popover>
							</div>

							<div className="flex flex-col gap-2">
								<Label htmlFor="new-chart-time" className={cn('mb-1.5 block', ft.label)}>
									{t('new_time')}
								</Label>
								<RollingTimeField
									id="new-chart-time"
									aria-label={t('new_time')}
									value={timeParts}
									onChange={setTimeParts}
									ft={ft}
								/>
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
			</div>
		</div>
	);
}
