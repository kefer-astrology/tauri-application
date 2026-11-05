import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useWorkspaceCharts } from '@/app/providers/workspace-charts';
import type {
	HoroscopeWheelAspectInteraction,
	HoroscopeWheelObjectInteraction
} from '@/app/views/domain/horoscope-wheel/horoscope-wheel';
import { normalizePointId } from '@/lib/astrology/aspectParsing';
import { chartViewData, formatCoordinates, type ChartViewData } from '@/lib/astrology/chartView';
import type { TransitOverlay } from '@/lib/astrology/transits';
import { chartTimeZone, formatChartLocal } from '@/lib/chartDateTime';
import type { AppChart, WorkspaceDefaultsState } from '@/lib/tauri/chartPayload';

/** How the Horoskop module was mounted: workspace settings and what the shell handles. */
export interface HoroskopOptions {
	workspaceDefaults: WorkspaceDefaultsState;
	enabledSymbolSetIds: readonly string[];
	onEdit?: (chart: AppChart) => void;
	onObservableObjectsChange?: (chartId: string, bodies: string[]) => void;
}

/** Chart identity lines, in the chart's local time at its place, with demo text without one. */
export interface ChartLabels {
	name: string;
	type: string;
	date: string;
	time: string;
	location: string;
	coordinates: string;
	houseSystem: string;
	/** The overlay's moment, in the same zone. */
	transitMoment: string;
}

export interface HoroskopValue extends HoroskopOptions {
	chart: AppChart | null;
	data: ChartViewData;
	labels: ChartLabels;
	/** The transit overlay when it belongs to this chart. */
	transitOverlay: TransitOverlay | null;
	clearTransitOverlay: () => void;
	selectedObject: HoroscopeWheelObjectInteraction | null;
	selectedAspect: HoroscopeWheelAspectInteraction | null;
	/** Which detail is open in the right panel. */
	detailKind: 'object' | 'aspect' | null;
	/** First click selects (highlights), a second click on the same object opens its details. */
	selectObject: (interaction: HoroscopeWheelObjectInteraction) => void;
	selectAspect: (interaction: HoroscopeWheelAspectInteraction) => void;
	clearSelection: () => void;
	closeDetail: () => void;
	/** Aspects touching the selected radix body. */
	highlightAspectIndices: ReadonlySet<number>;
	/** The two bodies of the selected aspect. */
	highlightBodies: ReadonlySet<string>;
}

const HoroskopContext = createContext<HoroskopValue | null>(null);

export function useHoroskop(): HoroskopValue {
	const value = useContext(HoroskopContext);
	if (!value) throw new Error('useHoroskop must be used within HoroskopProvider');
	return value;
}

function useChartLabels(chart: AppChart | null, overlay: TransitOverlay | null): ChartLabels {
	const { t } = useTranslation();
	const zone = chart ? chartTimeZone(chart) : undefined;
	return {
		name: chart?.name ?? t('demo_chart_name'),
		type:
			chart?.chartType === 'EVENT'
				? t('new_type_event')
				: chart?.chartType === 'HORARY'
					? t('new_type_horary')
					: t('new_type_radix'),
		date:
			formatChartLocal(chart?.dateTime, zone, {
				day: 'numeric',
				month: 'short',
				year: 'numeric'
			}) ??
			chart?.dateTime?.split(' ')[0] ??
			t('demo_chart_date_line'),
		time:
			formatChartLocal(chart?.dateTime, zone, {
				hour: '2-digit',
				minute: '2-digit',
				second: '2-digit'
			}) ??
			chart?.dateTime?.split(' ').slice(1).join(' ') ??
			t('demo_chart_time_line'),
		location: chart?.location || t('demo_chart_location'),
		coordinates: formatCoordinates(chart?.latitude, chart?.longitude) ?? t('demo_chart_coords'),
		houseSystem:
			[chart?.zodiacType, chart?.houseSystem].filter(Boolean).join(' / ') ||
			t('demo_chart_house_system'),
		transitMoment:
			formatChartLocal(overlay?.dateTime, zone, {
				day: 'numeric',
				month: 'short',
				year: 'numeric',
				hour: '2-digit',
				minute: '2-digit'
			}) ??
			overlay?.dateTime ??
			''
	};
}

/** The selected chart for the Horoskop widgets, and the selection the wheel and the positions
 *  share. */
export function HoroskopProvider({
	children,
	...options
}: HoroskopOptions & { children: ReactNode }) {
	const { selectedChart, transitOverlay, clearTransitOverlay } = useWorkspaceCharts();
	const chart = selectedChart ?? null;
	const overlay =
		transitOverlay && transitOverlay.sourceChartId === chart?.id ? transitOverlay : null;
	const data = useMemo(
		() => chartViewData(chart, options.workspaceDefaults.defaultBodies, overlay),
		[chart, options.workspaceDefaults.defaultBodies, overlay]
	);
	const labels = useChartLabels(chart, overlay);

	const [selectedObject, setSelectedObject] = useState<HoroscopeWheelObjectInteraction | null>(
		null
	);
	const [selectedAspect, setSelectedAspect] = useState<HoroscopeWheelAspectInteraction | null>(
		null
	);
	const [detailKind, setDetailKind] = useState<'object' | 'aspect' | null>(null);

	useEffect(() => {
		setSelectedObject(null);
		setSelectedAspect(null);
		setDetailKind(null);
	}, [chart?.id]);

	const highlightAspectIndices = useMemo(() => {
		const indices = new Set<number>();
		if (selectedObject?.layer !== 'radix') return indices;
		const bodyId = normalizePointId(selectedObject.bodyId);
		data.radixAspects.forEach((aspect, index) => {
			if (normalizePointId(aspect.from) === bodyId || normalizePointId(aspect.to) === bodyId) {
				indices.add(index);
			}
		});
		return indices;
	}, [selectedObject, data.radixAspects]);

	const highlightBodies = useMemo(
		() =>
			selectedAspect
				? new Set([selectedAspect.aspect.from, selectedAspect.aspect.to])
				: new Set<string>(),
		[selectedAspect]
	);

	const value: HoroskopValue = {
		...options,
		chart,
		data,
		labels,
		transitOverlay: overlay,
		clearTransitOverlay,
		selectedObject,
		selectedAspect,
		detailKind,
		selectObject: (interaction) => {
			const again =
				selectedObject?.bodyId === interaction.bodyId && selectedObject.layer === interaction.layer;
			setSelectedObject(interaction);
			setSelectedAspect(null);
			setDetailKind(again ? 'object' : null);
		},
		selectAspect: (interaction) => {
			const again = selectedAspect?.index === interaction.index;
			setSelectedAspect(interaction);
			setSelectedObject(null);
			setDetailKind(again ? 'aspect' : null);
		},
		clearSelection: () => {
			setSelectedObject(null);
			setSelectedAspect(null);
			setDetailKind(null);
		},
		closeDetail: () => setDetailKind(null),
		highlightAspectIndices,
		highlightBodies
	};

	return <HoroskopContext.Provider value={value}>{children}</HoroskopContext.Provider>;
}
