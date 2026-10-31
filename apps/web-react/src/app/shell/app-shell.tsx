import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppMainContentContainer, AppMainContentRoot } from '@/app/components/app-main-content';
import { AstrologySidebar } from '@/app/components/astrology-sidebar';
import { Card, CardContent } from '@/app/components/ui/card';
import { cn } from '@/app/components/ui/utils';
import { useAppFormFieldTheme } from '@/app/components/form-field-theme';
import { NewHoroscope } from '@/app/features/horoscope/new-horoscope/new-horoscope';
import {
	SettingsSecondarySidebar,
	type SettingsSectionId
} from '@/app/features/settings/settings-secondary-sidebar';
import {
	TransitsSecondarySidebar,
	type TransitSection
} from '@/app/components/transits-secondary-sidebar';
import { TransitsContent } from '@/app/components/transits-content';
import { TransitLayersPanel } from '@/app/components/transit-layers-panel';
import { TransitsResultsDashboard } from '@/app/components/transits-results-dashboard';
import { Aspectarium } from '@/app/components/aspectarium';
import { HoroscopeDashboard } from '@/app/components/horoscope-dashboard';
import { InformationView } from '@/app/components/information-view';
import { RevolutionView } from '@/app/components/revolution-view';
import { SynastryView } from '@/app/components/synastry-view';
import { SettingsView } from '@/app/features/settings/settings-view';
import { ExportWorkspaceView } from '@/app/components/export-workspace-view';
import { GuidedTour } from '@/app/components/guided-tour';
import { Toaster } from '@/app/components/ui/sonner';
import { KeferLoaderOverlay } from '@/app/components/ui/kefer-loader';
import { WindowTitlebar } from '@/app/components/window-titlebar';
import { HoroscopeContextTabs } from '@/app/components/horoscope-context-tabs';
import { DetailSidePanel } from '@/app/components/detail-side-panel';
import { OpenWorkspaceView } from '@/app/features/open/open-workspace-view';
import { useAppearance } from '@/app/providers/appearance';
import { useWorkspace } from '@/app/providers/workspace';
import { useWorkspaceCharts } from '@/app/providers/workspace-charts';
import {
	TransitsWorkspaceProvider,
	useTransitsWorkspace
} from '@/app/providers/transits-workspace';
import type { AppChart } from '@/lib/tauri/chartPayload';

/** Views that show the workspace chart tabs under their content. */
const CHART_CONTEXT_VIEWS = new Set([
	'horoskop',
	'aspektarium',
	'informace',
	'tranzity',
	'dynamika',
	'revoluce',
	'synastrie'
]);

/** Views with a secondary sidebar (the titlebar reserves room for it). */
const SECONDARY_SIDEBAR_VIEWS = new Set(['otevrit', 'tranzity', 'dynamika', 'nastaveni']);

/** Transits secondary sidebar: setup sections until a series is computed, then the transited
 *  objects of the results (`TransitsWorkspaceProvider` owns which). */
function TransitsSecondarySidebarSlot({
	dynamic,
	activeSection,
	onSectionChange
}: {
	dynamic: boolean;
	activeSection: TransitSection;
	onSectionChange: (section: TransitSection) => void;
}) {
	const { mode } = useTransitsWorkspace();
	if (mode === 'results') return <TransitLayersPanel />;
	return (
		<TransitsSecondarySidebar
			activeSection={activeSection}
			onSectionChange={onSectionChange}
			dynamic={dynamic}
		/>
	);
}

/** Transits main content: setup or results, same switch as the sidebar slot. */
function TransitsMainContentSlot({ section }: { section: TransitSection }) {
	const { mode } = useTransitsWorkspace();
	const { workspaceDefaults } = useWorkspace();
	if (mode === 'results') return <TransitsResultsDashboard workspaceDefaults={workspaceDefaults} />;
	return <TransitsContent section={section} />;
}

function PlaceholderView() {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme();
	return (
		<AppMainContentRoot>
			<AppMainContentContainer width="standard">
				<Card variant="ghost" className="gap-0 p-0">
					<CardContent className="space-y-3 p-6 md:p-8">
						<h1 className={cn('text-xl font-semibold', ft.title)}>{t('placeholder_view_title')}</h1>
						<p className={cn('text-sm', ft.muted)}>{t('placeholder_view_subtitle')}</p>
						<p className={cn('text-sm leading-relaxed', ft.muted)}>{t('placeholder_view_body')}</p>
					</CardContent>
				</Card>
			</AppMainContentContainer>
		</AppMainContentRoot>
	);
}

/** Window chrome, navigation and view routing. State lives in the appearance and workspace
 *  providers; this component only decides what is shown. */
