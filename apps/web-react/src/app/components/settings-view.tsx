import { Languages } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { SecondaryNavPanel } from './secondary-nav-panel';
import { getAppFormFieldTheme } from './form-field-theme';
import type { Theme } from './astrology-sidebar';
import type { AppLanguage } from '@/lib/i18n';

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
		id: 'kerykeion' as const,
		label: 'Kerykeion',
		description: 'Vector astrology symbols.'
	},
	{
		id: 'classic' as const,
		label: 'Classic',
		description: 'Compact textual glyph set.'
	}
];

const ASPECT_ROWS = [
	{ id: 'conjunction', labelKey: 'aspect_conjunction', defaultOrb: 8 },
	{ id: 'sextile', labelKey: 'aspect_sextile', defaultOrb: 6 },
	{ id: 'square', labelKey: 'aspect_square', defaultOrb: 8 },
	{ id: 'trine', labelKey: 'aspect_trine', defaultOrb: 8 },
	{ id: 'quincunx', labelKey: 'aspect_quincunx', defaultOrb: 3 },
	{ id: 'opposition', labelKey: 'aspect_opposition', defaultOrb: 8 }
] as const;

type SettingsSectionId =
	| 'jazyk'
	| 'lokace'
	| 'system_domu'
	| 'nastaveni_aspektu'
	| 'vzhled'
	| 'manual';

const GLYPH_SET_KEY = 'glyph_set';

function readStoredGlyphSet(): (typeof GLYPH_SET_OPTIONS)[number]['id'] {
	try {
		const v = localStorage.getItem(GLYPH_SET_KEY);
		if (v === 'kerykeion' || v === 'classic') return v;
	} catch {
		/* ignore */
	}
	return 'kerykeion';
}

interface SettingsViewProps {
	theme: Theme;
}

