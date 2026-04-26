import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState
} from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { AppMainContentContainer, AppMainContentRoot } from './components/app-main-content';
import { AstrologySidebar, Theme } from './components/astrology-sidebar';
import { Card, CardContent } from './components/ui/card';
import { cn } from './components/ui/utils';
import { useAppFormFieldTheme } from './components/form-field-theme';
import { NewHoroscope } from './components/new-horoscope';
import {
	type SettingsSectionId,
	SettingsSecondarySidebar
} from './components/settings-secondary-sidebar';
import { TransitsSecondarySidebar, TransitSection } from './components/transits-secondary-sidebar';
import { TransitsContent } from './components/transits-content';
import { Aspectarium } from './components/aspectarium';
import { HoroscopeDashboard } from './components/horoscope-dashboard';
import { InformationView } from './components/information-view';
import SettingsView from './components/settings-view';
import { OpenWorkspaceView } from './components/open-workspace-view';
import { ExportWorkspaceView } from './components/export-workspace-view';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';
import {
	aspectLineTierStyleFromDto,
	BOOTSTRAP_CHART_ID,
	chartDataToComputePayload,
	createBootstrapChart,
	DEFAULT_WORKSPACE_DEFAULTS,
	normalizeComputedChartPayload,
	type AppChart,
	type WorkspaceDefaultsState
} from '@/lib/tauri/chartPayload';
import { WorkspaceChartsProvider, type WorkspaceChartsValue } from './providers/workspace-charts';
import {
	computeChart,
	computeChartFromData,
	initStorage,
	openFolderDialog,
	openWorkspaceFolder,
	saveWorkspace,
	saveWorkspaceDefaults
} from '@/lib/tauri/workspace';
import type { WorkspaceDefaultsDto } from '@/lib/tauri/types';
import {
	readStoredAppShellIconSet,
	type AppShellIconSetId
} from '@/lib/app-shell';
import {
	persistElementColors,
	readStoredElementColors,
	type ElementColors
} from '@/lib/astrology/elementColors';
import {
	readStoredGlyphSet,
	type AstrologyGlyphSetId
} from '@/lib/astrology/glyphs';

function mergeWorkspaceDefaults(
	prev: WorkspaceDefaultsState,
	dto: WorkspaceDefaultsDto
): WorkspaceDefaultsState {
	const lat =
		typeof dto.default_location_latitude === 'number'
			? dto.default_location_latitude
			: prev.locationLatitude;
	const lon =
		typeof dto.default_location_longitude === 'number'
			? dto.default_location_longitude
			: prev.locationLongitude;
	return {
		houseSystem: dto.default_house_system?.trim() || prev.houseSystem,
		zodiacType: prev.zodiacType,
		timezone: dto.default_timezone?.trim() || prev.timezone,
		locationName: dto.default_location_name?.trim() || prev.locationName,
		locationLatitude: lat,
		locationLongitude: lon,
		engine: dto.default_engine?.trim() || prev.engine,
		defaultBodies: Array.isArray(dto.default_bodies) ? [...dto.default_bodies] : prev.defaultBodies,
		defaultAspects: Array.isArray(dto.default_aspects)
			? [...dto.default_aspects]
			: prev.defaultAspects,
		defaultAspectOrbs:
			dto.default_aspect_orbs && typeof dto.default_aspect_orbs === 'object'
				? { ...prev.defaultAspectOrbs, ...dto.default_aspect_orbs }
				: prev.defaultAspectOrbs,
		defaultAspectColors:
			dto.default_aspect_colors && typeof dto.default_aspect_colors === 'object'
				? { ...prev.defaultAspectColors, ...dto.default_aspect_colors }
				: prev.defaultAspectColors,
		aspectLineTierStyle: aspectLineTierStyleFromDto(dto.aspect_line_tier_style)
	};
}

