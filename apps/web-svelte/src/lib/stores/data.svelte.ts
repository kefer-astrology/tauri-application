// Data Store - Svelte 5 runes-based
// This file must be Svelte-compiled (.svelte.ts) to use runes

import { layout } from '$lib/state/layout';
import { isTauriRuntime } from '$lib/tauri/runtime';
import {
    computeWorkspaceAspects,
    queryWorkspacePositions,
    queryWorkspaceRadixRelative
} from '$lib/tauri/workspace';
import type { Aspect, Position, RadixRelativePosition } from '$lib/tauri/types';
import { effectiveTime } from '$lib/stores/timeNavigation.svelte';
import { ASPECT_ROWS } from '$lib/astrology/aspects';

export type { Aspect, Position, RadixRelativePosition };

/**
 * Convert in-memory computed positions (object_id -> longitude or position data) to Position[].
 */
function positionsFromComputed(
    chartId: string,
    datetime: string,
    positionsRecord: Record<string, number | Record<string, unknown>>
): Position[] {
    const positions: Position[] = [];
    for (const [object_id, value] of Object.entries(positionsRecord)) {
        const longitude = typeof value === 'number' ? value : Number((value as Record<string, unknown>).longitude ?? 0);
        positions.push({
            chart_id: chartId,
            datetime,
            object_id,
            longitude,
            latitude: undefined,
            is_radix: true,
        });
    }
    return positions;
}

/**
 * Query positions for a chart and time range.
 * When no workspace is open, returns in-memory positions from chart.computed if available.
 * 
 * @param chartId - Chart ID to query
 * @param startDatetime - Optional start datetime (ISO string)
 * @param endDatetime - Optional end datetime (ISO string)
 * @param useParquet - Whether to use Parquet files for large queries
 * @returns Array of Position objects
 */
export async function queryPositions(
    chartId: string,
    startDatetime?: string,
    endDatetime?: string,
    useParquet: boolean = false
): Promise<Position[]> {
    if (!chartId || chartId.trim() === '') {
        throw new Error('Chart ID is required');
    }

    const workspacePath = layout.workspacePath;
    const chart = layout.contexts.find((c) => c.id === chartId);
    const computed = chart?.computed?.positions;
    if (!workspacePath) {
        // In-memory mode: use chart.computed.positions if available
        if (!computed || Object.keys(computed).length === 0) {
            return [];
        }
        const datetime = chart?.dateTime
            ? (chart.dateTime.includes('T') ? chart.dateTime : chart.dateTime.replace(' ', 'T') + 'Z')
            : new Date().toISOString();
        return positionsFromComputed(chartId, datetime, computed as Record<string, number | Record<string, unknown>>);
    }

    if (!isTauriRuntime()) {
        if (!computed || Object.keys(computed).length === 0) {
            return [];
        }
        const datetime = chart?.dateTime
            ? (chart.dateTime.includes('T') ? chart.dateTime : chart.dateTime.replace(' ', 'T') + 'Z')
            : new Date().toISOString();
        return positionsFromComputed(chartId, datetime, computed as Record<string, number | Record<string, unknown>>);
    }

    try {
        const positions = await queryWorkspacePositions({
            workspacePath,
            chartId,
            startDatetime,
            endDatetime,
            useParquet,
        });

        if (positions.length === 0) {
            // Workspace mode fallback: for radix charts we can still render immediate
            // in-memory computation even when nothing is persisted in DuckDB yet.
            if (computed && Object.keys(computed).length > 0) {
                const datetime = chart?.dateTime
                    ? (chart.dateTime.includes('T') ? chart.dateTime : chart.dateTime.replace(' ', 'T') + 'Z')
                    : new Date().toISOString();
                return positionsFromComputed(chartId, datetime, computed as Record<string, number | Record<string, unknown>>);
            }
        }

        return positions;
    } catch (error) {
        console.error('Failed to query positions:', {
            error,
            chartId,
            workspacePath,
            startDatetime,
            endDatetime,
            useParquet
        });
        const errorMessage = error instanceof Error 
            ? error.message 
            : typeof error === 'string'
            ? error
            : 'Unknown error occurred';
        throw new Error(`Failed to query positions for chart ${chartId}: ${errorMessage}`);
    }
}

