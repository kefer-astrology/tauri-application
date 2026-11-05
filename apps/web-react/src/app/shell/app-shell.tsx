import { Heading, Text } from '@/app/components/ui/typography';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppMainContentContainer, AppMainContentRoot } from '@/app/components/ui/app-main-content';
import { AstrologySidebar } from '@/app/shell/astrology-sidebar';
import { Card, CardContent } from '@/app/components/ui/card';
import { cn } from '@/app/components/ui/utils';
import { NewHoroscope } from '@/app/features/horoscope/new-horoscope/new-horoscope';
import {
	SettingsSecondarySidebar,
	type SettingsSectionId
} from '@/app/features/settings/settings-secondary-sidebar';
import { TransitsProvider } from '@/app/features/transits/transits-provider';
import {
	TransitsSidebar,
	TransitsView,
	type TransitSection
} from '@/app/features/transits/transits-view';
import { AspectariumView } from '@/app/features/horoscope/aspectarium/aspectarium-view';
import { HoroskopView } from '@/app/features/horoscope/horoskop/horoskop-view';
import { SpektrumView } from '@/app/features/horoscope/spektrum/spektrum-view';
import { RevolutionView } from '@/app/features/revolution/revolution-view';
import { SynastryView } from '@/app/features/synastry/synastry-view';
import { SettingsView } from '@/app/features/settings/settings-view';
import { ExportView } from '@/app/features/export/export-view';
import { GuidedTour } from '@/app/shell/guided-tour';
import { Toaster } from '@/app/components/ui/sonner';
import { KeferLoaderOverlay } from '@/app/components/ui/kefer-loader';
import { WindowTitlebar } from '@/app/shell/window-titlebar';
import { HoroscopeContextTabs } from '@/app/shell/horoscope-context-tabs';
import { DetailSidePanel } from '@/app/views/data/detail-side-panel';
import { OpenWorkspaceView } from '@/app/features/open/open-workspace-view';
import { useAppearance } from '@/app/providers/appearance';
import { useWorkspace } from '@/app/providers/workspace';
import { useWorkspaceCharts } from '@/app/providers/workspace-charts';
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

function PlaceholderView() {
	const { t } = useTranslation();

	return (
		<AppMainContentRoot>
			<AppMainContentContainer width="standard">
				<Card spacing="flush" variant="ghost" className="p-0">
					<CardContent className="space-y-3 p-6 md:p-8">
						<Heading variant="pageTitle" level={1}>
							{t('placeholder_view_title')}
						</Heading>
						<Text variant="body" tone="muted">
							{t('placeholder_view_subtitle')}
						</Text>
						<Text variant="body" tone="muted">
							{t('placeholder_view_body')}
						</Text>
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
	const [exportOpen, setExportOpen] = useState(false);
	const exportTriggerRef = useRef<HTMLElement | null>(null);

	const existingChartIds = new Set(charts.map((chart) => chart.id));

	const handleMenuItemClick = (view: string) => {
		if (view === 'export') {
			exportTriggerRef.current = document.activeElement as HTMLElement | null;
			setExportOpen(true);
			return;
		}
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
					<HoroskopView
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
			case 'informace':
				return (
					<SpektrumView
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
					<AspectariumView
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
				return <TransitsView section={activeTransitSection} />;
			case 'nastaveni':
				return <SettingsView section={activeSettingsSection} />;
			default:
				return <PlaceholderView />;
		}
	};

	return (
		<TransitsProvider>
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

					<div className="flex min-h-0 min-w-0 flex-1 flex-col xl:flex-row">
						{(activeView === 'tranzity' || activeView === 'dynamika') && (
							<TransitsSidebar
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
				</div>
				<DetailSidePanel
					open={exportOpen}
					onOpenChange={setExportOpen}
					onCloseAutoFocus={(event) => {
						if (exportTriggerRef.current?.isConnected) {
							event.preventDefault();
							exportTriggerRef.current.focus();
						}
					}}
					title={t('export')}
					description={t('export_include')}
					contentClassName="sm:max-w-md lg:w-full"
					bodyClassName="overflow-y-auto"
				>
					<ExportView />
				</DetailSidePanel>
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
		</TransitsProvider>
	);
}