function mergeWorkspaceDefaultsPatch(
	prev: WorkspaceDefaultsState,
	patch: Partial<WorkspaceDefaultsState>
): WorkspaceDefaultsState {
	return {
		...prev,
		...patch,
		defaultBodies: Array.isArray(patch.defaultBodies) ? [...patch.defaultBodies] : prev.defaultBodies,
		defaultAspects: Array.isArray(patch.defaultAspects) ? [...patch.defaultAspects] : prev.defaultAspects,
		defaultAspectOrbs: patch.defaultAspectOrbs
			? { ...prev.defaultAspectOrbs, ...patch.defaultAspectOrbs }
			: prev.defaultAspectOrbs,
		defaultAspectColors: patch.defaultAspectColors
			? { ...prev.defaultAspectColors, ...patch.defaultAspectColors }
			: prev.defaultAspectColors,
		aspectLineTierStyle: patch.aspectLineTierStyle
			? { ...prev.aspectLineTierStyle, ...patch.aspectLineTierStyle }
			: prev.aspectLineTierStyle
	};
}

function addUtcStep(
	base: Date,
	step: { unit: 'sec' | 'min' | 'hr' | 'day' | 'month' | 'yr'; amount: number }
): Date {
	const next = new Date(base);
	switch (step.unit) {
		case 'sec':
			next.setUTCSeconds(next.getUTCSeconds() + step.amount);
			break;
		case 'min':
			next.setUTCMinutes(next.getUTCMinutes() + step.amount);
			break;
		case 'hr':
			next.setUTCHours(next.getUTCHours() + step.amount);
			break;
		case 'day':
			next.setUTCDate(next.getUTCDate() + step.amount);
			break;
		case 'month':
			next.setUTCMonth(next.getUTCMonth() + step.amount);
			break;
		case 'yr':
			next.setUTCFullYear(next.getUTCFullYear() + step.amount);
			break;
	}
	return next;
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

	return null;
}

function formatChartDateTimeUtc(value: Date): string {
	return value.toISOString().slice(0, 19) + 'Z';
}