export function SettingsView({ theme }: SettingsViewProps) {
	const { t, i18n } = useTranslation();
	const ft = useMemo(() => getAppFormFieldTheme(theme), [theme]);

	const [section, setSection] = useState<SettingsSectionId>('jazyk');
	const [settingsChanged, setSettingsChanged] = useState(false);

	const [defaultLocation, setDefaultLocation] = useState('');
	const [latitude, setLatitude] = useState('');
	const [longitude, setLongitude] = useState('');
	const [houseSystem, setHouseSystem] = useState<string>('Placidus');

	const [aspects, setAspects] = useState(
		() =>
			Object.fromEntries(
				ASPECT_ROWS.map((a) => [a.id, { enabled: true, orb: a.defaultOrb }])
			) as Record<string, { enabled: boolean; orb: number }>
	);

	const [presetValue, setPresetValue] = useState<string>('default');
	const [glyphSetValue, setGlyphSetValue] = useState<(typeof GLYPH_SET_OPTIONS)[number]['id']>(() =>
		readStoredGlyphSet()
	);

	const sectionNav = useMemo(
		() =>
			[
				{ id: 'jazyk' as const, label: t('section_jazyk') },
				{ id: 'lokace' as const, label: t('section_lokace') },
				{ id: 'system_domu' as const, label: t('section_system_domu') },
				{ id: 'nastaveni_aspektu' as const, label: t('section_nastaveni_aspektu') },
				{ id: 'vzhled' as const, label: t('section_vzhled') },
				{ id: 'manual' as const, label: t('section_manual') }
			] as const,
		[t]
	);

	const onGlyphSetChange = useCallback((value: string) => {
		const v = value === 'classic' || value === 'kerykeion' ? value : 'kerykeion';
		setGlyphSetValue(v);
		setSettingsChanged(true);
		try {
			localStorage.setItem(GLYPH_SET_KEY, v);
		} catch {
			/* ignore */
		}
	}, []);

	const markChanged = useCallback(() => setSettingsChanged(true), []);

	const handleCancel = useCallback(() => {
		setSettingsChanged(false);
		setDefaultLocation('');
		setLatitude('');
		setLongitude('');
		setHouseSystem('Placidus');
		setAspects(
			Object.fromEntries(
				ASPECT_ROWS.map((a) => [a.id, { enabled: true, orb: a.defaultOrb }])
			) as Record<string, { enabled: boolean; orb: number }>
		);
		setPresetValue('default');
		const g = readStoredGlyphSet();
		setGlyphSetValue(g);
	}, []);

	const handleConfirm = useCallback(() => {
		setSettingsChanged(false);
	}, []);

	const glyphDescription = GLYPH_SET_OPTIONS.find((s) => s.id === glyphSetValue)?.description;

	return (
		<div className="flex min-h-full flex-col p-6 md:p-8">
			<header className="shrink-0">
				<h1 className={cn('text-xl font-semibold', ft.title)}>{t('app_settings')}</h1>
			</header>

			<div className="mt-6 grid min-h-0 flex-1 gap-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-stretch">
				<SecondaryNavPanel
					theme={theme}
					items={sectionNav.map((item) => ({ id: item.id, label: item.label }))}
					activeId={section}
					onSelect={(id) => setSection(id as SettingsSectionId)}
					ariaLabel={t('settings')}
					className="lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto"
				/>

				<Card
					className={cn(
						'flex min-h-[min(70vh,520px)] min-w-0 flex-col gap-0 rounded-xl p-0 shadow-none',
						ft.settingsCard,
						'border-0 shadow-none'
					)}
				>
					<CardContent className="min-h-0 flex-1 overflow-y-auto px-6 pt-6 pb-2">
						{section === 'jazyk' && (
							<div className="max-w-xl space-y-4">
								<div className="flex items-center gap-2">
									<Languages
										className={cn(
											'h-6 w-6 shrink-0',
											ft.isTwilight ? 'text-white' : ft.isDark ? 'text-blue-400' : 'text-indigo-600'
										)}
										aria-hidden
									/>
									<h2 className={ft.sectionTitle}>{t('section_jazyk')}</h2>
								</div>
								<div className="space-y-2">
									<p className={ft.label}>{t('language')}</p>
									<p className={cn('text-sm', ft.muted)}>{t('select_language')}</p>
									<div
										className="mt-3 flex flex-wrap gap-3"
										role="group"
										aria-label={t('label_languages')}
									>
										{LANG_BUBBLES.map(({ code, label }) => {
											const active = i18n.language === code || i18n.language.startsWith(`${code}-`);
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
							<div className="max-w-md space-y-4">
								<h2 className={ft.sectionTitle}>{t('section_lokace')}</h2>
								<div className="space-y-2">
									<Label className={ft.label}>{t('default_location')}</Label>
									<Input
										value={defaultLocation}
										onChange={(e) => {
											setDefaultLocation(e.target.value);
											markChanged();
										}}
										placeholder={t('placeholder_default_location')}
										className={cn(ft.input, 'shadow-inner')}
									/>
								</div>
								<div className="space-y-2">
									<Label className={ft.label}>{t('current_info_latitude')}</Label>
									<Input
										value={latitude}
										onChange={(e) => {
											setLatitude(e.target.value);
											markChanged();
										}}
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
										placeholder={t('placeholder_longitude')}
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
										onValueChange={(v) => {
											setHouseSystem(v);
											markChanged();
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
								</div>
							</div>
						)}

						{section === 'nastaveni_aspektu' && (
							<div className="max-w-md space-y-4">
								<h2 className={ft.sectionTitle}>{t('section_nastaveni_aspektu')}</h2>
								<div className="space-y-2">
									<p className={ft.label}>{t('default_aspects')}</p>
									<div className="space-y-3">
										{ASPECT_ROWS.map((aspect) => {
											const row = aspects[aspect.id] ?? {
												enabled: true,
												orb: aspect.defaultOrb
											};
											return (
												<div key={aspect.id} className="flex items-center justify-between gap-3">
													<label className="flex cursor-pointer items-center gap-2">
														<Checkbox
															checked={row.enabled}
															onCheckedChange={(checked) => {
																setAspects((prev) => ({
																	...prev,
																	[aspect.id]: {
																		...row,
																		enabled: checked === true
																	}
																}));
																markChanged();
															}}
														/>
														<span className={cn('text-sm', ft.title)}>{t(aspect.labelKey)}</span>
													</label>
													<Input
														type="number"
														className={cn(ft.inputCompact, 'h-9 w-20')}
														value={row.orb}
														min={0}
														max={30}
														step={0.5}
														onChange={(e) => {
															const n = Number(e.target.value);
															setAspects((prev) => ({
																...prev,
																[aspect.id]: {
																	...row,
																	orb: Number.isFinite(n) ? n : row.orb
																}
															}));
															markChanged();
														}}
													/>
												</div>
											);
										})}
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
										onValueChange={(v) => {
											setPresetValue(v);
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
												{PRESET_OPTIONS.map((p) => (
													<SelectItem key={p.value} value={p.value} className={ft.selectItem}>
														{p.label}
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
											{GLYPH_SET_OPTIONS.map((setOpt) => (
												<SelectItem key={setOpt.id} value={setOpt.id} className={ft.selectItem}>
													{setOpt.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									{glyphDescription ? (
										<p className={cn('text-xs', ft.muted)}>{glyphDescription}</p>
									) : null}
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

					<CardFooter className="shrink-0 flex-col gap-2 bg-transparent px-4 py-4 sm:flex-row sm:px-6">
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
		</div>
	);
}