/**
 * Compute aspects on-demand from positions
 * 
 * @param chartId - Chart ID to compute aspects for
 * @param datetime - Datetime to compute aspects at (ISO string)
 * @param aspectTypes - Array of aspect types to include (default: major aspects)
 * @param maxOrb - Maximum orb in degrees (default: 10.0)
 * @returns Array of Aspect objects
 */
export async function computeAspects(
    chartId: string,
    datetime: string,
    aspectTypes: string[] = ASPECT_ROWS.map((aspect) => aspect.id),
    maxOrb: number = 10.0
): Promise<Aspect[]> {
    if (!layout.workspacePath) {
        return [];
    }
    if (!isTauriRuntime()) {
        return [];
    }
    const workspacePath = layout.workspacePath;

    try {
        return await computeWorkspaceAspects({
            workspacePath,
            chartId,
            datetime,
            aspectTypes,
            maxOrb,
        });
    } catch (error) {
        console.error('Failed to compute aspects:', error);
        throw error;
    }
}

/**
 * Query radix-relative positions (transits vs base chart)
 * 
 * @param transitChartId - Transit chart ID
 * @param radixChartId - Radix (base) chart ID
 * @param startDatetime - Optional start datetime (ISO string)
 * @param endDatetime - Optional end datetime (ISO string)
 * @returns Array of RadixRelativePosition objects
 */
export async function queryRadixRelative(
    transitChartId: string,
    radixChartId: string,
    startDatetime?: string,
    endDatetime?: string
): Promise<RadixRelativePosition[]> {
    if (!layout.workspacePath) {
        return [];
    }
    if (!isTauriRuntime()) {
        return [];
    }
    const workspacePath = layout.workspacePath;

    try {
        return await queryWorkspaceRadixRelative({
            workspacePath,
            transitChartId,
            radixChartId,
            startDatetime,
            endDatetime,
        });
    } catch (error) {
        console.error('Failed to query radix-relative positions:', error);
        throw error;
    }
}

/**
 * Cache for recent position queries
 */
const positionCache = new Map<string, { data: Position[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Query positions with caching
 * 
 * @param chartId - Chart ID to query
 * @param datetime - Specific datetime to query (ISO string)
 * @returns Array of Position objects
 */
export async function queryPositionsCached(
    chartId: string,
    datetime: string
): Promise<Position[]> {
    const cacheKey = `${chartId}_${datetime}`;
    const cached = positionCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }
    
    const positions = await queryPositions(chartId, datetime, datetime);
    
    positionCache.set(cacheKey, {
        data: positions,
        timestamp: Date.now(),
    });
    
    return positions;
}

/**
 * Clear the position cache
 */
export function clearPositionCache() {
    positionCache.clear();
}

/**
 * Get positions for current effective time
 * 
 * @param chartId - Chart ID to query
 * @returns Array of Position objects for current time
 */
export async function getCurrentPositions(chartId: string): Promise<Position[]> {
    try {
        const time = effectiveTime();
        const timeStr = time.toISOString();
        return await queryPositionsCached(chartId, timeStr);
    } catch (error) {
        console.error('getCurrentPositions error:', error);
        throw error;
    }
}

/**
 * Get time series positions (uses Parquet for large ranges)
 * 
 * @param chartId - Chart ID to query
 * @param start - Start date
 * @param end - End date
 * @returns Array of Position objects
 */
export async function loadTimeSeries(
    chartId: string,
    start: Date,
    end: Date
): Promise<Position[]> {
    // Use Parquet for large time ranges (>1 day)
    const days = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    const useParquet = days > 1;
    
    return queryPositions(
        chartId,
        start.toISOString(),
        end.toISOString(),
        useParquet
    );
}
