import {
	computeChartFromData,
	computeCrossAspectsFromData,
	computeTransitSeries,
	computeTransitSeriesFromData
} from '@/lib/tauri/workspace';
import {
	chartDataToComputePayload,
	normalizeComputedChartPayload,
	type AppChart,
	type WorkspaceDefaultsState
} from '@/lib/tauri/chartPayload';
import type { TransitSeriesEntry, TransitSeriesResult } from '@/lib/tauri/types';
import type { TransitOverlay } from '@/lib/astrology/transits';
import { positionsForIds } from '@/lib/astrology/transitResults';
import {
	configurationRequestsToDto,
	getDefaultBodyIds,
	stepToSeconds,
	type TransitSetupState
} from '@/lib/astrology/transitSetup';

interface TransitRequest {
	setup: TransitSetupState;
	sourceChart: AppChart;
	workspaceDefaults: WorkspaceDefaultsState;
	range: { startDatetime: string; endDatetime: string };
}

/** Transited bodies of a request: the selection, else the source chart's objects. */
function transitedBodiesFor({ setup, sourceChart, workspaceDefaults }: TransitRequest): string[] {
	return setup.transitedBodies.length > 0
		? setup.transitedBodies
		: (sourceChart.observableObjects ?? workspaceDefaults.defaultBodies);
}

/**
 * The transit chart at the end of the range and its aspects to the natal chart: the overlay the
 * horoscope views draw, and a one-entry series used when the sampled series is unavailable.
 */
export async function computeTransitSnapshot(
	request: TransitRequest & {
		/** The source chart's computed positions. */
		radix: NonNullable<AppChart['computed']>;
		/** Name of the transit chart (`<chart> Transit`). */
		transitChartName: string;
	}
): Promise<{ overlay: TransitOverlay; snapshot: TransitSeriesEntry }> {
	const { setup, sourceChart, workspaceDefaults, range, radix } = request;
	const dateTime = range.endDatetime;
	const transitChart: AppChart = {
		...sourceChart,
		id: `${sourceChart.id}__transit__${dateTime.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
		name: request.transitChartName,
		chartType: 'EVENT',
		dateTime,
		observableObjects:
			setup.transitingBodies.length > 0 ? setup.transitingBodies : getDefaultBodyIds(),
		tags: [...(sourceChart.tags ?? []), 'transit']
	};
	const computed = normalizeComputedChartPayload(
		await computeChartFromData(chartDataToComputePayload(transitChart, workspaceDefaults))
	);
	const transitedBodies = transitedBodiesFor(request);
	const aspects = await computeCrossAspectsFromData(
		chartDataToComputePayload(sourceChart, workspaceDefaults),
		positionsForIds(computed.positions ?? {}, setup.transitingBodies),
		positionsForIds(radix.positions ?? {}, transitedBodies),
		setup.selectedAspects
	);
	return {
		overlay: {
			sourceChartId: sourceChart.id,
			sourceChartName: sourceChart.name,
			dateTime,
			transitChart: { ...transitChart, computed },
			transitingBodies: setup.transitingBodies,
			transitedBodies,
			aspectTypes: setup.selectedAspects,
			aspects
		},
		snapshot: { datetime: dateTime, transit_positions: computed.positions, aspects }
	};
}

/** The sampled series and event searches over the range: from the workspace when one is open
 *  (the saved setup and chart), else from the in-memory chart. */
export function requestTransitSeries(
	request: TransitRequest & { workspacePath: string | null }
): Promise<TransitSeriesResult> {
	const { setup, sourceChart, workspaceDefaults, range, workspacePath } = request;
	const common = {
		startDatetime: range.startDatetime,
		endDatetime: range.endDatetime,
		timeStepSeconds: stepToSeconds(setup.timeStepValue, setup.timeStepUnit),
		transitingObjects: setup.transitingBodies,
		transitedObjects: transitedBodiesFor(request),
		aspectTypes: setup.selectedAspects,
		exactHits: setup.exactHits,
		stationEvents: setup.stationEvents,
		configurationRequests: configurationRequestsToDto(setup.configurationSearches),
		sampledSeries: setup.sampledGraphOutput
	};
	return workspacePath
		? computeTransitSeries({ workspacePath, chartId: sourceChart.id, ...common })
		: computeTransitSeriesFromData({
				chartJson: chartDataToComputePayload(sourceChart, workspaceDefaults),
				...common
			});
}