export default function App() {
	const { t } = useTranslation();
	const [theme, setTheme] = useState<Theme>('noon');
	const [appShellIconSet, setAppShellIconSet] = useState<AppShellIconSetId>(() =>
		readStoredAppShellIconSet()
	);
	const [astrologyGlyphSet, setAstrologyGlyphSet] = useState<AstrologyGlyphSetId>(() =>
		readStoredGlyphSet()
	);
	const [elementWheelColors, setElementWheelColors] = useState<ElementColors>(() =>
		readStoredElementColors()
	);
	const [lightPlanetFill, setLightPlanetFill] = useState('#030213');
	const formTheme = useAppFormFieldTheme(theme);

	useLayoutEffect(() => {
		const raw = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
		if (raw) setLightPlanetFill(raw);
	}, [theme]);

	const commitElementWheelColors = useCallback((next: ElementColors) => {
		setElementWheelColors(next);
		persistElementColors(next);
	}, []);
	const [activeView, setActiveView] = useState<string>('horoskop');
	const [activeTransitSection, setActiveTransitSection] = useState<TransitSection>('general');
	const [activeSettingsSection, setActiveSettingsSection] = useState<SettingsSectionId>('jazyk');
	const [workspacePath, setWorkspacePath] = useState<string | null>(null);
	const [charts, setCharts] = useState<AppChart[]>(() => [
		createBootstrapChart(DEFAULT_WORKSPACE_DEFAULTS)
	]);
	const [selectedChartId, setSelectedChartId] = useState<string | null>(BOOTSTRAP_CHART_ID);
	const [selectedChartPreview, setSelectedChartPreview] = useState<AppChart | null>(null);
	const [workspaceDefaults, setWorkspaceDefaults] = useState<WorkspaceDefaultsState>(() => ({
		...DEFAULT_WORKSPACE_DEFAULTS
	}));
	const computingChartIdsRef = useRef<Set<string>>(new Set());

	const addChart = useCallback((chart: AppChart) => {
		setSelectedChartPreview(null);
		setCharts((prev) => [...prev, chart]);
		setSelectedChartId(chart.id);
	}, []);

	const replaceChartsFromWorkspace = useCallback(
		(loaded: AppChart[]) => {
			const list = loaded.length > 0 ? loaded : [createBootstrapChart(workspaceDefaults)];
			setSelectedChartPreview(null);
			setCharts(list);
			setSelectedChartId(list[0]!.id);
		},
		[workspaceDefaults]
	);

	const applyComputedChartResult = useCallback((chartId: string, result: Awaited<ReturnType<typeof computeChart>>) => {
		setCharts((prev) =>
			prev.map((chart) =>
				chart.id === chartId
					? {
							...chart,
							computed: normalizeComputedChartPayload(result)
						}
					: chart
			)
		);
	}, []);

	const shiftSelectedChartTime = useCallback(
		async (step: { unit: 'sec' | 'min' | 'hr' | 'day' | 'month' | 'yr'; amount: number }) => {
			const persistedChart = charts.find((chart) => chart.id === selectedChartId);
			const selectedChart =
				selectedChartPreview && selectedChartPreview.id === selectedChartId
					? selectedChartPreview
					: persistedChart;
			if (!selectedChart) return;

			const baseTime = parseChartDateTime(selectedChart.dateTime) ?? new Date();
			const shiftedTime = addUtcStep(baseTime, step);
			const shiftedDateTime = formatChartDateTimeUtc(shiftedTime);
			const shiftedChart: AppChart = { ...selectedChart, dateTime: shiftedDateTime };

			const result = await computeChartFromData(chartDataToComputePayload(shiftedChart, workspaceDefaults));
			setSelectedChartPreview({
				...shiftedChart,
				computed: normalizeComputedChartPayload(result)
			});
		},
		[charts, selectedChartId, selectedChartPreview, workspaceDefaults]
	);

	const resetSelectedChartPreview = useCallback(() => {
		setSelectedChartPreview(null);
	}, []);

	const handleSelectChartId = useCallback((id: string | null) => {
		setSelectedChartPreview(null);
		setSelectedChartId(id);
	}, []);

	const workspaceChartsValue = useMemo<WorkspaceChartsValue>(
		() => ({
			charts,
			selectedChartId,
			selectedChart:
				selectedChartPreview && selectedChartPreview.id === selectedChartId
					? selectedChartPreview
					: charts.find((c) => c.id === selectedChartId),
			selectedPersistedChart: charts.find((c) => c.id === selectedChartId),
			isSelectedChartPreview:
				selectedChartPreview !== null && selectedChartPreview.id === selectedChartId,
			setSelectedChartId: handleSelectChartId,
			setCharts,
			addChart,
			replaceChartsFromWorkspace,
			shiftSelectedChartTime,
			resetSelectedChartPreview
		}),
		[
			charts,
			selectedChartId,
			selectedChartPreview,
			handleSelectChartId,
			addChart,
			replaceChartsFromWorkspace,
			shiftSelectedChartTime,
			resetSelectedChartPreview
		]
	);

	const computeChartInBackground = useCallback(
		async (chart: AppChart, targetWorkspacePath: string | null) => {
			if (computingChartIdsRef.current.has(chart.id)) return;
			computingChartIdsRef.current.add(chart.id);
			try {
				const result = targetWorkspacePath
					? await computeChart(targetWorkspacePath, chart.id)
					: await computeChartFromData(chartDataToComputePayload(chart, workspaceDefaults));
				applyComputedChartResult(chart.id, result);
			} catch (e) {
				console.error(`Background compute failed for ${chart.id}:`, e);
			} finally {
				computingChartIdsRef.current.delete(chart.id);
			}
		},
		[applyComputedChartResult, workspaceDefaults]
	);

	const applyWorkspaceDefaultsPatch = useCallback(
		async (patch: Partial<WorkspaceDefaultsState>) => {
			const nextDefaults = mergeWorkspaceDefaultsPatch(workspaceDefaults, patch);
			setWorkspaceDefaults(nextDefaults);

			if (workspacePath) {
				try {
					const persisted = await saveWorkspaceDefaults(workspacePath, nextDefaults);
					setWorkspaceDefaults((prev) => mergeWorkspaceDefaults(prev, persisted));
				} catch (error) {
					console.error('Failed to persist workspace defaults:', error);
				}
			}

			for (const chart of charts) {
				try {
					const result = await computeChartFromData(chartDataToComputePayload(chart, nextDefaults));
					applyComputedChartResult(chart.id, result);
				} catch (error) {
					console.error(`Failed to refresh chart ${chart.id} after defaults change:`, error);
				}
			}
		},
		[workspaceDefaults, workspacePath, charts, applyComputedChartResult]
	);

	const handleChartCreated = async (chart: AppChart) => {
		let persistedWorkspacePath: string | null = workspacePath;
		if (workspacePath) {
			try {
				await invoke<string>('create_chart', {
					workspacePath,
					chart: chartDataToComputePayload(chart, workspaceDefaults)
				});
				await initStorage(workspacePath);
			} catch (e) {
				console.error(e);
				toast.error(t('toast_save_failed'), {
					description: e instanceof Error ? e.message : String(e)
				});
				return;
			}
		}
		addChart(chart);
		setActiveView('horoskop');
		void computeChartInBackground(chart, persistedWorkspacePath);
	};

	const shadcnDark = theme === 'twilight' || theme === 'midnight';

	useLayoutEffect(() => {
		document.documentElement.classList.toggle('dark', shadcnDark);
	}, [shadcnDark]);

	useEffect(() => {
		if (workspacePath) return;
		const bootstrapChart = charts.find((chart) => chart.id === BOOTSTRAP_CHART_ID);
		if (!bootstrapChart) return;
		const hasComputedPositions =
			Object.keys(bootstrapChart.computed?.positions ?? {}).length > 0;
		if (hasComputedPositions) return;
		void computeChartInBackground(bootstrapChart, null);
	}, [charts, computeChartInBackground, workspacePath]);

	const runOpenWorkspaceFolder = useCallback(async () => {
		try {
			const folder = await openFolderDialog();
			if (!folder) return;
			const { path, charts: loaded } = await openWorkspaceFolder(folder, (dto) => {
				setWorkspaceDefaults((w) => mergeWorkspaceDefaults(w, dto));
			});
			setWorkspacePath(path);
			replaceChartsFromWorkspace(loaded);
			toast.success(t('toast_workspace_loaded'), { description: path });
		} catch (e) {
			console.error(e);
			toast.error(t('toast_workspace_open_error'), {
				description: e instanceof Error ? e.message : String(e)
			});
		}
	}, [replaceChartsFromWorkspace, t]);

	const runSaveWorkspace = useCallback(async () => {
		try {
			if (charts.length === 0) {
				toast.message(t('toast_nothing_to_save'), {
					description: t('toast_nothing_to_save_hint')
				});
				return;
			}
			let path = workspacePath;
			if (!path) {
				path = await openFolderDialog();
				if (!path) return;
			}
			const payloads = charts.map((c) => chartDataToComputePayload(c, workspaceDefaults));
			await saveWorkspace(path, 'User', payloads, workspaceDefaults);
			await initStorage(path);
			setWorkspacePath(path);
			toast.success(t('toast_workspace_saved'), { description: path });
		} catch (e) {
			console.error(e);
			toast.error(t('toast_save_failed'), {
				description: e instanceof Error ? e.message : String(e)
			});
		}
	}, [charts, workspacePath, workspaceDefaults, t]);

	// Reset transit section when changing views
	const handleMenuItemClick = (view: string) => {
		if (view === 'otevrit') {
			setActiveView('otevrit');
			return;
		}
		if (view === 'ulozit') {
			void runSaveWorkspace();
			return;
		}
		setActiveView(view);
		if (view === 'tranzity') {
			setActiveTransitSection('general');
		}
		if (view === 'nastaveni') {
			setActiveSettingsSection('jazyk');
		}
	};

	type MainThemeStyle = { bg: string; text: string; style?: CSSProperties };
	const themeStyles: Record<Theme, MainThemeStyle> = {
		sunrise: {
			bg: 'bg-gradient-to-br from-blue-50 via-cyan-50 to-sky-100',
			text: 'text-gray-900'
		},
		noon: {
			bg: 'bg-white',
			text: 'text-gray-900'
		},
			twilight: {
				bg: 'kefer-twilight-bg',
				text: 'text-white'
			},
		midnight: {
			bg: '',
			text: 'text-white',
			style: {
				background:
					'radial-gradient(ellipse at center, #0D1B2E 0%, #0A1528 25%, #0B1729 60%, #0E1A2D 100%)'
			}
		}
	};

	const currentThemeStyle = themeStyles[theme];

	return (
		<>
			<WorkspaceChartsProvider value={workspaceChartsValue}>
				<div className="flex h-screen overflow-hidden">
					{/* Main Sidebar */}
					<AstrologySidebar
						onThemeChange={setTheme}
						currentTheme={theme}
						appShellIconSet={appShellIconSet}
						onMenuItemClick={handleMenuItemClick}
						activeMenuItem={activeView}
					/>

					{/* Secondary Sidebar for Transits */}
					{activeView === 'tranzity' && (
						<TransitsSecondarySidebar
							activeSection={activeTransitSection}
							onSectionChange={setActiveTransitSection}
							theme={theme}
						/>
					)}

					{activeView === 'nastaveni' && (
						<SettingsSecondarySidebar
							activeSection={activeSettingsSection}
							onSectionChange={setActiveSettingsSection}
							theme={theme}
						/>
					)}

					{/* Main Content Area */}
					<main
						className={`flex-1 ${currentThemeStyle.bg} ${currentThemeStyle.text} overflow-auto transition-colors duration-500`}
						style={currentThemeStyle.style}
					>
						{activeView === 'horoskop' ? (
							<HoroscopeDashboard
								theme={theme}
								workspaceDefaults={workspaceDefaults}
								glyphSet={astrologyGlyphSet}
								elementColors={elementWheelColors}
								lightPlanetFill={lightPlanetFill}
							/>
						) : activeView === 'otevrit' ? (
							<OpenWorkspaceView
								theme={theme}
								workspacePath={workspacePath}
								onOpenWorkspace={runOpenWorkspaceFolder}
								onSaveWorkspace={runSaveWorkspace}
								onActivateChart={(id) => {
									handleSelectChartId(id);
									setActiveView('horoskop');
								}}
							/>
						) : activeView === 'export' ? (
							<ExportWorkspaceView theme={theme} />
						) : activeView === 'informace' ? (
							<InformationView
								theme={theme}
								glyphSet={astrologyGlyphSet}
								elementColors={elementWheelColors}
								lightPlanetFill={lightPlanetFill}
							/>
						) : activeView === 'novy' ? (
							<NewHoroscope
								theme={theme}
								workspaceDefaults={workspaceDefaults}
								existingChartIds={new Set(charts.map((c) => c.id))}
								onCreated={handleChartCreated}
								onBack={() => setActiveView('horoskop')}
							/>
						) : activeView === 'aspektarium' ? (
							<Aspectarium theme={theme} glyphSet={astrologyGlyphSet} />
						) : activeView === 'tranzity' ? (
							<TransitsContent
								section={activeTransitSection}
								theme={theme}
								glyphSet={astrologyGlyphSet}
							/>
						) : activeView === 'nastaveni' ? (
							<SettingsView
								theme={theme}
								section={activeSettingsSection}
								appShellIconSet={appShellIconSet}
								onAppShellIconSetChange={setAppShellIconSet}
								astrologyGlyphSet={astrologyGlyphSet}
								onAstrologyGlyphSetChange={setAstrologyGlyphSet}
								elementColors={elementWheelColors}
								onElementColorsCommit={commitElementWheelColors}
								workspaceDefaults={workspaceDefaults}
								onWorkspaceDefaultsChange={applyWorkspaceDefaultsPatch}
							/>
						) : (
							<AppMainContentRoot>
								<AppMainContentContainer layout="center-column">
								<Card variant="ghost" className="gap-0 p-0">
									<CardContent className="space-y-3 p-6 md:p-8">
										<h1 className={cn('text-xl font-semibold', formTheme.title)}>
											{t('placeholder_view_title')}
										</h1>
										<p className={cn('text-sm', formTheme.muted)}>
											{t('placeholder_view_subtitle')}
										</p>
										<p className={cn('text-sm leading-relaxed', formTheme.muted)}>
											{t('placeholder_view_body')}
										</p>
									</CardContent>
								</Card>
								</AppMainContentContainer>
							</AppMainContentRoot>
						)}
					</main>
				</div>
			</WorkspaceChartsProvider>
			<Toaster theme={shadcnDark ? 'dark' : 'light'} />
		</>
	);
}
