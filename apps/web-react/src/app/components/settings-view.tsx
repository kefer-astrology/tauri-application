import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppMainContentContainer, AppMainContentRoot } from './app-main-content';
import { useAppFormFieldTheme } from './form-field-theme';
import { LocationSelector } from './location-selector';
import type { SettingsSectionId } from './settings-secondary-sidebar';
import type { Theme } from './astrology-sidebar';
import { Card, CardContent, CardFooter } from './ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { ColorInput } from './ui/color-input';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Separator } from './ui/separator';
import { Switch } from './ui/switch';
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue
} from './ui/select';
import { cn } from './ui/utils';
import { SUPPORTED_LANGUAGES, type AppLanguage } from '@/lib/i18n';
import {
	APP_SHELL_ICON_SET_KEY,
	APP_SHELL_ICON_SET_OPTIONS,
	readStoredAppShellIconSet,
	type AppShellIconSetId
} from '@/lib/app-shell';
import {
	ASPECT_ROWS,
	DEFAULT_ASPECT_COLORS,
	DEFAULT_ASPECT_ORBS,
	type AspectRow
} from '@/lib/astrology/aspects';
import { type ElementColors, type ElementId } from '@/lib/astrology/elementColors';
import { persistGlyphSet, type AstrologyGlyphSetId } from '@/lib/astrology/glyphs';
import { DEGREE_SYMBOL_SET_CATALOG } from '@/lib/astrology/degreeSymbolSets';
import { persistEnabledSymbolSetIds } from '@/lib/astrology/symbolSystems';
import {
	persistWheelStyle,
	WHEEL_STYLE_OPTIONS,
	type WheelOrientationId,
	type WheelStyleId
} from '@/lib/astrology/wheelStyle';
import {
	DEFAULT_OBSERVABLE_OBJECT_IDS,
	OBSERVABLE_OBJECTS,
	getObservableObjectLabel
} from '@/lib/astrology/observableObjects';
import { DEFAULT_THEME_PALETTES, type ThemePalette } from '@/lib/themePalettes';
import { JAN_KEFER_BIOGRAPHY } from '@/lib/content/janKefer';
import { persistMonochrome } from '@/lib/appLayoutPreferences';
import {
	type AspectLineStyleId,
	type AspectLineTierStyleState,
	type WorkspaceDefaultsState
} from '@/lib/tauri/chartPayload';
import { catalogHouseSystems } from '@/lib/astrology/domainCatalog';
import { searchLocations } from '@/lib/tauri/workspace';
import type { AstrologicalTraditionId, ObjectTypeId } from '@/lib/tauri/types';
import { BodySelector } from './body-selector';
import { GlyphManager } from './glyph-manager';

const ASTROLOGY_TRADITION_OPTIONS: { id: AstrologicalTraditionId; labelKey: string }[] = [
	{ id: 'hellenistic', labelKey: 'tradition_hellenistic' },
	{ id: 'medieval_traditional', labelKey: 'tradition_medieval_traditional' },
	{ id: 'modern_western', labelKey: 'tradition_modern_western' },
	{ id: 'harmonic', labelKey: 'tradition_harmonic' },
	{ id: 'cosmobiology', labelKey: 'tradition_cosmobiology' },
	{ id: 'uranian_hamburg', labelKey: 'tradition_uranian_hamburg' },
	{ id: 'jyotish_parashari', labelKey: 'tradition_jyotish_parashari' }
];

/** One checkbox per eligibility-toggleable object category — every real `ObjectType` except
 *  `planet`, which is always implicitly eligible and has no checkbox of its own (see the
 *  always-shown per-planet orb section instead). `types` may list more than one Rust
 *  `ObjectType` when they share a single checkbox here (`calculated_point` and `part` are both
 *  "Sensitive Points" from a user's perspective — Lilith variants are `calculated_point` too,
 *  but the observed-objects catalog groups those into "Black Luna" instead; see
 *  `categoryForBody` in `observableObjects.ts`). */
const EXTENDED_OBJECT_TYPE_OPTIONS: { labelKey: string; types: ObjectTypeId[] }[] = [
	{ labelKey: 'observable_category_angles', types: ['angle'] },
	{ labelKey: 'transits_group_asteroids', types: ['asteroid'] },
	{ labelKey: 'transits_group_lunar_nodes', types: ['lunar_node'] },
	{ labelKey: 'observable_category_sensitive_points', types: ['calculated_point', 'part'] },
	{ labelKey: 'transits_group_geo_nodes', types: ['geocentric_node'] },
	{ labelKey: 'transits_group_tno', types: ['trans_neptunian'] },
	{ labelKey: 'transits_group_hypotheticals', types: ['hypothetical_planet'] }
];

type AspectRowState = {
	enabled: boolean;
	orb: number;
	color: string;
};

/** A sensible starting point for a newly-ticked extended category's objects: half the
 *  conjunction orb, floored at 0.5° — same heuristic the old per-aspect extended orb used,
 *  just no longer tied to one specific aspect since the orb is now global per object. */
function suggestedObjectOrb(): number {
	const baseOrb = DEFAULT_ASPECT_ORBS.conjunction ?? 8;
	return Math.max(0.5, Math.round((baseOrb / 2) * 2) / 2);
}

function aspectRowStateFromDefaults(
	aspect: AspectRow,
	workspaceDefaults: WorkspaceDefaultsState
): AspectRowState {
	const orb = workspaceDefaults.defaultAspectOrbs[aspect.id] ?? aspect.defaultOrb;
	return {
		enabled: workspaceDefaults.defaultAspects.includes(aspect.id),
		orb,
		color: workspaceDefaults.defaultAspectColors[aspect.id] ?? DEFAULT_ASPECT_COLORS[aspect.id]
	};
}

/** Each language's own autonym — always shown in that language, not translated, so a user can
 *  recognize their language regardless of which language the UI currently happens to be in. */
