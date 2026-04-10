// Data Store - Svelte 5 runes-based
// This file must be Svelte-compiled (.svelte.ts) to use runes

import { invoke } from '@tauri-apps/api/core';
import { layout } from '$lib/state/layout';

/**
 * Position data structure matching DuckDB schema
 * All positions are relative to vernal equinox (longitude 0° = spring solstice)
 */
export interface Position {
    chart_id: string;
    datetime: string;
    object_id: string;
    
    // Ecliptic coordinates (always available)
    longitude: number;
    latitude?: number;
    
    // Equatorial coordinates (JPL - always computed)
    declination?: number;
    right_ascension?: number;
    distance?: number;
    
    // Topocentric coordinates (JPL with location)
    altitude?: number;
    azimuth?: number;
    
    // Physical properties (JPL optional)
    apparent_magnitude?: number;
    phase_angle?: number;
    elongation?: number;
    light_time?: number;
    
    // Motion properties
    speed?: number;
    retrograde?: boolean;
    
    // Engine metadata
    engine?: string;
    ephemeris_file?: string;
    
    // Radix/relation tracking
    radix_chart_id?: string;  // NULL for radix, chart_id for transits
    is_radix: boolean;        // TRUE for base charts, FALSE for transits
    
    // Flags for which columns are populated
    has_equatorial?: boolean;
    has_topocentric?: boolean;
    has_physical?: boolean;
}

/**
 * Aspect data structure
 */
export interface Aspect {
    from_object: string;
    to_object: string;
    aspect_type: string;
    angle: number;
    orb: number;
    exact_datetime?: string;
}

/**
 * Radix-relative position data (transits vs base chart)
 */
export interface RadixRelativePosition {
    datetime: string;
    object_id: string;
    transit_longitude: number;
    radix_longitude: number;
    longitude_diff: number;
    transit_declination?: number;
    radix_declination?: number;
    declination_diff?: number;
    transit_distance?: number;
    radix_distance?: number;
    distance_diff?: number;
}

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
    if (!workspacePath) {
        // In-memory mode: use chart.computed.positions if available
        const chart = layout.contexts.find((c) => c.id === chartId);
        const computed = chart?.computed?.positions;
        if (!computed || Object.keys(computed).length === 0) {
            return [];
        }
        const datetime = chart?.dateTime
            ? (chart.dateTime.includes('T') ? chart.dateTime : chart.dateTime.replace(' ', 'T') + 'Z')
            : new Date().toISOString();
        return positionsFromComputed(chartId, datetime, computed as Record<string, number | Record<string, unknown>>);
    }

    try {
        // Convert undefined/empty strings to null for Rust Option<String>
        // Tauri expects null (not undefined) for Option<String> parameters
        const startDt = (startDatetime && startDatetime.trim() !== '') ? startDatetime : null;
        const endDt = (endDatetime && endDatetime.trim() !== '') ? endDatetime : null;
        
        console.log('Calling query_positions with:', {
            workspacePath: workspacePath,
            chartId: chartId,
            startDatetime: startDt,
            endDatetime: endDt,
            useParquet: useParquet,
        });
        
        const positions = await invoke<Array<{
            datetime: string;
            object_id: string;
            data: {
                longitude: number;
                latitude?: number;
                declination?: number;
                right_ascension?: number;
                distance?: number;
                altitude?: number;
                azimuth?: number;
                apparent_magnitude?: number;
                phase_angle?: number;
                elongation?: number;
                light_time?: number;
                speed?: number;
                retrograde?: boolean;
            };
            radix_chart_id?: string;
            is_radix: boolean;
        }>>('query_positions', {
            workspacePath: workspacePath,
            chartId: chartId,
            startDatetime: startDt,
            endDatetime: endDt,
            useParquet: useParquet,
        });

        if (positions.length === 0) {
            // Workspace mode fallback: for radix charts we can still render immediate
            // in-memory computation even when nothing is persisted in DuckDB yet.
            const chart = layout.contexts.find((c) => c.id === chartId);
            const computed = chart?.computed?.positions;
            if (computed && Object.keys(computed).length > 0) {
                const datetime = chart?.dateTime
                    ? (chart.dateTime.includes('T') ? chart.dateTime : chart.dateTime.replace(' ', 'T') + 'Z')
                    : new Date().toISOString();
                return positionsFromComputed(chartId, datetime, computed as Record<string, number | Record<string, unknown>>);
            }
        }

        // Transform to Position interface
        return positions.map(pos => ({
            chart_id: chartId,
            datetime: pos.datetime,
            object_id: pos.object_id,
            longitude: pos.data.longitude,
            latitude: pos.data.latitude,
            declination: pos.data.declination,
            right_ascension: pos.data.right_ascension,
            distance: pos.data.distance,
            altitude: pos.data.altitude,
            azimuth: pos.data.azimuth,
            apparent_magnitude: pos.data.apparent_magnitude,
            phase_angle: pos.data.phase_angle,
            elongation: pos.data.elongation,
            light_time: pos.data.light_time,
            speed: pos.data.speed,
            retrograde: pos.data.retrograde,
            radix_chart_id: pos.radix_chart_id,
            is_radix: pos.is_radix,
        }));
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
    aspectTypes: string[] = ['conjunction', 'sextile', 'square', 'trine', 'opposition'],
    maxOrb: number = 10.0
): Promise<Aspect[]> {
    if (!layout.workspacePath) {
        return [];
    }
    const workspacePath = layout.workspacePath;

    try {
        const aspects = await invoke<Array<{
            relation_id: string;
            datetime: string;
            source_object: string;
            target_object: string;
            aspect_type: string;
            angle: number;
            orb: number;
            exact_datetime?: string;
        }>>('compute_aspects', {
            workspacePath: workspacePath,
            chartId: chartId,
            datetime: datetime,
            aspectTypes: aspectTypes,
            maxOrb: maxOrb,
        });

        // Transform to Aspect interface
        return aspects.map(aspect => ({
            from_object: aspect.source_object,
            to_object: aspect.target_object,
            aspect_type: aspect.aspect_type,
            angle: aspect.angle,
            orb: aspect.orb,
            exact_datetime: aspect.exact_datetime,
        }));
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
    const workspacePath = layout.workspacePath;

    try {
        const relative = await invoke<Array<{
            datetime: string;
            object_id: string;
            transit_longitude: number;
            radix_longitude: number;
            longitude_diff: number;
            transit_declination?: number;
            radix_declination?: number;
            declination_diff?: number;
            transit_distance?: number;
            radix_distance?: number;
            distance_diff?: number;
        }>>('query_radix_relative', {
            workspacePath: workspacePath,
            transitChartId: transitChartId,
            radixChartId: radixChartId,
            startDatetime: startDatetime ?? null,
            endDatetime: endDatetime ?? null,
        });

        // Transform to RadixRelativePosition interface
        return relative.map(pos => ({
            datetime: pos.datetime,
            object_id: pos.object_id,
            transit_longitude: pos.transit_longitude,
            radix_longitude: pos.radix_longitude,
            longitude_diff: pos.longitude_diff,
            transit_declination: pos.transit_declination,
            radix_declination: pos.radix_declination,
            declination_diff: pos.declination_diff,
            transit_distance: pos.transit_distance,
            radix_distance: pos.radix_distance,
            distance_diff: pos.distance_diff,
        }));
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
        // Import effectiveTime dynamically to avoid circular dependency
        const { effectiveTime } = await import('$lib/stores/timeNavigation.svelte');
        const time = effectiveTime();
        const timeStr = time.toISOString();
        console.log('Querying positions for chart:', chartId, 'at time:', timeStr);
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
