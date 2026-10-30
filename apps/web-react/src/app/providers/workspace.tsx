import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode
} from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
	BOOTSTRAP_CHART_ID,
	chartDataToComputePayload,
	createBootstrapChart,
	DEFAULT_WORKSPACE_DEFAULTS,
	normalizeComputedChartPayload,
	synastryDataToAnalysisPayload,
	type AppChart,
	type WorkspaceDefaultsState
} from '@/lib/tauri/chartPayload';
import {
	computeChart,
	computeChartFromData,
	initStorage,
	openFolderDialog,
	openWorkspaceFolder,
	saveWorkspace as saveWorkspaceFiles,
	saveWorkspaceDefaults,
	saveWorkspaceTags
} from '@/lib/tauri/workspace';
import type { WorkspaceTagDefinition } from '@/lib/tauri/types';
import type { TransitOverlay } from '@/lib/astrology/transits';
import {
	addUtcStep,
	formatChartDateTimeUtc,
	chartTimeZone,
	parseChartDateTime,
	type TimeStep
} from '@/lib/chartDateTime';
import {
	mergeModelReportDefaults,
	mergeWorkspaceDefaults,
	mergeWorkspaceDefaultsPatch
} from '@/lib/workspaceDefaults';
import { applyWorkspaceTagColors, mergeWorkspaceTagCatalog } from '@/lib/workspaceTags';
import { WorkspaceChartsProvider, type WorkspaceChartsValue } from './workspace-charts';

/** The open workspace (or the unsaved in-memory one) and every action that changes it. Actions
 *  report success, so callers decide where to navigate. Chart lists and selection are also
 *  provided through `useWorkspaceCharts()`. */
export interface WorkspaceValue {
	workspacePath: string | null;
	workspaceDefaults: WorkspaceDefaultsState;
	workspaceTags: WorkspaceTagDefinition[];
	/** True until the first chart is computed (or a workspace is open). */
	bootLoading: boolean;
	/** Pick a folder and load it; `false` when cancelled or failed (failure is toast-reported). */
	openWorkspace: () => Promise<boolean>;
	saveWorkspace: () => Promise<void>;
	createChart: (chart: AppChart) => Promise<boolean>;
	/** Synastry is persisted as an analysis; `AppChart` is only its list-row facade. */
	createSynastry: (chart: AppChart) => Promise<boolean>;
	saveChart: (chart: AppChart) => Promise<boolean>;
	setObservableObjects: (chartId: string, bodies: string[]) => Promise<void>;
	applyDefaultsPatch: (patch: Partial<WorkspaceDefaultsState>) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

const errorDescription = (error: unknown) =>
	error instanceof Error ? error.message : String(error);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
	const { t } = useTranslation();
	const [workspacePath, setWorkspacePath] = useState<string | null>(null);
	const [charts, setCharts] = useState<AppChart[]>(() => [
		createBootstrapChart(DEFAULT_WORKSPACE_DEFAULTS)
	]);
	const [selectedChartId, setSelectedChartId] = useState<string | null>(BOOTSTRAP_CHART_ID);
	const [selectedChartPreview, setSelectedChartPreview] = useState<AppChart | null>(null);
	const [transitOverlay, setTransitOverlay] = useState<TransitOverlay | null>(null);
	const [workspaceDefaults, setWorkspaceDefaults] = useState<WorkspaceDefaultsState>(() => ({
		...DEFAULT_WORKSPACE_DEFAULTS
	}));
	const [workspaceTags, setWorkspaceTags] = useState<WorkspaceTagDefinition[]>([]);
	const [bootLoading, setBootLoading] = useState(true);
	const computingChartIdsRef = useRef<Set<string>>(new Set());
	const bootstrapComputeAttemptedRef = useRef(false);

	// Defensive: if the bootstrap compute below never settles, don't leave the app hidden behind
	// the loader forever — a failure is already toast-reported there.
	useEffect(() => {
		const id = setTimeout(() => setBootLoading(false), 10000);
		return () => clearTimeout(id);
	}, []);

	const addChart = useCallback((chart: AppChart) => {
		setSelectedChartPreview(null);
		setCharts((prev) => [...prev, chart]);
		setSelectedChartId(chart.id);
	}, []);

