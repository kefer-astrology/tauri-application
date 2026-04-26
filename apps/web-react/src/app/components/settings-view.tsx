import { Languages } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppMainContentContainer, AppMainContentRoot } from './app-main-content';
import { useAppFormFieldTheme } from './form-field-theme';
import { LocationSelector } from './location-selector';
import type { SettingsSectionId } from './settings-secondary-sidebar';
import type { Theme } from './astrology-sidebar';
import { Card, CardContent, CardFooter } from './ui/card';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue
} from './ui/select';
import { cn } from './ui/utils';
import type { AppLanguage } from '@/lib/i18n';
import {
	APP_SHELL_ICON_SET_KEY,
	APP_SHELL_ICON_SET_OPTIONS,
	readStoredAppShellIconSet,
	type AppShellIconSetId
} from '@/lib/app-shell';
import { ASPECT_ROWS, DEFAULT_ASPECT_COLORS, DEFAULT_ASPECT_ORBS } from '@/lib/astrology/aspects';
import { type ElementColors, type ElementId } from '@/lib/astrology/elementColors';
import {
	persistGlyphSet,
	type AstrologyGlyphSetId
} from '@/lib/astrology/glyphs';
import {
	DEFAULT_OBSERVABLE_OBJECT_IDS,
	OBSERVABLE_OBJECTS,
	OBSERVABLE_OBJECT_CATEGORY_LABELS,
	type ObservableObjectCategory
} from '@/lib/astrology/observableObjects';
import type { AspectLineTierStyleState, WorkspaceDefaultsState } from '@/lib/tauri/chartPayload';
import { searchLocations } from '@/lib/tauri/workspace';
import { AstrologyGlyph } from '@/ui/astrology-glyph';

const LANG_BUBBLES: { code: AppLanguage; label: string }[] = [
	{ code: 'cs', label: 'CS' },
	{ code: 'en', label: 'EN' },
	{ code: 'fr', label: 'FR' },
	{ code: 'es', label: 'ES' }
];

const HOUSE_SYSTEMS = [
	'Placidus',
	'Whole Sign',
	'Campanus',
	'Koch',
	'Equal',
	'Regiomontanus',
	'Vehlow',
	'Porphyry',
	'Alcabitius'
] as const;

const PRESET_OPTIONS = [
	{ value: 'default', label: 'Default' },
	{ value: 'violet', label: 'Violet' },
	{ value: 'rose', label: 'Rose' }
] as const;

const GLYPH_SET_OPTIONS = [
	{
		id: 'default' as const,
		label: 'Default',
		description: 'Current shared astrology glyph set.'
	},
	{
		id: 'modern' as const,
		label: 'Modern',
		description: 'Alternate shared astrology glyph set.'
	}
];

interface SettingsViewProps {
	theme: Theme;
	section: SettingsSectionId;
	appShellIconSet: AppShellIconSetId;
	onAppShellIconSetChange: (value: AppShellIconSetId) => void;
	astrologyGlyphSet: AstrologyGlyphSetId;
	onAstrologyGlyphSetChange: (value: AstrologyGlyphSetId) => void;
	elementColors: ElementColors;
	onElementColorsCommit: (value: ElementColors) => void;
	workspaceDefaults: WorkspaceDefaultsState;
	onWorkspaceDefaultsChange: (patch: Partial<WorkspaceDefaultsState>) => Promise<void> | void;
}