const LANGUAGE_OPTIONS: { code: AppLanguage; label: string }[] = [
	{ code: 'cs', label: 'Čeština' },
	{ code: 'en', label: 'English' },
	{ code: 'fr', label: 'Français' },
	{ code: 'es', label: 'Español' }
];

type ParsedThemeColor = {
	hex: string;
	alpha: number;
};

function parseThemeColor(value: string): ParsedThemeColor {
	const hex = value.trim().match(/^#([\da-f]{6})([\da-f]{2})?$/i);
	if (hex) {
		return {
			hex: `#${hex[1]}`,
			alpha: hex[2] ? Number.parseInt(hex[2], 16) / 255 : 1
		};
	}

	const rgb = value
		.trim()
		.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
	if (!rgb) return { hex: '#000000', alpha: 1 };

	const channels = rgb
		.slice(1, 4)
		.map((channel) => Math.min(255, Math.max(0, Math.round(Number(channel)))));
	return {
		hex: `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`,
		alpha: Math.min(1, Math.max(0, rgb[4] === undefined ? 1 : Number(rgb[4])))
	};
}

function formatThemeColor(hex: string, alpha: number): string {
	if (alpha >= 1) return hex;
	const normalized = hex.replace('#', '');
	const channels = [0, 2, 4].map((offset) =>
		Number.parseInt(normalized.slice(offset, offset + 2), 16)
	);
	return `rgba(${channels.join(',')},${Number(alpha.toFixed(2))})`;
}

/** Historical house-system names stay untranslated across languages; only real words get a key. */
const HOUSE_SYSTEM_LABEL_KEYS: Record<string, string> = {
	'Whole Sign': 'house_system_whole_sign',
	Equal: 'house_system_equal'
};

function houseSystemLabel(
	name: string,
	t: (key: string, options?: Record<string, unknown>) => string
): string {
	const key = HOUSE_SYSTEM_LABEL_KEYS[name];
	return key ? t(key, { defaultValue: name }) : name;
}

const THEME_OPTIONS: { id: Theme; labelKey: string }[] = [
	{ id: 'sunrise', labelKey: 'sidebar_theme_sunrise' },
	{ id: 'noon', labelKey: 'sidebar_theme_noon' },
	{ id: 'twilight', labelKey: 'sidebar_theme_twilight' },
	{ id: 'midnight', labelKey: 'sidebar_theme_midnight' }
];

const ASPECT_LINE_OUTER_STYLE_OPTIONS: { id: AspectLineStyleId; label: string }[] = [
	{ id: 'solid', label: 'Solid' },
	{ id: 'dashed', label: 'Dashed' },
	{ id: 'dotted', label: 'Dotted' }
];

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
	enabledSymbolSetIds: readonly string[];
	onEnabledSymbolSetIdsChange: (value: string[]) => void;
	wheelStyle: WheelStyleId;
	onWheelStyleChange: (value: WheelStyleId) => void;
	wheelOrientation: WheelOrientationId;
	onWheelOrientationChange: (value: WheelOrientationId) => void;
	onThemeChange: (value: Theme) => void;
	elementColors: ElementColors;
	onElementColorsCommit: (value: ElementColors) => void;
	themePalette: ThemePalette;
	onThemePaletteCommit: (value: ThemePalette) => void;
	workspaceDefaults: WorkspaceDefaultsState;
	onWorkspaceDefaultsChange: (patch: Partial<WorkspaceDefaultsState>) => Promise<void> | void;
	monochrome: boolean;
	onMonochromeChange: (value: boolean) => void;
}

