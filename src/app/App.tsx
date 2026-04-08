import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { AstrologySidebar, Theme } from './components/astrology-sidebar';
import { Card, CardContent } from './components/ui/card';
import { cn } from './components/ui/utils';
import { getAppFormFieldTheme } from './components/form-field-theme';
import { NewHoroscope } from './components/new-horoscope';
import { TransitsSecondarySidebar, TransitSection } from './components/transits-secondary-sidebar';
import { TransitsContent } from './components/transits-content';
import { Aspectarium } from './components/aspectarium';
import { HoroscopeDashboard } from './components/horoscope-dashboard';
import { InformationView } from './components/information-view';
import { SettingsView } from './components/settings-view';
import { Toaster } from './components/ui/sonner';
import twilightBg from '@/assets/4dcbee9e5042848c83d74ae11e665f672e4fffc2.png';
import { toast } from 'sonner';
import {
	BOOTSTRAP_CHART_ID,
	chartDataToComputePayload,
	createBootstrapChart,
	DEFAULT_WORKSPACE_DEFAULTS,
	type AppChart,
	type WorkspaceDefaultsState
} from '@/lib/tauri/chartPayload';
import {
	WorkspaceChartsProvider,
	type WorkspaceChartsValue
} from './workspace-charts-context';
import {
	initStorage,
	openFolderDialog,
	openWorkspaceFolder,
	saveWorkspace
} from '@/lib/tauri/workspace';
import type { WorkspaceDefaultsDto } from '@/lib/tauri/types';

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
			: prev.defaultAspects
	};
}

export default function App() {
	const { t } = useTranslation();
	const [theme, setTheme] = useState<Theme>('noon');
	const formTheme = useMemo(() => getAppFormFieldTheme(theme), [theme]);
	const [activeView, setActiveView] = useState<string>('horoskop');
	const [activeTransitSection, setActiveTransitSection] = useState<TransitSection>('general');
	const [workspacePath, setWorkspacePath] = useState<string | null>(null);
	const [charts, setCharts] = useState<AppChart[]>(() => [
		createBootstrapChart(DEFAULT_WORKSPACE_DEFAULTS)
	]);
	const [selectedChartId, setSelectedChartId] = useState<string | null>(BOOTSTRAP_CHART_ID);
	const [workspaceDefaults, setWorkspaceDefaults] = useState<WorkspaceDefaultsState>(() => ({
		...DEFAULT_WORKSPACE_DEFAULTS
	}));

	const addChart = useCallback((chart: AppChart) => {
		setCharts((prev) => [...prev, chart]);
		setSelectedChartId(chart.id);
	}, []);

	const replaceChartsFromWorkspace = useCallback(
		(loaded: AppChart[]) => {
			const list = loaded.length > 0 ? loaded : [createBootstrapChart(workspaceDefaults)];
			setCharts(list);
			setSelectedChartId(list[0]!.id);
		},
		[workspaceDefaults]
	);

	const workspaceChartsValue = useMemo<WorkspaceChartsValue>(
		() => ({
			charts,
			selectedChartId,
			selectedChart: charts.find((c) => c.id === selectedChartId),
			setSelectedChartId,
			setCharts,
			addChart,
			replaceChartsFromWorkspace
		}),
		[charts, selectedChartId, addChart, replaceChartsFromWorkspace]
	);

	const handleChartCreated = async (chart: AppChart) => {
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
	};

	const shadcnDark = theme === 'twilight' || theme === 'midnight';

	useLayoutEffect(() => {
		document.documentElement.classList.toggle('dark', shadcnDark);
	}, [shadcnDark]);

	// Reset transit section when changing views
	const handleMenuItemClick = (view: string) => {
		if (view === 'otevrit') {
			void (async () => {
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
			})();
			return;
		}
		if (view === 'ulozit') {
			void (async () => {
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
					await saveWorkspace(path, 'User', payloads);
					await initStorage(path);
					setWorkspacePath(path);
					toast.success(t('toast_workspace_saved'), { description: path });
				} catch (e) {
					console.error(e);
					toast.error(t('toast_save_failed'), {
						description: e instanceof Error ? e.message : String(e)
					});
				}
			})();
			return;
		}
		setActiveView(view);
		if (view === 'tranzity') {
			setActiveTransitSection('general');
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
			bg: '',
			text: 'text-white',
			style: {
				backgroundImage: `url(${twilightBg})`,
				backgroundSize: 'cover',
				backgroundPosition: 'center',
				backgroundRepeat: 'no-repeat',
				backgroundAttachment: 'fixed'
			}
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

			{/* Main Content Area */}
			<main
				className={`flex-1 ${currentThemeStyle.bg} ${currentThemeStyle.text} overflow-auto transition-colors duration-500`}
				style={currentThemeStyle.style}
			>
				{activeView === 'horoskop' ? (
					<HoroscopeDashboard theme={theme} />
				) : activeView === 'informace' ? (
					<InformationView theme={theme} />
				) : activeView === 'novy' ? (
					<NewHoroscope
						theme={theme}
						workspaceDefaults={workspaceDefaults}
						existingChartIds={new Set(charts.map((c) => c.id))}
						onCreated={handleChartCreated}
						onBack={() => setActiveView('horoskop')}
					/>
				) : activeView === 'aspektarium' ? (
					<Aspectarium theme={theme} />
				) : activeView === 'tranzity' ? (
					<TransitsContent section={activeTransitSection} theme={theme} />
				) : activeView === 'nastaveni' ? (
					<SettingsView theme={theme} />
				) : (
					<div className="flex min-h-full flex-col p-6 md:p-8">
						<Card
							className={cn(
								'max-w-xl gap-0 border p-0 shadow-lg',
								formTheme.settingsCard
							)}
						>
							<CardContent className="space-y-3 p-6">
								<h1 className={cn('text-xl font-semibold', formTheme.title)}>
									{t('placeholder_view_title')}
								</h1>
								<p className={cn('text-sm', formTheme.muted)}>{t('placeholder_view_subtitle')}</p>
								<p className={cn('text-sm leading-relaxed', formTheme.muted)}>
									{t('placeholder_view_body')}
								</p>
							</CardContent>
						</Card>
					</div>
				)}
			</main>
		</div>
		</WorkspaceChartsProvider>
		<Toaster theme={shadcnDark ? 'dark' : 'light'} />
		</>
	);
}