function SettingsView({
	theme,
	section,
	appShellIconSet,
	onAppShellIconSetChange,
	astrologyGlyphSet,
	onAstrologyGlyphSetChange,
	elementColors,
	onElementColorsCommit,
	workspaceDefaults,
	onWorkspaceDefaultsChange
}: SettingsViewProps) {
	const { t, i18n } = useTranslation();
	const ft = useAppFormFieldTheme(theme);
	const [settingsChanged, setSettingsChanged] = useState(false);
	const [defaultLocation, setDefaultLocation] = useState(workspaceDefaults.locationName);
	const [latitude, setLatitude] = useState(String(workspaceDefaults.locationLatitude));
	const [longitude, setLongitude] = useState(String(workspaceDefaults.locationLongitude));
	const [timezone, setTimezone] = useState(workspaceDefaults.timezone);
	const [houseSystem, setHouseSystem] = useState<string>(workspaceDefaults.houseSystem);
	const [presetValue, setPresetValue] = useState<string>('default');
	const [glyphSetValue, setGlyphSetValue] = useState<AstrologyGlyphSetId>(astrologyGlyphSet);
	const [elementDraft, setElementDraft] = useState<ElementColors>(elementColors);
	const [selectedBodies, setSelectedBodies] = useState<string[]>(
		workspaceDefaults.defaultBodies.length > 0
			? workspaceDefaults.defaultBodies
			: DEFAULT_OBSERVABLE_OBJECT_IDS
	);
	const [aspects, setAspects] = useState<Record<string, { enabled: boolean; orb: number; color: string }>>(
		() =>
			Object.fromEntries(
				ASPECT_ROWS.map((aspect) => [
					aspect.id,
					{
						enabled:
							workspaceDefaults.defaultAspects.includes(aspect.id),
						orb: workspaceDefaults.defaultAspectOrbs[aspect.id] ?? aspect.defaultOrb,
						color: workspaceDefaults.defaultAspectColors[aspect.id] ?? DEFAULT_ASPECT_COLORS[aspect.id]
					}
				])
			)
	);
	const [aspectLineTiers, setAspectLineTiers] = useState<AspectLineTierStyleState>(() => ({
		...workspaceDefaults.aspectLineTierStyle
	}));

	useEffect(() => {
		setDefaultLocation(workspaceDefaults.locationName);
		setLatitude(String(workspaceDefaults.locationLatitude));
		setLongitude(String(workspaceDefaults.locationLongitude));
		setTimezone(workspaceDefaults.timezone);
		setHouseSystem(workspaceDefaults.houseSystem);
		setSelectedBodies(
			workspaceDefaults.defaultBodies.length > 0
				? workspaceDefaults.defaultBodies
				: DEFAULT_OBSERVABLE_OBJECT_IDS
		);
		setAspects(
			Object.fromEntries(
				ASPECT_ROWS.map((aspect) => [
					aspect.id,
					{
						enabled:
							workspaceDefaults.defaultAspects.includes(aspect.id),
						orb: workspaceDefaults.defaultAspectOrbs[aspect.id] ?? aspect.defaultOrb,
						color: workspaceDefaults.defaultAspectColors[aspect.id] ?? DEFAULT_ASPECT_COLORS[aspect.id]
					}
				])
			)
		);
		setAspectLineTiers({ ...workspaceDefaults.aspectLineTierStyle });
	}, [workspaceDefaults]);

	useEffect(() => {
		setGlyphSetValue(astrologyGlyphSet);
	}, [astrologyGlyphSet]);

	useEffect(() => {
		setElementDraft(elementColors);
	}, [elementColors]);

	const markChanged = useCallback(() => setSettingsChanged(true), []);

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
			label: OBSERVABLE_OBJECT_CATEGORY_LABELS[category],
			items: OBSERVABLE_OBJECTS.filter((item) => item.category === category)
		}));
	}, []);

	const onGlyphSetChange = useCallback(
		(value: string) => {
			const next = value === 'modern' ? 'modern' : 'default';
			setGlyphSetValue(next);
			onAstrologyGlyphSetChange(next);
			persistGlyphSet(next);
			markChanged();
		},
		[markChanged, onAstrologyGlyphSetChange]
	);

	const onAppShellSetChange = useCallback(
		(value: string) => {
			const next = value === 'modern' ? 'modern' : 'default';
			onAppShellIconSetChange(next);
			markChanged();
			try {
				localStorage.setItem(APP_SHELL_ICON_SET_KEY, next);
			} catch {
				/* ignore */
			}
		},
		[markChanged, onAppShellIconSetChange]
	);

	const handleCancel = useCallback(() => {
		setSettingsChanged(false);
		setDefaultLocation(workspaceDefaults.locationName);
		setLatitude(String(workspaceDefaults.locationLatitude));
		setLongitude(String(workspaceDefaults.locationLongitude));
		setTimezone(workspaceDefaults.timezone);
		setHouseSystem(workspaceDefaults.houseSystem);
		setSelectedBodies(
			workspaceDefaults.defaultBodies.length > 0
				? workspaceDefaults.defaultBodies
				: DEFAULT_OBSERVABLE_OBJECT_IDS
		);
		setAspects(
			Object.fromEntries(
				ASPECT_ROWS.map((aspect) => [
					aspect.id,
					{
						enabled:
							workspaceDefaults.defaultAspects.includes(aspect.id),
						orb: workspaceDefaults.defaultAspectOrbs[aspect.id] ?? aspect.defaultOrb,
						color: workspaceDefaults.defaultAspectColors[aspect.id] ?? DEFAULT_ASPECT_COLORS[aspect.id]
					}
				])
			)
		);
		setAspectLineTiers({ ...workspaceDefaults.aspectLineTierStyle });
		setGlyphSetValue(astrologyGlyphSet);
		setElementDraft(elementColors);
		onAppShellIconSetChange(readStoredAppShellIconSet());
	}, [astrologyGlyphSet, elementColors, onAppShellIconSetChange, workspaceDefaults]);

	const handleConfirm = useCallback(() => {
		onElementColorsCommit(elementDraft);
		setSettingsChanged(false);
	}, [elementDraft, onElementColorsCommit]);

	const persistLocationPatch = useCallback(
		async (patch?: Partial<WorkspaceDefaultsState>) => {
			const parsedLatitude = Number(latitude);
			const parsedLongitude = Number(longitude);
			await onWorkspaceDefaultsChange({
				locationName: defaultLocation.trim() || workspaceDefaults.locationName,
				locationLatitude: Number.isFinite(parsedLatitude)
					? parsedLatitude
					: workspaceDefaults.locationLatitude,
				locationLongitude: Number.isFinite(parsedLongitude)
					? parsedLongitude
					: workspaceDefaults.locationLongitude,
				timezone: timezone.trim() || workspaceDefaults.timezone,
				...patch
			});
		},
		[
			defaultLocation,
			latitude,
			longitude,
			onWorkspaceDefaultsChange,
			timezone,
			workspaceDefaults.locationLatitude,
			workspaceDefaults.locationLongitude,
			workspaceDefaults.locationName,
			workspaceDefaults.timezone
		]
	);

	const toggleObservableObject = useCallback(
		async (id: string) => {
			const next = selectedBodies.includes(id)
				? selectedBodies.filter((item) => item !== id)
				: [...selectedBodies, id];
			setSelectedBodies(next);
			markChanged();
			await onWorkspaceDefaultsChange({ defaultBodies: next });
		},
		[markChanged, onWorkspaceDefaultsChange, selectedBodies]
	);

	const commitAspectLineTiers = useCallback(
		(patch: Partial<AspectLineTierStyleState>) => {
			setAspectLineTiers((prev) => {
				const next = { ...prev, ...patch };
				void onWorkspaceDefaultsChange({ aspectLineTierStyle: next });
				return next;
			});
		},
		[onWorkspaceDefaultsChange]
	);

	const persistAspectSettings = useCallback(
		async (nextAspects: Record<string, { enabled: boolean; orb: number; color: string }>) => {
			const defaultAspects = ASPECT_ROWS.filter((aspect) => nextAspects[aspect.id]?.enabled).map(
				(aspect) => aspect.id
			);
			const defaultAspectOrbs = Object.fromEntries(
				ASPECT_ROWS.map((aspect) => [
					aspect.id,
					Number.isFinite(nextAspects[aspect.id]?.orb)
						? nextAspects[aspect.id]!.orb
						: DEFAULT_ASPECT_ORBS[aspect.id]
				])
			);
			const defaultAspectColors = Object.fromEntries(
				ASPECT_ROWS.map((aspect) => [
					aspect.id,
					nextAspects[aspect.id]?.color || DEFAULT_ASPECT_COLORS[aspect.id]
				])
			);
			await onWorkspaceDefaultsChange({
				defaultAspects,
				defaultAspectOrbs,
				defaultAspectColors
			});
		},
		[onWorkspaceDefaultsChange]
	);

	const glyphDescription = GLYPH_SET_OPTIONS.find((option) => option.id === glyphSetValue)?.description;
	const appShellDescription = APP_SHELL_ICON_SET_OPTIONS.find(
		(option) => option.id === appShellIconSet
	)?.description;

	return (
		<AppMainContentRoot className="min-h-full">
			<AppMainContentContainer layout="center-column">
				<div className="flex min-h-0 w-full min-w-0 flex-col space-y-6">
					<h1 className={cn('text-2xl font-semibold tracking-tight', ft.title)}>
						{t('app_settings')}
					</h1>

					<Card
						variant="ghost"
						className={cn(
							'flex min-h-[min(70vh,520px)] min-w-0 flex-col gap-0 rounded-xl p-0 shadow-none'
						)}
					>
						<CardContent className="min-h-0 flex-1 overflow-y-auto p-6 md:p-8">
							{section === 'jazyk' && (
								<div className="max-w-xl space-y-4">
									<div className="flex items-center gap-2">
										<Languages
											className={cn(
												'h-6 w-6 shrink-0',
												ft.isTwilight
													? 'text-white'
													: ft.isDark
														? 'text-blue-400'
														: ft.isSunrise
															? 'text-sky-600'
															: 'text-neutral-900'
											)}
											aria-hidden
										/>
										<h2 className={ft.sectionTitle}>{t('section_jazyk')}</h2>
									</div>
									<div className="space-y-2">
										<p className={ft.label}>{t('language')}</p>
										<p className={cn('text-sm', ft.muted)}>{t('select_language')}</p>
										<div className="mt-3 flex flex-wrap gap-3" role="group" aria-label={t('label_languages')}>
											{LANG_BUBBLES.map(({ code, label }) => {
												const active =
													i18n.language === code || i18n.language.startsWith(`${code}-`);
												return (
													<button
														key={code}
														type="button"
														onClick={() => {
															void i18n.changeLanguage(code);
															markChanged();
														}}
														className={ft.langBubble(active)}
													>
														{label}
													</button>
												);
											})}
										</div>
									</div>
								</div>
							)}

							{section === 'lokace' && (
								<div className="max-w-xl space-y-4">
									<h2 className={ft.sectionTitle}>{t('section_lokace')}</h2>
									<div className="space-y-2">
										<Label className={ft.label}>{t('default_location')}</Label>
										<LocationSelector
											value={defaultLocation}
											onValueChange={(next) => {
												setDefaultLocation(next);
												markChanged();
											}}
											searchLocations={searchLocations}
											onResolvedLocationSelect={(location) => {
												setDefaultLocation(location.display_name);
												setLatitude(String(location.latitude));
												setLongitude(String(location.longitude));
												markChanged();
												void persistLocationPatch({
													locationName: location.display_name,
													locationLatitude: location.latitude,
													locationLongitude: location.longitude
												});
											}}
											placeholder={t('placeholder_default_location')}
											searchPlaceholder={t('new_location_search')}
											emptyLabel={t('open_search_no_results')}
											loadingLabel={t('new_resolving_location')}
											className={cn(ft.selectTrigger, 'shadow-inner')}
											iconClassName={ft.muted}
										/>
										<p className={cn('text-xs', ft.muted)}>
											{t('settings_default_location_hint', {
												defaultValue:
													'Choose a searched location to sync its coordinates, or adjust latitude and longitude manually below.'
											})}
										</p>
									</div>
									<div className="grid gap-4 sm:grid-cols-2">
										<div className="space-y-2">
											<Label className={ft.label}>{t('current_info_latitude')}</Label>
											<Input
												value={latitude}
												onChange={(e) => {
													setLatitude(e.target.value);
													markChanged();
												}}
												onBlur={() => void persistLocationPatch()}
												placeholder={t('placeholder_latitude')}
												className={cn(ft.input, 'shadow-inner')}
											/>
										</div>
										<div className="space-y-2">
											<Label className={ft.label}>{t('current_info_longitude')}</Label>
											<Input
												value={longitude}
												onChange={(e) => {
													setLongitude(e.target.value);
													markChanged();
												}}
												onBlur={() => void persistLocationPatch()}
												placeholder={t('placeholder_longitude')}
												className={cn(ft.input, 'shadow-inner')}
											/>
										</div>
									</div>
									<div className="space-y-2">
										<Label className={ft.label}>{t('current_info_timezone')}</Label>
										<Input
											value={timezone}
											onChange={(e) => {
												setTimezone(e.target.value);
												markChanged();
											}}
											onBlur={() => void persistLocationPatch()}
											placeholder={t('placeholder_utc_offset')}
											className={cn(ft.input, 'shadow-inner')}
										/>
									</div>
								</div>
							)}

							{section === 'system_domu' && (
								<div className="max-w-md space-y-4">
									<h2 className={ft.sectionTitle}>{t('section_system_domu')}</h2>
									<div className="space-y-2">
										<Label className={ft.label}>{t('house_system')}</Label>
										<Select
											value={houseSystem}
											onValueChange={(value) => {
												setHouseSystem(value);
												markChanged();
												void onWorkspaceDefaultsChange({ houseSystem: value });
											}}
										>
											<SelectTrigger className={cn(ft.selectTrigger, 'shadow-inner')}>
												<SelectValue />
											</SelectTrigger>
											<SelectContent className={ft.selectContent}>
												<SelectGroup>
													{HOUSE_SYSTEMS.map((name) => (
														<SelectItem key={name} value={name} className={ft.selectItem}>
															{name}
														</SelectItem>
													))}
												</SelectGroup>
											</SelectContent>
										</Select>
										<p className={cn('text-xs', ft.muted)}>
											{t('settings_house_system_hint', {
												defaultValue:
													'Swiss-backed paths support the full list. The current Rust JPL path computes Whole Sign and Placidus directly.'
											})}
										</p>
									</div>
								</div>
							)}

							{section === 'pozorovane_objekty' && (
								<div className="max-w-3xl space-y-4">
									<h2 className={ft.sectionTitle}>
										{t('section_observable_objects', { defaultValue: 'Observable objects' })}
									</h2>
									<p className={cn('text-sm', ft.muted)}>
										{t('settings_observable_objects_hint', {
											defaultValue:
												'Select the celestial bodies and points that should be computed and shown across the app.'
										})}
									</p>
									<div className="grid gap-4 md:grid-cols-2">
										{observableCategories.map((category) => (
											<div key={category.id} className="rounded-xl border border-border/60 p-4">
												<h3 className={cn('mb-3 text-sm font-semibold', ft.label)}>{category.label}</h3>
												<div className="space-y-2">
													{category.items.map((item) => (
														<label key={item.id} className="flex items-center gap-3 text-sm">
															<Checkbox
																checked={selectedBodies.includes(item.id)}
																onCheckedChange={() => void toggleObservableObject(item.id)}
															/>
															<AstrologyGlyph
																glyphId={item.id}
																glyphSet={glyphSetValue}
																fallback={item.icon}
																size={18}
																className="text-foreground"
																title={item.label}
															/>
															<span>{item.label}</span>
														</label>
													))}
												</div>
											</div>
										))}
									</div>
								</div>
							)}

							{section === 'nastaveni_aspektu' && (
								<div className="max-w-2xl space-y-4">
									<h2 className={ft.sectionTitle}>{t('section_nastaveni_aspektu')}</h2>
									<div className="space-y-2">
										<p className={ft.label}>{t('default_aspects')}</p>
										<div className="space-y-3">
											{ASPECT_ROWS.map((aspect) => {
												const row = aspects[aspect.id] ?? {
													enabled: true,
													orb: aspect.defaultOrb,
													color: DEFAULT_ASPECT_COLORS[aspect.id]
												};
												return (
													<div
														key={aspect.id}
													className="grid items-center gap-3 rounded-xl border border-border/60 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_170px]"
													>
														<label className="flex cursor-pointer items-center gap-3">
															<Checkbox
																checked={row.enabled}
																onCheckedChange={(checked) => {
																	const next = {
																		...aspects,
																		[aspect.id]: {
																			...row,
																			enabled: checked === true
																		}
																	};
																	setAspects(next);
																	markChanged();
																	void persistAspectSettings(next);
																}}
															/>
															<span className={cn('text-sm', ft.title)}>{t(aspect.labelKey)}</span>
														</label>
														<div className="flex items-center gap-2">
															<input
																type="color"
																className="h-9 w-10 shrink-0 cursor-pointer rounded-md border border-border/60 bg-background p-0 shadow-inner"
																value={row.color}
																onChange={(e) => {
																	const next = {
																		...aspects,
																		[aspect.id]: {
																			...row,
																			color: e.target.value
																		}
																	};
																	setAspects(next);
																	markChanged();
																	void persistAspectSettings(next);
																}}
																aria-label={`${t(aspect.labelKey)} ${t('color_theme')}`}
															/>
															<span className={cn('text-xs uppercase tracking-wide', ft.muted)}>
																{t('label_orb')}
															</span>
															<Input
																type="number"
																className={cn(ft.inputCompact, 'h-9 w-20')}
																value={row.orb}
																min={0}
																max={30}
																step={0.5}
																onChange={(e) => {
																	const n = Number(e.target.value);
																	const next = {
																		...aspects,
																		[aspect.id]: {
																			...row,
																			orb: Number.isFinite(n) ? n : row.orb
																		}
																	};
																	setAspects(next);
																	markChanged();
																}}
																onBlur={() => void persistAspectSettings(aspects)}
															/>
														</div>
													</div>
												);
											})}
										</div>
									</div>
									<div className="space-y-3 rounded-xl border border-border/60 px-4 py-4">
										<p className={ft.label}>{t('settings_radix_aspect_lines_title')}</p>
										<p className={cn('text-xs', ft.muted)}>{t('settings_radix_aspect_lines_hint')}</p>
										<div className="grid gap-3 sm:grid-cols-2">
											<div className="space-y-1">
												<Label className="text-xs">{t('settings_aspect_line_tight_pct')}</Label>
												<Input
													type="number"
													className={cn(ft.inputCompact, 'h-9')}
													min={0}
													step={0.1}
													value={aspectLineTiers.tightThresholdPct}
													onChange={(e) => {
														const n = Number(e.target.value);
														setAspectLineTiers((p) => ({
															...p,
															tightThresholdPct: Number.isFinite(n) ? n : p.tightThresholdPct
														}));
														markChanged();
													}}
													onBlur={(e) => {
														const n = Number(e.target.value);
														if (!Number.isFinite(n) || n < 0) return;
														commitAspectLineTiers({ tightThresholdPct: n });
													}}
												/>
											</div>
											<div className="space-y-1">
												<Label className="text-xs">{t('settings_aspect_line_medium_pct')}</Label>
												<Input
													type="number"
													className={cn(ft.inputCompact, 'h-9')}
													min={0}
													step={0.1}
													value={aspectLineTiers.mediumThresholdPct}
													onChange={(e) => {
														const n = Number(e.target.value);
														setAspectLineTiers((p) => ({
															...p,
															mediumThresholdPct: Number.isFinite(n) ? n : p.mediumThresholdPct
														}));
														markChanged();
													}}
													onBlur={(e) => {
														const n = Number(e.target.value);
														if (!Number.isFinite(n) || n < 0) return;
														commitAspectLineTiers({ mediumThresholdPct: n });
													}}
												/>
											</div>
											<div className="space-y-1">
												<Label className="text-xs">{t('settings_aspect_line_loose_pct')}</Label>
												<Input
													type="number"
													className={cn(ft.inputCompact, 'h-9')}
													min={0}
													step={0.1}
													value={aspectLineTiers.looseThresholdPct}
													onChange={(e) => {
														const n = Number(e.target.value);
														setAspectLineTiers((p) => ({
															...p,
															looseThresholdPct: Number.isFinite(n) ? n : p.looseThresholdPct
														}));
														markChanged();
													}}
													onBlur={(e) => {
														const n = Number(e.target.value);
														if (!Number.isFinite(n) || n < 0) return;
														commitAspectLineTiers({ looseThresholdPct: n });
													}}
												/>
											</div>
											<div className="space-y-1">
												<Label className="text-xs">{t('settings_aspect_line_width_tight')}</Label>
												<Input
													type="number"
													className={cn(ft.inputCompact, 'h-9')}
													min={0.25}
													step={0.25}
													value={aspectLineTiers.widthTight}
													onChange={(e) => {
														const n = Number(e.target.value);
														setAspectLineTiers((p) => ({
															...p,
															widthTight: Number.isFinite(n) ? n : p.widthTight
														}));
														markChanged();
													}}
													onBlur={(e) => {
														const n = Number(e.target.value);
														if (!Number.isFinite(n) || n < 0.25) return;
														commitAspectLineTiers({ widthTight: n });
													}}
												/>
											</div>
											<div className="space-y-1">
												<Label className="text-xs">{t('settings_aspect_line_width_medium')}</Label>
												<Input
													type="number"
													className={cn(ft.inputCompact, 'h-9')}
													min={0.25}
													step={0.25}
													value={aspectLineTiers.widthMedium}
													onChange={(e) => {
														const n = Number(e.target.value);
														setAspectLineTiers((p) => ({
															...p,
															widthMedium: Number.isFinite(n) ? n : p.widthMedium
														}));
														markChanged();
													}}
													onBlur={(e) => {
														const n = Number(e.target.value);
														if (!Number.isFinite(n) || n < 0.25) return;
														commitAspectLineTiers({ widthMedium: n });
													}}
												/>
											</div>
											<div className="space-y-1">
												<Label className="text-xs">{t('settings_aspect_line_width_loose')}</Label>
												<Input
													type="number"
													className={cn(ft.inputCompact, 'h-9')}
													min={0.25}
													step={0.25}
													value={aspectLineTiers.widthLoose}
													onChange={(e) => {
														const n = Number(e.target.value);
														setAspectLineTiers((p) => ({
															...p,
															widthLoose: Number.isFinite(n) ? n : p.widthLoose
														}));
														markChanged();
													}}
													onBlur={(e) => {
														const n = Number(e.target.value);
														if (!Number.isFinite(n) || n < 0.25) return;
														commitAspectLineTiers({ widthLoose: n });
													}}
												/>
											</div>
											<div className="space-y-1">
												<Label className="text-xs">{t('settings_aspect_line_width_outer')}</Label>
												<Input
													type="number"
													className={cn(ft.inputCompact, 'h-9')}
													min={0.25}
													step={0.25}
													value={aspectLineTiers.widthOuter}
													onChange={(e) => {
														const n = Number(e.target.value);
														setAspectLineTiers((p) => ({
															...p,
															widthOuter: Number.isFinite(n) ? n : p.widthOuter
														}));
														markChanged();
													}}
													onBlur={(e) => {
														const n = Number(e.target.value);
														if (!Number.isFinite(n) || n < 0.25) return;
														commitAspectLineTiers({ widthOuter: n });
													}}
												/>
											</div>
										</div>
									</div>
								</div>
							)}

							{section === 'vzhled' && (
								<div className="flex flex-col gap-8 lg:max-w-2xl">
									<h2 className={ft.sectionTitle}>{t('section_vzhled')}</h2>
									<div className="space-y-2">
										<Label htmlFor="settings-preset" className={ft.label}>
											{t('label_color_preset')}
										</Label>
										<Select
											value={presetValue}
											onValueChange={(value) => {
												setPresetValue(value);
												markChanged();
											}}
										>
											<SelectTrigger
												id="settings-preset"
												className={cn(ft.selectTrigger, 'max-w-[280px] shadow-inner')}
											>
												<SelectValue placeholder={t('select_preset')} />
											</SelectTrigger>
											<SelectContent className={ft.selectContent}>
												<SelectGroup>
													<SelectLabel className={ft.muted}>{t('label_themes')}</SelectLabel>
													{PRESET_OPTIONS.map((preset) => (
														<SelectItem
															key={preset.value}
															value={preset.value}
															className={ft.selectItem}
														>
															{preset.label}
														</SelectItem>
													))}
												</SelectGroup>
											</SelectContent>
										</Select>
									</div>
									<div className="space-y-2">
										<Label htmlFor="settings-glyph-set" className={ft.label}>
											{t('select_glyph_set')}
										</Label>
										<Select value={glyphSetValue} onValueChange={onGlyphSetChange}>
											<SelectTrigger
												id="settings-glyph-set"
												className={cn(ft.selectTrigger, 'max-w-[280px] shadow-inner')}
											>
												<SelectValue />
											</SelectTrigger>
											<SelectContent className={ft.selectContent}>
												{GLYPH_SET_OPTIONS.map((option) => (
													<SelectItem key={option.id} value={option.id} className={ft.selectItem}>
														{option.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										{glyphDescription ? (
											<p className={cn('text-xs', ft.muted)}>{glyphDescription}</p>
										) : null}
									</div>
									<div className="space-y-2">
										<Label htmlFor="settings-app-shell-set" className={ft.label}>
											App shell icon set
										</Label>
										<Select value={appShellIconSet} onValueChange={onAppShellSetChange}>
											<SelectTrigger
												id="settings-app-shell-set"
												className={cn(ft.selectTrigger, 'max-w-[280px] shadow-inner')}
											>
												<SelectValue />
											</SelectTrigger>
											<SelectContent className={ft.selectContent}>
												{APP_SHELL_ICON_SET_OPTIONS.map((option) => (
													<SelectItem key={option.id} value={option.id} className={ft.selectItem}>
														{option.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										{appShellDescription ? (
											<p className={cn('text-xs', ft.muted)}>
												{appShellDescription}. Ink variant switches automatically by theme.
											</p>
										) : null}
									</div>
									<div className="space-y-4 border-t border-border/60 pt-6">
										<h3 className={cn('text-sm font-semibold', ft.title)}>
											{t('settings_element_wheel_title')}
										</h3>
										<p className={cn('text-xs leading-relaxed', ft.muted)}>
											{t('settings_element_wheel_blurb')}
										</p>
										{(['fire', 'earth', 'air', 'water'] as const satisfies readonly ElementId[]).map(
											(el) => (
												<div key={el} className="flex flex-wrap items-center gap-3">
													<Label className={cn(ft.label, 'min-w-[8rem] shrink-0')}>
														{t(`settings_element_${el}`)}
													</Label>
													<input
														type="color"
														className="h-9 w-14 shrink-0 cursor-pointer rounded-md border border-border/60 bg-background p-0 shadow-inner"
														value={elementDraft[el]}
														onChange={(e) => {
															const v = e.target.value;
															setElementDraft((d) => ({ ...d, [el]: v }));
															markChanged();
														}}
														aria-label={t(`settings_element_${el}`)}
													/>
													<span className={cn('font-mono text-xs', ft.muted)}>{elementDraft[el]}</span>
												</div>
											)
										)}
									</div>
								</div>
							)}

							{section === 'manual' && (
								<div className="max-w-2xl space-y-4">
									<h2 className={ft.sectionTitle}>{t('section_manual')}</h2>
									<p className={cn('text-sm leading-relaxed', ft.muted)}>{t('settings_guide')}</p>
								</div>
							)}
						</CardContent>

						<CardFooter className="shrink-0 flex-col gap-2 border-0 bg-transparent px-6 py-4 md:px-8 sm:flex-row">
							<button type="button" className={ft.footerCancel} onClick={handleCancel}>
								{t('cancel')}
							</button>
							<button
								type="button"
								className={ft.footerPrimary}
								onClick={handleConfirm}
								disabled={!settingsChanged}
							>
								{t('confirm')}
							</button>
						</CardFooter>
					</Card>
				</div>
			</AppMainContentContainer>
		</AppMainContentRoot>
	);
}

export type { SettingsSectionId } from './settings-secondary-sidebar';
export { SettingsView };
export default SettingsView;