function SettingsView({
	theme,
	section,
	appShellIconSet,
	onAppShellIconSetChange,
	astrologyGlyphSet,
	onAstrologyGlyphSetChange,
	enabledSymbolSetIds,
	onEnabledSymbolSetIdsChange,
	wheelStyle,
	onWheelStyleChange,
	wheelOrientation,
	onWheelOrientationChange,
	onThemeChange,
	elementColors,
	onElementColorsCommit,
	themePalette,
	onThemePaletteCommit,
	workspaceDefaults,
	onWorkspaceDefaultsChange,
	monochrome,
	onMonochromeChange
}: SettingsViewProps) {
	const { t, i18n } = useTranslation();
	const ft = useAppFormFieldTheme(theme);
	const [settingsChanged, setSettingsChanged] = useState(false);
	const [defaultLocation, setDefaultLocation] = useState(workspaceDefaults.locationName);
	const [latitude, setLatitude] = useState(String(workspaceDefaults.locationLatitude));
	const [longitude, setLongitude] = useState(String(workspaceDefaults.locationLongitude));
	const [timezone, setTimezone] = useState(workspaceDefaults.timezone);
	const [houseSystem, setHouseSystem] = useState<string>(workspaceDefaults.houseSystem);
	const [astrologyTradition, setAstrologyTradition] = useState<AstrologicalTraditionId | ''>(
		workspaceDefaults.astrologyTradition ?? ''
	);
	const [glyphSetValue, setGlyphSetValue] = useState<AstrologyGlyphSetId>(astrologyGlyphSet);
	const [enabledSymbolSetIdsValue, setEnabledSymbolSetIdsValue] = useState<string[]>(() => [
		...enabledSymbolSetIds
	]);
	const [wheelStyleValue, setWheelStyleValue] = useState<WheelStyleId>(wheelStyle);
	const [wheelOrientationValue, setWheelOrientationValue] =
		useState<WheelOrientationId>(wheelOrientation);
	const [elementDraft, setElementDraft] = useState<ElementColors>(elementColors);
	const [themePaletteDraft, setThemePaletteDraft] = useState<ThemePalette>(themePalette);
	const [selectedBodies, setSelectedBodies] = useState<string[]>(
		workspaceDefaults.defaultBodies.length > 0
			? workspaceDefaults.defaultBodies
			: DEFAULT_OBSERVABLE_OBJECT_IDS
	);
	const [bodyColors, setBodyColors] = useState<Record<string, string>>(workspaceDefaults.bodyColors);
	const [extendedObjectTypes, setExtendedObjectTypes] = useState<ObjectTypeId[]>(
		workspaceDefaults.extendedObjectTypes
	);
	const [objectOrbs, setObjectOrbs] = useState<Record<string, number>>(workspaceDefaults.objectOrbs);
	const [aspects, setAspects] = useState<Record<string, AspectRowState>>(() =>
		Object.fromEntries(
			ASPECT_ROWS.map((aspect) => [aspect.id, aspectRowStateFromDefaults(aspect, workspaceDefaults)])
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
		setAstrologyTradition(workspaceDefaults.astrologyTradition ?? '');
		setSelectedBodies(
			workspaceDefaults.defaultBodies.length > 0
				? workspaceDefaults.defaultBodies
				: DEFAULT_OBSERVABLE_OBJECT_IDS
		);
		setBodyColors(workspaceDefaults.bodyColors);
		setExtendedObjectTypes(workspaceDefaults.extendedObjectTypes);
		setObjectOrbs(workspaceDefaults.objectOrbs);
		setAspects(
			Object.fromEntries(
				ASPECT_ROWS.map((aspect) => [
					aspect.id,
					{
						enabled: workspaceDefaults.defaultAspects.includes(aspect.id),
						orb: workspaceDefaults.defaultAspectOrbs[aspect.id] ?? aspect.defaultOrb,
						color:
							workspaceDefaults.defaultAspectColors[aspect.id] ?? DEFAULT_ASPECT_COLORS[aspect.id]
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
		setEnabledSymbolSetIdsValue([...enabledSymbolSetIds]);
	}, [enabledSymbolSetIds]);

	useEffect(() => {
		setWheelStyleValue(wheelStyle);
	}, [wheelStyle]);

	useEffect(() => {
		setWheelOrientationValue(wheelOrientation);
	}, [wheelOrientation]);
	useEffect(() => {
		setElementDraft(elementColors);
	}, [elementColors]);

	useEffect(() => {
		setThemePaletteDraft(themePalette);
	}, [themePalette]);

	const markChanged = useCallback(() => setSettingsChanged(true), []);

	const applyObservableObjectSelection = useCallback(
		(next: string[]) => {
			setSelectedBodies(next);
			markChanged();
			void onWorkspaceDefaultsChange({ defaultBodies: next });
		},
		[markChanged, onWorkspaceDefaultsChange]
	);

	const applyBodyColorChange = useCallback(
		(id: string, color: string) => {
			const next = { ...bodyColors, [id]: color };
			setBodyColors(next);
			markChanged();
			void onWorkspaceDefaultsChange({ bodyColors: next });
		},
		[bodyColors, markChanged, onWorkspaceDefaultsChange]
	);

	// Global (not per-aspect) — ticking/unticking a category here changes eligibility for
	// every aspect at once. See `src-tauri/src/workspace/models.rs`'s
	// `WorkspaceDefaults::extended_object_types`/`object_orbs`. `types` may list more than
	// one Rust `ObjectType` (e.g. "Sensitive Points" covers both `calculated_point` and `part`)
	// when they share a single checkbox in the UI — see `EXTENDED_OBJECT_TYPE_OPTIONS`.
	const applyExtendedTypeToggle = useCallback(
		(types: ObjectTypeId[], checked: boolean) => {
			const nextTypes = checked
				? Array.from(new Set([...extendedObjectTypes, ...types]))
				: extendedObjectTypes.filter((existing) => !types.includes(existing));
			setExtendedObjectTypes(nextTypes);

			// Pre-fill a starting orb for this category's objects that don't have one yet,
			// so newly-enabling a category doesn't silently mean "no narrowing at all".
			let nextOrbs = objectOrbs;
			if (checked) {
				const additions = OBSERVABLE_OBJECTS.filter(
					(item) =>
						item.objectType !== null &&
						types.includes(item.objectType) &&
						objectOrbs[item.id] === undefined
				);
				if (additions.length > 0) {
					nextOrbs = { ...objectOrbs };
					for (const item of additions) nextOrbs[item.id] = suggestedObjectOrb();
					setObjectOrbs(nextOrbs);
				}
			}

			markChanged();
			void onWorkspaceDefaultsChange({ extendedObjectTypes: nextTypes, objectOrbs: nextOrbs });
		},
		[extendedObjectTypes, objectOrbs, markChanged, onWorkspaceDefaultsChange]
	);

	const applyObjectOrbChange = useCallback(
		(id: string, orb: number) => {
			const next = { ...objectOrbs, [id]: orb };
			setObjectOrbs(next);
			markChanged();
			void onWorkspaceDefaultsChange({ objectOrbs: next });
		},
		[objectOrbs, markChanged, onWorkspaceDefaultsChange]
	);

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

	const onToggleSymbolSet = useCallback(
		(id: string) => {
			setEnabledSymbolSetIdsValue((current) => {
				const next = current.includes(id)
					? current.filter((value) => value !== id)
					: [...current, id];
				onEnabledSymbolSetIdsChange(next);
				persistEnabledSymbolSetIds(next);
				return next;
			});
			markChanged();
		},
		[markChanged, onEnabledSymbolSetIdsChange]
	);

	const onWheelStyleChangeHandler = useCallback(
		(value: string) => {
			const next = value === 'minimalist' ? 'minimalist' : 'technical';
			setWheelStyleValue(next);
			onWheelStyleChange(next);
			persistWheelStyle(next);
			markChanged();
		},
		[markChanged, onWheelStyleChange]
	);

	const onWheelOrientationChangeHandler = useCallback(
		(value: string) => {
			const next: WheelOrientationId = value === 'aries' ? 'aries' : 'ascendant';
			setWheelOrientationValue(next);
			onWheelOrientationChange(next);
			markChanged();
		},
		[markChanged, onWheelOrientationChange]
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
		setAstrologyTradition(workspaceDefaults.astrologyTradition ?? '');
		setSelectedBodies(
			workspaceDefaults.defaultBodies.length > 0
				? workspaceDefaults.defaultBodies
				: DEFAULT_OBSERVABLE_OBJECT_IDS
		);
		setBodyColors(workspaceDefaults.bodyColors);
		setExtendedObjectTypes(workspaceDefaults.extendedObjectTypes);
		setObjectOrbs(workspaceDefaults.objectOrbs);
		setAspects(
			Object.fromEntries(
				ASPECT_ROWS.map((aspect) => [
					aspect.id,
					{
						enabled: workspaceDefaults.defaultAspects.includes(aspect.id),
						orb: workspaceDefaults.defaultAspectOrbs[aspect.id] ?? aspect.defaultOrb,
						color:
							workspaceDefaults.defaultAspectColors[aspect.id] ?? DEFAULT_ASPECT_COLORS[aspect.id]
					}
				])
			)
		);
		setAspectLineTiers({ ...workspaceDefaults.aspectLineTierStyle });
		setGlyphSetValue(astrologyGlyphSet);
		setWheelStyleValue(wheelStyle);
		setWheelOrientationValue(wheelOrientation);
		setElementDraft(elementColors);
		setThemePaletteDraft(themePalette);
		onAppShellIconSetChange(readStoredAppShellIconSet());
	}, [
		astrologyGlyphSet,
		elementColors,
		onAppShellIconSetChange,
		themePalette,
		wheelStyle,
		wheelOrientation,
		workspaceDefaults
	]);

	const handleConfirm = useCallback(() => {
		onElementColorsCommit(elementDraft);
		onThemePaletteCommit(themePaletteDraft);
		setSettingsChanged(false);
	}, [elementDraft, onElementColorsCommit, onThemePaletteCommit, themePaletteDraft]);

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
		async (nextAspects: Record<string, AspectRowState>) => {
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

	const glyphDescription = GLYPH_SET_OPTIONS.find(
		(option) => option.id === glyphSetValue
	)?.description;
	const appShellDescription = APP_SHELL_ICON_SET_OPTIONS.find(
		(option) => option.id === appShellIconSet
	)?.description;
	const wheelStyleDescription = WHEEL_STYLE_OPTIONS.find(
		(option) => option.id === wheelStyleValue
	)?.description;

	const currentLanguageCode = i18n.language.split('-')[0];
	const janKeferBiography =
		JAN_KEFER_BIOGRAPHY[
			(SUPPORTED_LANGUAGES as readonly string[]).includes(currentLanguageCode)
				? (currentLanguageCode as AppLanguage)
				: 'en'
		];

	return (
		<AppMainContentRoot className="min-h-full">
			<AppMainContentContainer width="wide">
				<div className="flex min-h-0 w-full min-w-0 flex-col space-y-6">
					<Card
						variant="ghost"
						className={cn(
							'flex min-h-[min(70vh,520px)] min-w-0 flex-col gap-0 rounded-xl p-0 shadow-none'
						)}
					>
						<CardContent className="min-h-0 flex-1 overflow-y-auto p-6 md:p-8">
							{section === 'jazyk_lokace' && (
								<div className="space-y-6">
									<div className="space-y-2">
										<Label className={ft.label}>{t('language')}</Label>
										<p className={cn('text-sm', ft.muted)}>{t('select_language')}</p>
										<Select
											value={
												LANGUAGE_OPTIONS.find(
													(option) =>
														i18n.language === option.code ||
														i18n.language.startsWith(`${option.code}-`)
												)?.code ?? i18n.language
											}
											onValueChange={(value) => {
												void i18n.changeLanguage(value);
												markChanged();
											}}
										>
											<SelectTrigger
												aria-label={t('label_languages')}
												className={cn(ft.selectTrigger, 'max-w-[280px] shadow-inner')}
											>
												<SelectValue />
											</SelectTrigger>
											<SelectContent className={ft.selectContent}>
												<SelectGroup>
													{LANGUAGE_OPTIONS.map((option) => (
														<SelectItem
															key={option.code}
															value={option.code}
															className={ft.selectItem}
														>
															{option.label}
														</SelectItem>
													))}
												</SelectGroup>
											</SelectContent>
										</Select>
									</div>

									<Separator className="bg-[color:var(--theme-panel-border)]" />

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
								<div className="space-y-4">
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
														{catalogHouseSystems().map((name) => (
														<SelectItem key={name} value={name} className={ft.selectItem}>
															{houseSystemLabel(name, t)}
														</SelectItem>
													))}
												</SelectGroup>
											</SelectContent>
										</Select>
										<p className={cn('text-xs', ft.muted)}>
											{t('settings_house_system_hint', {
												defaultValue: 'Shown options are computed by the current Rust JPL backend.'
											})}
										</p>
									</div>
									<div className="space-y-2">
										<Label className={ft.label}>{t('settings_position_mode')}</Label>
										<Select
											value={workspaceDefaults.positionMode}
											onValueChange={(value) => {
												const positionMode = value === 'geometric' ? 'geometric' : 'apparent';
												markChanged();
												void onWorkspaceDefaultsChange({ positionMode });
											}}
										>
											<SelectTrigger className={cn(ft.selectTrigger, 'shadow-inner')}>
												<SelectValue />
											</SelectTrigger>
											<SelectContent className={ft.selectContent}>
												<SelectItem value="apparent" className={ft.selectItem}>
													{t('settings_position_mode_apparent')}
												</SelectItem>
												<SelectItem value="geometric" className={ft.selectItem}>
													{t('settings_position_mode_geometric')}
												</SelectItem>
											</SelectContent>
										</Select>
										<p className={cn('text-xs', ft.muted)}>{t('settings_position_mode_hint')}</p>
									</div>
								</div>
							)}

							{section === 'pozorovane_objekty' && (
								<BodySelector
									theme={theme}
									glyphSet={glyphSetValue}
									subtitleKey="settings_observable_objects_hint"
									selectedBodyIds={selectedBodies}
									onSelectedBodyIdsChange={applyObservableObjectSelection}
									colors={bodyColors}
									onColorChange={applyBodyColorChange}
								/>
							)}

							{section === 'nastaveni_aspektu' && (
								<div className="space-y-4">
									<div className="space-y-2 rounded-xl bg-[color:var(--theme-soft-bg)]/45 px-4 py-4">
										<Label className={ft.label}>{t('settings_astrology_tradition_label')}</Label>
										<Select
											value={astrologyTradition}
											onValueChange={(value) => {
												const next = value as AstrologicalTraditionId;
												setAstrologyTradition(next);
												markChanged();
												void onWorkspaceDefaultsChange({ astrologyTradition: next });
											}}
										>
											<SelectTrigger className={cn(ft.selectTrigger, 'shadow-inner')}>
												<SelectValue placeholder={t('settings_astrology_tradition_none')} />
											</SelectTrigger>
											<SelectContent className={ft.selectContent}>
												<SelectGroup>
													{ASTROLOGY_TRADITION_OPTIONS.map((option) => (
														<SelectItem key={option.id} value={option.id} className={ft.selectItem}>
															{t(option.labelKey)}
														</SelectItem>
													))}
												</SelectGroup>
											</SelectContent>
										</Select>
										<p className={cn('text-xs', ft.muted)}>
											{t('settings_astrology_tradition_hint')}
										</p>
									</div>
									<div className="space-y-2 rounded-xl bg-[color:var(--theme-soft-bg)]/45 px-4 py-4">
										<p className={ft.label}>{t('settings_aspect_scope_extended_categories')}</p>
										<p className={cn('text-xs', ft.muted)}>
											{t('settings_aspect_scope_extended_shared_hint')}
										</p>
										<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
											{EXTENDED_OBJECT_TYPE_OPTIONS.map((option) => (
												<label
													key={option.labelKey}
													className="flex cursor-pointer items-center gap-2 text-sm"
												>
													<Checkbox
														checked={option.types.some((type) =>
															extendedObjectTypes.includes(type)
														)}
														onCheckedChange={(checked) =>
															applyExtendedTypeToggle(option.types, checked === true)
														}
													/>
													{t(option.labelKey)}
												</label>
											))}
										</div>
									</div>
									<div className="space-y-2">
										<p className={ft.label}>{t('default_aspects')}</p>
										<Accordion type="multiple" className="space-y-3">
											{ASPECT_ROWS.map((aspect) => {
												const row = aspects[aspect.id] ?? {
													enabled: true,
													orb: aspect.defaultOrb,
													color: DEFAULT_ASPECT_COLORS[aspect.id]
												};
												const updateRow = (
													patch: Partial<AspectRowState>,
													options?: { persist?: boolean }
												) => {
													const next = { ...aspects, [aspect.id]: { ...row, ...patch } };
													setAspects(next);
													markChanged();
													if (options?.persist !== false) void persistAspectSettings(next);
												};
												return (
													<AccordionItem
														key={aspect.id}
														value={aspect.id}
														className="rounded-xl border-0 bg-[color:var(--theme-soft-bg)]/45 px-4"
													>
														<div className="flex items-center gap-3 py-3">
															<Label className="flex flex-1 cursor-pointer items-center gap-3">
																<Checkbox
																	checked={row.enabled}
																	onCheckedChange={(checked) =>
																		updateRow({ enabled: checked === true })
																	}
																/>
																<span className={cn('text-sm', ft.title)}>{t(aspect.labelKey)}</span>
															</Label>
															<ColorInput
																value={row.color}
																onChange={(e) => updateRow({ color: e.target.value })}
																aria-label={`${t(aspect.labelKey)} ${t('color_theme')}`}
															/>
															<AccordionTrigger className="w-auto flex-none gap-2 py-0 text-xs hover:no-underline">
																<span className={cn('tracking-wide uppercase tabular-nums', ft.muted)}>
																	{row.orb}° {t('label_orb')}
																</span>
															</AccordionTrigger>
														</div>
														<AccordionContent className="pt-0 pb-4">
															<div className="space-y-3 rounded-lg bg-black/10 p-3 dark:bg-white/5">
																<div className="grid grid-cols-[1fr_auto] items-center gap-3">
																	<Label
																		className={cn('text-xs', ft.muted)}
																		htmlFor={`${aspect.id}-orb`}
																	>
																		{t('label_orb')}
																	</Label>
																	<Input
																		id={`${aspect.id}-orb`}
																		type="number"
																		className={cn(ft.inputCompact, 'h-9 w-20')}
																		value={row.orb}
																		min={0}
																		max={30}
																		step={0.5}
																		onChange={(e) => {
																			const n = Number(e.target.value);
																			updateRow(
																				{ orb: Number.isFinite(n) ? n : row.orb },
																				{ persist: false }
																			);
																		}}
																		onBlur={() => void persistAspectSettings(aspects)}
																	/>
																</div>
																{/* Planets are always eligible (no checkbox needed) but each still gets its
																	own orb, same global mechanism as the opt-in categories below. */}
																<div className="space-y-1.5 border-t border-[color:var(--theme-panel-border)]/60 pt-3">
																	<p className={cn('text-[0.65rem] tracking-wide uppercase', ft.muted)}>
																		{t('settings_aspect_scope_planets')}
																	</p>
																	<div className="grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-3">
																		{OBSERVABLE_OBJECTS.filter(
																			(item) => item.objectType === 'planet' && item.status === 'available'
																		).map((item) => (
																			<div key={item.id} className="flex items-center justify-between gap-2">
																				<span className={cn('truncate text-xs', ft.muted)}>
																					{getObservableObjectLabel(item, t)}
																				</span>
																				<Input
																					type="number"
																					className={cn(ft.inputCompact, 'h-8 w-16')}
																					value={objectOrbs[item.id] ?? row.orb}
																					min={0}
																					step={0.5}
																					onChange={(e) => {
																						const n = Number(e.target.value);
																						if (Number.isFinite(n)) applyObjectOrbChange(item.id, n);
																					}}
																				/>
																			</div>
																		))}
																	</div>
																</div>
																{extendedObjectTypes.length > 0 && (
																	<div className="space-y-3 border-t border-[color:var(--theme-panel-border)]/60 pt-3">
																		{EXTENDED_OBJECT_TYPE_OPTIONS.filter((option) =>
																			option.types.some((type) => extendedObjectTypes.includes(type))
																		).map((option) => {
																			const items = OBSERVABLE_OBJECTS.filter(
																				(item) =>
																					item.objectType !== null &&
																					option.types.includes(item.objectType) &&
																					item.status === 'available'
																			);
																			if (items.length === 0) return null;
																			return (
																				<div key={option.labelKey} className="space-y-1.5">
																					<p
																						className={cn(
																							'text-[0.65rem] tracking-wide uppercase',
																							ft.muted
																						)}
																					>
																						{t(option.labelKey)}
																					</p>
																					<div className="grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-3">
																						{items.map((item) => (
																							<div
																								key={item.id}
																								className="flex items-center justify-between gap-2"
																							>
																								<span className={cn('truncate text-xs', ft.muted)}>
																									{getObservableObjectLabel(item, t)}
																								</span>
																								<Input
																									type="number"
																									className={cn(ft.inputCompact, 'h-8 w-16')}
																									value={objectOrbs[item.id] ?? suggestedObjectOrb()}
																									min={0}
																									step={0.5}
																									onChange={(e) => {
																										const n = Number(e.target.value);
																										if (Number.isFinite(n)) {
																											applyObjectOrbChange(item.id, n);
																										}
																									}}
																								/>
																							</div>
																						))}
																					</div>
																				</div>
																			);
																		})}
																	</div>
																)}
															</div>
														</AccordionContent>
													</AccordionItem>
												);
											})}
										</Accordion>
									</div>
									<Separator className="bg-[color:var(--theme-panel-border)]" />
									<div className="space-y-3 rounded-xl bg-[color:var(--theme-soft-bg)]/45 px-4 py-4">
										<p className={ft.label}>{t('settings_radix_aspect_lines_title')}</p>
										<p className={cn('text-xs', ft.muted)}>
											{t('settings_radix_aspect_lines_hint')}
										</p>
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
											<div className="space-y-1">
												<Label className="text-xs">{t('settings_aspect_line_outer_style')}</Label>
												<Select
													value={aspectLineTiers.outerLineStyle}
													onValueChange={(value) => {
														const next: AspectLineStyleId =
															value === 'solid' || value === 'dashed' ? value : 'dotted';
														setAspectLineTiers((p) => ({ ...p, outerLineStyle: next }));
														markChanged();
														commitAspectLineTiers({ outerLineStyle: next });
													}}
												>
													<SelectTrigger className={cn(ft.selectTrigger, 'h-9')}>
														<SelectValue />
													</SelectTrigger>
													<SelectContent className={ft.selectContent}>
														{ASPECT_LINE_OUTER_STYLE_OPTIONS.map((option) => (
															<SelectItem
																key={option.id}
																value={option.id}
																className={ft.selectItem}
															>
																{option.label}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											</div>
										</div>
									</div>
								</div>
							)}

							{section === 'rozlozeni_symbolu' && (
								<Accordion type="multiple" className="w-full">
									<AccordionItem value="glyph-set">
										<AccordionTrigger className={ft.title}>
											{t('settings_symbol_selector')}
										</AccordionTrigger>
										<AccordionContent className="space-y-5">
											<div className="space-y-2">
												<Label className={ft.label}>{t('select_glyph_set')}</Label>
												<Select value={glyphSetValue} onValueChange={onGlyphSetChange}>
													<SelectTrigger
														className={cn(ft.selectTrigger, 'max-w-[280px] shadow-inner')}
													>
														<SelectValue />
													</SelectTrigger>
													<SelectContent className={ft.selectContent}>
														{GLYPH_SET_OPTIONS.map((option) => (
															<SelectItem
																key={option.id}
																value={option.id}
																className={ft.selectItem}
															>
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
												<Label className={ft.label}>{t('settings_app_shell_icons')}</Label>
												<Select value={appShellIconSet} onValueChange={onAppShellSetChange}>
													<SelectTrigger
														className={cn(ft.selectTrigger, 'max-w-[280px] shadow-inner')}
													>
														<SelectValue />
													</SelectTrigger>
													<SelectContent className={ft.selectContent}>
														{APP_SHELL_ICON_SET_OPTIONS.map((option) => (
															<SelectItem
																key={option.id}
																value={option.id}
																className={ft.selectItem}
															>
																{option.label}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
												{appShellDescription ? (
													<p className={cn('text-xs', ft.muted)}>{appShellDescription}</p>
												) : null}
											</div>
										</AccordionContent>
									</AccordionItem>
									<AccordionItem value="degree-symbol-sets">
										<AccordionTrigger className={ft.title}>
											{t('settings_degree_symbol_sets')}
										</AccordionTrigger>
										<AccordionContent className="space-y-3">
											<p className={cn('text-xs leading-relaxed', ft.muted)}>
												{t('settings_degree_symbol_sets_blurb')}
											</p>
											{DEGREE_SYMBOL_SET_CATALOG.map((entry) => (
												<div key={entry.id} className="flex items-center gap-2">
													<Checkbox
														id={`symbol-set-${entry.id}`}
														checked={enabledSymbolSetIdsValue.includes(entry.id)}
														disabled={!entry.available}
														onCheckedChange={() => onToggleSymbolSet(entry.id)}
													/>
													<Label
														htmlFor={`symbol-set-${entry.id}`}
														className={cn(
															'text-sm',
															entry.available ? cn('cursor-pointer', ft.bodyText) : ft.muted
														)}
													>
														{t(entry.labelKey)}
													</Label>
													{!entry.available ? (
														<span className={cn('text-xs italic', ft.muted)}>
															{t('settings_degree_symbol_set_unavailable')}
														</span>
													) : null}
												</div>
											))}
										</AccordionContent>
									</AccordionItem>
									<AccordionItem value="radix-style">
										<AccordionTrigger className={ft.title}>
											{t('settings_radix_style')}
										</AccordionTrigger>
										<AccordionContent className="space-y-5">
											<div className="space-y-2">
												<Select value={wheelStyleValue} onValueChange={onWheelStyleChangeHandler}>
													<SelectTrigger
														className={cn(ft.selectTrigger, 'max-w-[280px] shadow-inner')}
													>
														<SelectValue />
													</SelectTrigger>
													<SelectContent className={ft.selectContent}>
														{WHEEL_STYLE_OPTIONS.map((option) => (
															<SelectItem
																key={option.id}
																value={option.id}
																className={ft.selectItem}
															>
																{option.label}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
												{wheelStyleDescription ? (
													<p className={cn('text-xs', ft.muted)}>{wheelStyleDescription}</p>
												) : null}
											</div>
											<div className="space-y-2">
												<Label className={ft.label}>{t('settings_wheel_orientation')}</Label>
												<Select
													value={wheelOrientationValue}
													onValueChange={onWheelOrientationChangeHandler}
												>
													<SelectTrigger
														className={cn(ft.selectTrigger, 'max-w-[280px] shadow-inner')}
													>
														<SelectValue />
													</SelectTrigger>
													<SelectContent className={ft.selectContent}>
														<SelectItem value="ascendant" className={ft.selectItem}>
															{t('settings_wheel_orientation_ascendant')}
														</SelectItem>
														<SelectItem value="aries" className={ft.selectItem}>
															{t('settings_wheel_orientation_aries')}
														</SelectItem>
													</SelectContent>
												</Select>
											</div>
										</AccordionContent>
									</AccordionItem>
									<AccordionItem value="element-colors">
										<AccordionTrigger className={ft.title}>
											{t('settings_element_colors')}
										</AccordionTrigger>
										<AccordionContent className="space-y-4">
											<p className={cn('text-xs leading-relaxed', ft.muted)}>
												{t('settings_element_wheel_blurb')}
											</p>
											{(
												['fire', 'earth', 'air', 'water'] as const satisfies readonly ElementId[]
											).map((el) => (
												<div key={el} className="flex flex-wrap items-center gap-3">
													<Label className={cn(ft.label, 'min-w-[8rem] shrink-0')}>
														{t(`settings_element_${el}`)}
													</Label>
													<ColorInput
														className="w-14"
														value={elementDraft[el]}
														onChange={(event) => {
															setElementDraft((draft) => ({ ...draft, [el]: event.target.value }));
															markChanged();
														}}
														aria-label={t(`settings_element_${el}`)}
													/>
													<span className={cn('font-mono text-xs', ft.muted)}>
														{elementDraft[el]}
													</span>
												</div>
											))}
										</AccordionContent>
									</AccordionItem>
									<AccordionItem value="glyph-manager">
										<AccordionTrigger className={ft.title}>
											{t('glyph_manager_title')}
										</AccordionTrigger>
										<AccordionContent>
											<GlyphManager glyphSet={glyphSetValue} />
										</AccordionContent>
									</AccordionItem>
								</Accordion>
							)}

							{section === 'rozlozeni_aplikace' && (
								<Accordion type="multiple" className="w-full">
									<AccordionItem value="theme">
										<AccordionTrigger className={ft.title}>
											{t('settings_theme_selector')}
										</AccordionTrigger>
										<AccordionContent>
											<Select
												value={theme}
												onValueChange={(value) => {
													onThemeChange(value as Theme);
													markChanged();
												}}
											>
												<SelectTrigger
													className={cn(ft.selectTrigger, 'max-w-[280px] shadow-inner')}
												>
													<SelectValue />
												</SelectTrigger>
												<SelectContent className={ft.selectContent}>
													{THEME_OPTIONS.map((option) => (
														<SelectItem key={option.id} value={option.id} className={ft.selectItem}>
															{t(option.labelKey)}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</AccordionContent>
									</AccordionItem>
									<AccordionItem value="palette">
										<AccordionTrigger className={ft.title}>
											{t('settings_theme_palette_title')}
										</AccordionTrigger>
										<AccordionContent className="space-y-4">
											<p className={cn('text-xs leading-relaxed', ft.muted)}>
												{t('settings_theme_palette_blurb', { theme: t(`sidebar_theme_${theme}`) })}
											</p>
											<div className="space-y-2 rounded-xl border border-[color:var(--theme-panel-border)] bg-[color:var(--theme-soft-bg)] p-4">
												<div className="flex items-center justify-between gap-4">
													<Label htmlFor="settings-popup-fuzziness" className={ft.label}>
														{t('settings_popup_fuzziness')}
													</Label>
													<output
														htmlFor="settings-popup-fuzziness"
														className={cn('min-w-12 text-right text-sm tabular-nums', ft.title)}
													>
														{Math.round(themePaletteDraft.popupBackgroundFuzziness)}%
													</output>
												</div>
												<input
													id="settings-popup-fuzziness"
													type="range"
													min={0}
													max={100}
													step={1}
													value={themePaletteDraft.popupBackgroundFuzziness}
													onChange={(event) => {
														const popupBackgroundFuzziness = Number(event.target.value);
														setThemePaletteDraft((prev) => ({
															...prev,
															popupBackgroundFuzziness
														}));
														markChanged();
													}}
													className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[color:var(--theme-panel-border)]"
													style={{ accentColor: 'var(--theme-accent)' }}
												/>
												<p className={cn('text-xs leading-relaxed', ft.muted)}>
													{t('settings_popup_fuzziness_hint')}
												</p>
											</div>
											<div className="grid gap-4 sm:grid-cols-2">
												{(
													[
														['mainSidebarStart', 'settings_theme_main_sidebar_start'],
														['mainSidebarEnd', 'settings_theme_main_sidebar_end'],
														['secondarySidebarStart', 'settings_theme_secondary_sidebar_start'],
														['secondarySidebarEnd', 'settings_theme_secondary_sidebar_end'],
														['canvasStart', 'settings_theme_canvas_start'],
														['canvasEnd', 'settings_theme_canvas_end'],
														['navTextPrimary', 'settings_theme_nav_text_primary'],
														['navTextSecondary', 'settings_theme_nav_text_secondary'],
														['contentTextPrimary', 'settings_theme_content_text_primary'],
														['contentTextSecondary', 'settings_theme_content_text_secondary'],
														['contentMuted', 'settings_theme_content_muted'],
														['accent', 'settings_theme_accent']
													] as const
												).map(([key, labelKey]) => (
													<div key={key} className="flex items-center gap-3">
														<div className="min-w-0 flex-1">
															<Label className={cn(ft.label, 'mb-1 block')}>{t(labelKey)}</Label>
															<Input
																className={ft.inputCompact}
																value={themePaletteDraft[key]}
																onChange={(e) => {
																	const value = e.target.value;
																	setThemePaletteDraft((prev) => ({ ...prev, [key]: value }));
																	markChanged();
																}}
															/>
														</div>
														<ColorInput
															className="mt-5 w-14"
															value={themePaletteDraft[key]}
															onChange={(e) => {
																const value = e.target.value;
																setThemePaletteDraft((prev) => ({ ...prev, [key]: value }));
																markChanged();
															}}
															aria-label={t(labelKey)}
														/>
													</div>
												))}
											</div>
											<div className="grid gap-4 sm:grid-cols-2">
												{(
													[
														['hoverBackground', 'settings_theme_hover_background'],
														['selectedBackground', 'settings_theme_selected_background']
													] as const
												).map(([key, labelKey]) => {
													const parsedColor = parseThemeColor(themePaletteDraft[key]);
													const defaultAlpha = parseThemeColor(
														DEFAULT_THEME_PALETTES[theme][key]
													).alpha;
													const transparencyId = `settings-${key}-transparency`;
													return (
														<div key={key} className="space-y-2">
															<Label className={ft.label}>{t(labelKey)}</Label>
															<div className="flex items-center gap-3">
																<Input
																	className={cn(ft.inputCompact, 'min-w-0 flex-1')}
																	value={themePaletteDraft[key]}
																	onChange={(e) => {
																		const value = e.target.value;
																		setThemePaletteDraft((prev) => ({ ...prev, [key]: value }));
																		markChanged();
																	}}
																/>
																<ColorInput
																	className="w-14"
																	value={parsedColor.hex}
																	onChange={(event) => {
																		const value = formatThemeColor(
																			event.target.value,
																			parsedColor.alpha
																		);
																		setThemePaletteDraft((prev) => ({ ...prev, [key]: value }));
																		markChanged();
																	}}
																	aria-label={t(labelKey)}
																/>
															</div>
															<div className="flex items-center gap-2">
																<Switch
																	id={transparencyId}
																	checked={parsedColor.alpha < 1}
																	onCheckedChange={(checked) => {
																		const alpha = checked ? defaultAlpha : 1;
																		setThemePaletteDraft((prev) => ({
																			...prev,
																			[key]: formatThemeColor(parsedColor.hex, alpha)
																		}));
																		markChanged();
																	}}
																/>
																<Label
																	htmlFor={transparencyId}
																	className={cn('cursor-pointer text-xs', ft.muted)}
																>
																	{t('settings_theme_transparency')}
																</Label>
															</div>
														</div>
													);
												})}
											</div>
											<div className="pt-1">
												<Button
													type="button"
													variant="outline"
													className={cn(ft.footerCancel, 'max-w-xs')}
													onClick={() => {
														setThemePaletteDraft(DEFAULT_THEME_PALETTES[theme]);
														markChanged();
													}}
												>
													{t('settings_theme_reset_current')}
												</Button>
											</div>
										</AccordionContent>
									</AccordionItem>
									<AccordionItem value="monochrome">
										<AccordionTrigger className={ft.title}>
											{t('settings_monochrome_title', { defaultValue: 'Monochromatic view' })}
										</AccordionTrigger>
										<AccordionContent className="space-y-3">
											<div className="flex items-center gap-2">
												<Switch
													id="settings-monochrome"
													checked={monochrome}
													onCheckedChange={(checked) => {
														onMonochromeChange(checked);
														persistMonochrome(checked);
														markChanged();
													}}
												/>
												<Label
													htmlFor="settings-monochrome"
													className={cn('cursor-pointer', ft.label)}
												>
													{t('settings_monochrome_label', {
														defaultValue: 'Use a monochromatic (grayscale) app appearance'
													})}
												</Label>
											</div>
											<p className={cn('text-xs leading-relaxed', ft.muted)}>
												{t('settings_monochrome_hint', {
													defaultValue:
														'Desaturates the whole app on top of any theme or palette. Your theme and palette colors stay as-is underneath.'
												})}
											</p>
										</AccordionContent>
									</AccordionItem>
								</Accordion>
							)}

							{section === 'jan_kefer' && (
								<div className="space-y-4">
									<p className={ft.label}>
										{t('section_jan_kefer', { defaultValue: 'Jan Kefer' })}
									</p>
									{janKeferBiography.map((paragraph, index) => (
										<p key={index} className={cn('text-sm leading-relaxed', ft.bodyText)}>
											{paragraph}
										</p>
									))}
								</div>
							)}

							{section === 'manual' && (
								<div className="space-y-4">
									<p className={cn('text-sm leading-relaxed', ft.muted)}>{t('settings_guide')}</p>
								</div>
							)}
						</CardContent>

						<CardFooter className="shrink-0 flex-col gap-2 border-0 bg-transparent px-6 py-4 sm:flex-row md:px-8">
							<Button
								type="button"
								variant="outline"
								className={ft.footerCancel}
								onClick={handleCancel}
							>
								{t('cancel')}
							</Button>
							<Button
								type="button"
								className={ft.footerPrimary}
								onClick={handleConfirm}
								disabled={!settingsChanged}
							>
								{t('confirm')}
							</Button>
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
