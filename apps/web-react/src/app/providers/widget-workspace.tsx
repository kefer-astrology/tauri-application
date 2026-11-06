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
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useWorkspace } from '@/app/providers/workspace';
import {
	addGridInstance,
	addHoroskopInstance,
	BUILT_IN_PRESETS,
	defaultPresetForSchool,
	presetsForSchool,
	removeInstance,
	restoreInstance
} from '@/lib/widgets/profiles';
import type {
	GridModule,
	HoroskopRegion,
	WidgetPresetId,
	WidgetSize,
	WorkspaceProfile
} from '@/lib/widgets/types';

export interface WidgetWorkspaceValue {
	/** The workspace school's profiles, and the one in use. */
	presets: WorkspaceProfile[];
	activePreset: WidgetPresetId;
	setActivePreset: (preset: WidgetPresetId) => void;
	/** The profile in use, with this session's changes. */
	profile: WorkspaceProfile;
	/** Remove a widget instance (never chart data); a toast offers Undo. */
	removeWidget: (instanceId: string, name: string) => void;
	/** Add an instance at the end of a Horoskop region; returns its id. */
	addHoroskopWidget: (
		widgetId: string,
		region: HoroskopRegion,
		settings?: Record<string, unknown>
	) => string;
	/** Add an instance below everything on a grid module; returns its id. */
	addGridWidget: (
		module: GridModule,
		widgetId: string,
		size: WidgetSize,
		settings?: Record<string, unknown>
	) => string;
	/** The instance briefly emphasized after adding or finding it. */
	highlightedInstanceId: string | null;
	highlight: (instanceId: string) => void;
}

const WidgetWorkspaceContext = createContext<WidgetWorkspaceValue | null>(null);

export function useWidgetWorkspace(): WidgetWorkspaceValue {
	const value = useContext(WidgetWorkspaceContext);
	if (!value) throw new Error('useWidgetWorkspace must be used within WidgetWorkspaceProvider');
	return value;
}

const HIGHLIGHT_MS = 1600;

/**
 * The widget profiles of the open workspace: the school's built-in profiles, which one is in
 * use, and the changes made to them. Changes last for the session; saving them into the
 * workspace file is a later step.
 */
export function WidgetWorkspaceProvider({ children }: { children: ReactNode }) {
	const { t } = useTranslation();
	const { workspacePath, workspaceDefaults } = useWorkspace();
	const school = workspaceDefaults.astrologyTradition;
	const presets = useMemo(() => presetsForSchool(school), [school]);
	const [chosen, setChosen] = useState<WidgetPresetId | null>(null);
	const [edited, setEdited] = useState<Partial<Record<WidgetPresetId, WorkspaceProfile>>>({});
	const [highlightedInstanceId, setHighlighted] = useState<string | null>(null);
	const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Another workspace starts from its own school's profiles, unchanged.
	useEffect(() => {
		setChosen(null);
		setEdited({});
	}, [workspacePath]);

	const activePreset =
		chosen && presets.some((p) => p.preset === chosen) ? chosen : defaultPresetForSchool(school);
	const profile = edited[activePreset] ?? BUILT_IN_PRESETS[activePreset];

	const update = useCallback(
		(change: (current: WorkspaceProfile) => WorkspaceProfile) =>
			setEdited((prev) => ({
				...prev,
				[activePreset]: change(prev[activePreset] ?? BUILT_IN_PRESETS[activePreset])
			})),
		[activePreset]
	);

	const highlight = useCallback((instanceId: string) => {
		setHighlighted(instanceId);
		if (highlightTimer.current) clearTimeout(highlightTimer.current);
		highlightTimer.current = setTimeout(() => setHighlighted(null), HIGHLIGHT_MS);
	}, []);

	useEffect(
		() => () => {
			if (highlightTimer.current) clearTimeout(highlightTimer.current);
		},
		[]
	);

	const removeWidget = useCallback(
		(instanceId: string, name: string) => {
			const { removed } = removeInstance(profile, instanceId);
			if (!removed) return;
			update((current) => removeInstance(current, instanceId).profile);
			toast(t('widget_removed', { name, defaultValue: '{{name}} removed from the workspace' }), {
				action: {
					label: t('undo', { defaultValue: 'Undo' }),
					onClick: () => update((current) => restoreInstance(current, removed))
				}
			});
		},
		[profile, update, t]
	);

	const addHoroskopWidget = useCallback(
		(widgetId: string, region: HoroskopRegion, settings?: Record<string, unknown>) => {
			const { instanceId } = addHoroskopInstance(profile, widgetId, region, settings);
			update((current) => addHoroskopInstance(current, widgetId, region, settings).profile);
			highlight(instanceId);
			return instanceId;
		},
		[profile, update, highlight]
	);

	const addGridWidget = useCallback(
		(
			module: GridModule,
			widgetId: string,
			size: WidgetSize,
			settings?: Record<string, unknown>
		) => {
			const { instanceId } = addGridInstance(profile, module, widgetId, size, settings);
			update((current) => addGridInstance(current, module, widgetId, size, settings).profile);
			highlight(instanceId);
			return instanceId;
		},
		[profile, update, highlight]
	);

	const value: WidgetWorkspaceValue = {
		presets,
		activePreset,
		setActivePreset: setChosen,
		profile,
		removeWidget,
		addHoroskopWidget,
		addGridWidget,
		highlightedInstanceId,
		highlight
	};

	return (
		<WidgetWorkspaceContext.Provider value={value}>{children}</WidgetWorkspaceContext.Provider>
	);
}