	const replaceChartsFromWorkspace = useCallback(
		(loaded: AppChart[]) => {
			const list = loaded.length > 0 ? loaded : [createBootstrapChart(workspaceDefaults)];
			setSelectedChartPreview(null);
			setTransitOverlay(null);
			setCharts(list);
			setSelectedChartId(list[0]!.id);
		},
		[workspaceDefaults]
	);

	const applyComputedChartResult = useCallback(
		(chartId: string, result: Awaited<ReturnType<typeof computeChart>>) => {
			setCharts((prev) =>
				prev.map((chart) =>
					chart.id === chartId
						? { ...chart, computed: normalizeComputedChartPayload(result) }
						: chart
				)
			);
		},
		[]
	);

	const shiftSelectedChartTime = useCallback(
		async (step: TimeStep) => {
			const persistedChart = charts.find((chart) => chart.id === selectedChartId);
			const selectedChart =
				selectedChartPreview && selectedChartPreview.id === selectedChartId
					? selectedChartPreview
					: persistedChart;
			if (!selectedChart) return;
			const baseTime =
				parseChartDateTime(selectedChart.dateTime, chartTimeZone(selectedChart)) ?? new Date();
			const shiftedChart: AppChart = {
				...selectedChart,
				dateTime: formatChartDateTimeUtc(addUtcStep(baseTime, step))
			};
			const result = await computeChartFromData(
				chartDataToComputePayload(shiftedChart, workspaceDefaults)
			);
			setSelectedChartPreview({ ...shiftedChart, computed: normalizeComputedChartPayload(result) });
		},
		[charts, selectedChartId, selectedChartPreview, workspaceDefaults]
	);

	const selectChart = useCallback((id: string | null) => {
		setSelectedChartPreview(null);
		setSelectedChartId(id);
	}, []);
	const resetSelectedChartPreview = useCallback(() => setSelectedChartPreview(null), []);
	const clearTransitOverlay = useCallback(() => setTransitOverlay(null), []);