export function AppShell() {
	const { t } = useTranslation();
	const appearance = useAppearance();
	const workspace = useWorkspace();
	const { charts, setSelectedChartId } = useWorkspaceCharts();

	const [activeView, setActiveView] = useState('horoskop');
	const [activeTransitSection, setActiveTransitSection] = useState<TransitSection>('general');
	const [activeSettingsSection, setActiveSettingsSection] =
		useState<SettingsSectionId>('jazyk_lokace');
	const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
	const [editingChart, setEditingChart] = useState<AppChart | null>(null);

	const existingChartIds = new Set(charts.map((chart) => chart.id));

	const handleMenuItemClick = (view: string) => {
		if (view === 'ulozit') {
			void workspace.saveWorkspace();
			return;
		}
		setActiveView(view);
		if (view === 'tranzity' || view === 'dynamika') setActiveTransitSection('general');
		if (view === 'nastaveni') setActiveSettingsSection('jazyk_lokace');
	};

	const renderView = () => {
		switch (activeView) {
			case 'horoskop':
				return (
					<HoroscopeDashboard
						workspaceDefaults={workspace.workspaceDefaults}
						wheelStyle={appearance.wheelStyle}
						wheelOrientation={appearance.wheelOrientation}
						elementColors={appearance.elementColors}
						lightPlanetFill={appearance.lightPlanetFill}
						enabledSymbolSetIds={appearance.enabledSymbolSetIds}
						onEdit={setEditingChart}
						onObservableObjectsChange={workspace.setObservableObjects}
					/>
				);
			case 'otevrit':
				return (
					<OpenWorkspaceView
						onOpenWorkspace={async () => {
							if (await workspace.openWorkspace()) setActiveView('horoskop');
						}}
						onActivateChart={(id) => {
							setSelectedChartId(id);
							setActiveView('horoskop');
						}}
					/>
				);
			case 'export':
				return <ExportWorkspaceView />;
			case 'informace':
				return (
					<InformationView
						wheelStyle={appearance.wheelStyle}
						elementColors={appearance.elementColors}
						lightPlanetFill={appearance.lightPlanetFill}
					/>
				);
			case 'novy':
				return (
					<NewHoroscope
						pageWidth={isSidebarExpanded ? 'standard' : 'relaxed'}
						workspaceDefaults={workspace.workspaceDefaults}
						workspaceTags={workspace.workspaceTags}
						existingChartIds={existingChartIds}
						onCreated={async (chart) => {
							if (await workspace.createChart(chart)) setActiveView('horoskop');
						}}
						onBack={() => setActiveView('horoskop')}
					/>
				);
			case 'aspektarium':
				return (
					<Aspectarium
						workspaceDefaults={workspace.workspaceDefaults}
						enabledSymbolSetIds={appearance.enabledSymbolSetIds}
					/>
				);
			case 'revoluce':
				return <RevolutionView />;
			case 'synastrie':
				return (
					<SynastryView
						onCreated={async (chart) => {
							if (await workspace.createSynastry(chart)) setActiveView('otevrit');
						}}
					/>
				);
			case 'tranzity':
			case 'dynamika':
				return <TransitsMainContentSlot section={activeTransitSection} />;
			case 'nastaveni':
				return <SettingsView section={activeSettingsSection} />;
			default:
				return <PlaceholderView />;
		}
	};

	return (
		<TransitsWorkspaceProvider
			workspacePath={workspace.workspacePath}
			workspaceDefaults={workspace.workspaceDefaults}
		>
			<div className="flex h-screen flex-col overflow-hidden" style={appearance.canvasStyle}>
				<WindowTitlebar
					isSidebarExpanded={isSidebarExpanded}
					showSecondarySidebar={SECONDARY_SIDEBAR_VIEWS.has(activeView)}
				/>
				<div className="flex min-h-0 flex-1 overflow-hidden">
					<AstrologySidebar
						onThemeChange={appearance.setTheme}
						currentTheme={appearance.theme}
						appShellIconSet={appearance.appShellIconSet}
						onMenuItemClick={handleMenuItemClick}
						activeMenuItem={activeView}
						isExpanded={isSidebarExpanded}
						onExpandedChange={setIsSidebarExpanded}
					/>

					{(activeView === 'tranzity' || activeView === 'dynamika') && (
						<TransitsSecondarySidebarSlot
							activeSection={activeTransitSection}
							onSectionChange={setActiveTransitSection}
							dynamic={activeView === 'dynamika'}
						/>
					)}
					{activeView === 'nastaveni' && (
						<SettingsSecondarySidebar
							activeSection={activeSettingsSection}
							onSectionChange={setActiveSettingsSection}
						/>
					)}

					<main className="flex min-h-0 flex-1 flex-col overflow-hidden text-[color:var(--theme-content-primary)] transition-colors duration-500">
						<div
							className={cn(
								'min-h-0 flex-1',
								activeView === 'horoskop' ? 'overflow-hidden' : 'overflow-auto'
							)}
						>
							{renderView()}
						</div>
						{CHART_CONTEXT_VIEWS.has(activeView) && <HoroscopeContextTabs />}
					</main>
				</div>
				<DetailSidePanel
					open={editingChart !== null}
					onOpenChange={(open) => {
						if (!open) setEditingChart(null);
					}}
					title={t('edit_radix_title')}
					description={editingChart?.name}
					contentClassName="sm:max-w-xl lg:w-[min(48rem,70vw)] lg:max-w-3xl"
					bodyClassName="overflow-y-auto p-0"
				>
					{editingChart && (
						<NewHoroscope
							key={editingChart.id}
							presentation="panel"
							workspaceDefaults={workspace.workspaceDefaults}
							workspaceTags={workspace.workspaceTags}
							existingChartIds={existingChartIds}
							initialValues={editingChart}
							onSaved={async (chart) => {
								if (await workspace.saveChart(chart)) setEditingChart(null);
							}}
							onBack={() => setEditingChart(null)}
						/>
					)}
				</DetailSidePanel>
			</div>
			<Toaster theme={appearance.dark ? 'dark' : 'light'} />
			<GuidedTour />
			<KeferLoaderOverlay active={workspace.bootLoading} />
		</TransitsWorkspaceProvider>
	);
}