	const chartsValue = useMemo<WorkspaceChartsValue>(
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
			transitOverlay,
			setSelectedChartId: selectChart,
			setCharts,
			addChart,
			replaceChartsFromWorkspace,
			shiftSelectedChartTime,
			resetSelectedChartPreview,
			setTransitOverlay,
			clearTransitOverlay
		}),
		[
			charts,
			selectedChartId,
			selectedChartPreview,
			transitOverlay,
			selectChart,
			addChart,
			replaceChartsFromWorkspace,
			shiftSelectedChartTime,
			resetSelectedChartPreview,
			clearTransitOverlay
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
			} catch (error) {
				console.error(`Background compute failed for ${chart.id}:`, error);
				toast.error(t('toast_compute_failed'), { description: errorDescription(error) });
			} finally {
				computingChartIdsRef.current.delete(chart.id);
			}
		},
		[applyComputedChartResult, workspaceDefaults, t]
	);

	useEffect(() => {
		if (workspacePath) {
			setBootLoading(false);
			return;
		}
		if (bootstrapComputeAttemptedRef.current) return;
		const bootstrapChart = charts.find((chart) => chart.id === BOOTSTRAP_CHART_ID);
		if (!bootstrapChart) return;
		bootstrapComputeAttemptedRef.current = true;
		void computeChartInBackground(bootstrapChart, null).finally(() => setBootLoading(false));
	}, [charts, computeChartInBackground, workspacePath]);

	const applyDefaultsPatch = useCallback(
		async (patch: Partial<WorkspaceDefaultsState>) => {
			const nextDefaults = mergeWorkspaceDefaultsPatch(workspaceDefaults, patch);
			const nextCharts =
				typeof patch.houseSystem === 'string'
					? charts.map((chart) => ({ ...chart, houseSystem: patch.houseSystem }))
					: charts;
			setWorkspaceDefaults(nextDefaults);
			if (nextCharts !== charts) {
				setSelectedChartPreview(null);
				setCharts(nextCharts);
			}
			if (workspacePath) {
				try {
					const persisted = await saveWorkspaceDefaults(workspacePath, nextDefaults);
					setWorkspaceDefaults((prev) => mergeWorkspaceDefaults(prev, persisted));
				} catch (error) {
					console.error('Failed to persist workspace defaults:', error);
				}
			}
			for (const chart of nextCharts) {
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

	const updateWorkspaceTagsForCharts = useCallback(
		async (taggedCharts: AppChart[], targetWorkspacePath: string | null) => {
			const nextCatalog = mergeWorkspaceTagCatalog(workspaceTags, taggedCharts);
			const catalogByName = new Map(nextCatalog.map((tag) => [tag.name, tag]));
			for (const chart of taggedCharts) {
				for (const name of chart.tags ?? []) {
					const color = chart.tagColors?.[name];
					if (color) catalogByName.set(name, { name, color });
				}
			}
			const updatedCatalog = [...catalogByName.values()];
			setWorkspaceTags(updatedCatalog);
			setCharts((current) => applyWorkspaceTagColors(current, updatedCatalog));
			if (targetWorkspacePath) {
				const saved = await saveWorkspaceTags(targetWorkspacePath, updatedCatalog);
				setWorkspaceTags(saved);
				setCharts((current) => applyWorkspaceTagColors(current, saved));
			}
		},
		[workspaceTags]
	);

	const createChart = useCallback(
		async (chart: AppChart) => {
			if (workspacePath) {
				try {
					await invoke<string>('create_chart', {
						workspacePath,
						chart: chartDataToComputePayload(chart, workspaceDefaults)
					});
					await initStorage(workspacePath);
				} catch (error) {
					console.error(error);
					toast.error(t('toast_save_failed'), { description: errorDescription(error) });
					return false;
				}
			}
			try {
				await updateWorkspaceTagsForCharts([chart], workspacePath);
			} catch (error) {
				console.error('Failed to persist workspace tags:', error);
			}
			addChart(chart);
			void computeChartInBackground(chart, workspacePath);
			return true;
		},
		[
			workspacePath,
			workspaceDefaults,
			updateWorkspaceTagsForCharts,
			addChart,
			computeChartInBackground,
			t
		]
	);

	const createSynastry = useCallback(
		async (chart: AppChart) => {
			if (workspacePath) {
				try {
					await invoke<string>('create_analysis', {
						workspacePath,
						analysis: synastryDataToAnalysisPayload(chart)
					});
					chart.entityPersisted = true;
					await initStorage(workspacePath);
				} catch (error) {
					console.error(error);
					toast.error(t('toast_save_failed'), { description: errorDescription(error) });
					return false;
				}
			}
			addChart(chart);
			return true;
		},
		[workspacePath, addChart, t]
	);

	const setObservableObjects = useCallback(
		async (chartId: string, bodies: string[]) => {
			const chart = charts.find((c) => c.id === chartId);
			if (!chart) return;
			const updated: AppChart = { ...chart, observableObjects: [...bodies] };
			setSelectedChartPreview(null);
			setCharts((prev) => prev.map((c) => (c.id === chartId ? updated : c)));
			if (workspacePath) {
				try {
					await invoke<string>('update_chart', {
						workspacePath,
						chartId,
						chart: chartDataToComputePayload(updated, workspaceDefaults)
					});
				} catch (error) {
					console.error(error);
					setCharts((prev) => prev.map((c) => (c.id === chartId ? chart : c)));
					toast.error(t('toast_save_failed'), { description: errorDescription(error) });
					return;
				}
			}
			void computeChartInBackground(updated, workspacePath);
		},
		[charts, workspacePath, workspaceDefaults, computeChartInBackground, t]
	);

	const saveChart = useCallback(
		async (chart: AppChart) => {
			if (workspacePath) {
				try {
					await invoke<string>('update_chart', {
						workspacePath,
						chartId: chart.id,
						chart: chartDataToComputePayload(chart, workspaceDefaults)
					});
				} catch (error) {
					console.error(error);
					toast.error(t('toast_save_failed'), { description: errorDescription(error) });
					return false;
				}
			}
			try {
				await updateWorkspaceTagsForCharts([chart], workspacePath);
			} catch (error) {
				console.error('Failed to persist workspace tags:', error);
			}
			setCharts((prev) => prev.map((c) => (c.id === chart.id ? { ...c, ...chart } : c)));
			void computeChartInBackground(chart, workspacePath);
			return true;
		},
		[workspacePath, workspaceDefaults, updateWorkspaceTagsForCharts, computeChartInBackground, t]
	);

	const openWorkspace = useCallback(async () => {
		try {
			const folder = await openFolderDialog();
			if (!folder) return false;
			const {
				path,
				charts: loaded,
				tagCatalog
			} = await openWorkspaceFolder(
				folder,
				(dto) => setWorkspaceDefaults((current) => mergeWorkspaceDefaults(current, dto)),
				(report) => {
					setWorkspaceDefaults((current) => mergeModelReportDefaults(current, report));
					if (report.warnings.length > 0) {
						toast.message(t('toast_model_report_warnings'), {
							description: report.warnings.join(', ')
						});
					}
				}
			);
			const mergedTagCatalog = mergeWorkspaceTagCatalog(tagCatalog, loaded);
			setWorkspaceTags(mergedTagCatalog);
			setWorkspacePath(path);
			replaceChartsFromWorkspace(applyWorkspaceTagColors(loaded, mergedTagCatalog));
			toast.success(t('toast_workspace_loaded'), { description: path });
			return true;
		} catch (error) {
			console.error(error);
			toast.error(t('toast_workspace_open_error'), { description: errorDescription(error) });
			return false;
		}
	}, [replaceChartsFromWorkspace, t]);

	const saveWorkspace = useCallback(async () => {
		try {
			if (charts.length === 0) {
				toast.message(t('toast_nothing_to_save'), { description: t('toast_nothing_to_save_hint') });
				return;
			}
			let path = workspacePath;
			if (!path) {
				path = await openFolderDialog();
				if (!path) return;
			}
			const payloads = charts
				.filter((chart) => chart.entityKind !== 'analysis')
				.map((chart) => chartDataToComputePayload(chart, workspaceDefaults));
			await saveWorkspaceFiles(path, 'User', payloads, workspaceDefaults);
			const savedTagCatalog = await saveWorkspaceTags(
				path,
				mergeWorkspaceTagCatalog(workspaceTags, charts)
			);
			setWorkspaceTags(savedTagCatalog);
			const pendingAnalyses = charts.filter(
				(chart) => chart.entityKind === 'analysis' && !chart.entityPersisted
			);
			for (const analysis of pendingAnalyses) {
				await invoke<string>('create_analysis', {
					workspacePath: path,
					analysis: synastryDataToAnalysisPayload(analysis)
				});
			}
			if (pendingAnalyses.length > 0) {
				const persistedIds = new Set(pendingAnalyses.map((analysis) => analysis.id));
				setCharts((current) =>
					current.map((entry) =>
						persistedIds.has(entry.id) ? { ...entry, entityPersisted: true } : entry
					)
				);
			}
			await initStorage(path);
			setWorkspacePath(path);
			toast.success(t('toast_workspace_saved'), { description: path });
		} catch (error) {
			console.error(error);
			toast.error(t('toast_save_failed'), { description: errorDescription(error) });
		}
	}, [charts, workspacePath, workspaceDefaults, workspaceTags, t]);

	const value = useMemo<WorkspaceValue>(
		() => ({
			workspacePath,
			workspaceDefaults,
			workspaceTags,
			bootLoading,
			openWorkspace,
			saveWorkspace,
			createChart,
			createSynastry,
			saveChart,
			setObservableObjects,
			applyDefaultsPatch
		}),
		[
			workspacePath,
			workspaceDefaults,
			workspaceTags,
			bootLoading,
			openWorkspace,
			saveWorkspace,
			createChart,
			createSynastry,
			saveChart,
			setObservableObjects,
			applyDefaultsPatch
		]
	);

	return (
		<WorkspaceContext.Provider value={value}>
			<WorkspaceChartsProvider value={chartsValue}>{children}</WorkspaceChartsProvider>
		</WorkspaceContext.Provider>
	);
}

export function useWorkspace(): WorkspaceValue {
	const value = useContext(WorkspaceContext);
	if (!value) throw new Error('useWorkspace must be used within WorkspaceProvider');
	return value;
}
