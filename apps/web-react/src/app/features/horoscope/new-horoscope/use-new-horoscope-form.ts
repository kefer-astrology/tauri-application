import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { tagDefaultColor } from '@/lib/chartTags';
import {
	formatCoordinateMagnitude,
	formUtcOffset,
	initialNewHoroscopeState,
	signedCoordinate,
	withResolvedLocation,
	withTagRenamed,
	withTags,
	withTimeSystem,
	withTimeZoneRegion,
	type NewHoroscopeFormState
} from '@/lib/newHoroscopeForm';
import {
	appChartFromNewHoroscopeInput,
	type AppChart,
	type NewHoroscopeTimeSystem,
	type WorkspaceDefaultsState
} from '@/lib/tauri/chartPayload';
import type { ResolvedLocation, WorkspaceTagDefinition } from '@/lib/tauri/types';
import { resolveLocation, resolveTimezone } from '@/lib/tauri/workspace';
import { timeZoneRegion } from '@/lib/time/zoneCatalog';

export interface NewHoroscopeFormOptions {
	workspaceDefaults: WorkspaceDefaultsState;
	workspaceTags: WorkspaceTagDefinition[];
	existingChartIds: ReadonlySet<string>;
	/** The chart being edited; omitted when creating one. */
	initialValues?: AppChart;
	onCreated?: (chart: AppChart) => void | Promise<void>;
	onSaved?: (chart: AppChart) => void | Promise<void>;
}

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** State and actions of the New horoscope form; sections read and change it through this. */
export function useNewHoroscopeForm({
	workspaceDefaults,
	workspaceTags,
	existingChartIds,
	initialValues,
	onCreated,
	onSaved
}: NewHoroscopeFormOptions) {
	const { t } = useTranslation();
	const [state, setState] = useState<NewHoroscopeFormState>(() =>
		initialNewHoroscopeState({
			chart: initialValues,
			defaults: workspaceDefaults,
			workspaceTags
		})
	);
	const [isResolvingLocation, setIsResolvingLocation] = useState(false);

	const update = useCallback(
		(patch: Partial<NewHoroscopeFormState>) => setState((prev) => ({ ...prev, ...patch })),
		[]
	);

	const setTags = (tags: string[]) =>
		setState((prev) => ({ ...prev, ...withTags(prev, tags, workspaceTags) }));

	const renameTag = (tag: string, nextName: string) =>
		setState((prev) => ({ ...prev, ...withTagRenamed(prev, tag, nextName) }));

	const setTagColor = (tag: string, color: string) =>
		setState((prev) => ({ ...prev, tagColors: { ...prev.tagColors, [tag]: color } }));

	const setTimeZoneRegion = (region: string) =>
		setState((prev) => ({ ...prev, ...withTimeZoneRegion(prev, region) }));

	/** Typed location text; its coordinates must be resolved again. */
	const setLocationText = (location: string) => update({ location, resolvedLocation: '' });

	const setTimeSystem = (next: NewHoroscopeTimeSystem) => {
		try {
			update(withTimeSystem(state, next));
		} catch (error) {
			toast.error(t('toast_time_invalid'), { description: errorText(error) });
		}
	};

	const applyResolvedLocation = (place: ResolvedLocation) => {
		setState((prev) => ({
			...prev,
			...withResolvedLocation(prev, {
				displayName: place.display_name,
				latitude: place.latitude,
				longitude: place.longitude,
				timezone: place.timezone
			})
		}));
		toast.success(t('toast_location_resolved'), {
			description: `${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)}`
		});
	};

	const resolveCurrentLocation = async (): Promise<ResolvedLocation | null> => {
		const query = state.location.trim();
		if (!query) {
			toast.error(t('toast_location_required'));
			return null;
		}
		setIsResolvingLocation(true);
		try {
			const resolved = await resolveLocation(query);
			applyResolvedLocation(resolved);
			return resolved;
		} catch (error) {
			toast.error(t('toast_location_resolve_failed'), { description: errorText(error) });
			return null;
		} finally {
			setIsResolvingLocation(false);
		}
	};

	/** Validate, resolve the place and zone when needed, and create or save the chart. */
	const submit = async () => {
		if (!state.name.trim()) {
			toast.error(t('toast_chart_name_required'));
			return;
		}
		const locationQuery = state.location.trim();
		if (!locationQuery) {
			toast.error(t('toast_location_required'));
			return;
		}

		let place = {
			location: state.location,
			latitude: state.latitude,
			longitude: state.longitude,
			latitudeDir: state.latitudeDir,
			longitudeDir: state.longitudeDir,
			timezone: state.timezone
		};
		let hasResolvedLocation =
			state.locationRegime === 'auto' && state.resolvedLocation === locationQuery;

		if (state.locationRegime === 'auto' && state.resolvedLocation !== locationQuery) {
			const resolved = await resolveCurrentLocation();
			if (!resolved) return;
			place = {
				location: resolved.display_name,
				latitude: formatCoordinateMagnitude(resolved.latitude),
				longitude: formatCoordinateMagnitude(resolved.longitude),
				latitudeDir: resolved.latitude >= 0 ? 'north' : 'south',
				longitudeDir: resolved.longitude >= 0 ? 'east' : 'west',
				// A manually chosen zone stays; only the auto regime takes the place's zone.
				timezone: state.timeRegime === 'auto' ? resolved.timezone : state.timezone
			};
			hasResolvedLocation = true;
		}

		const latitude = signedCoordinate(place.latitude, 'north', place.latitudeDir);
		const longitude = signedCoordinate(place.longitude, 'east', place.longitudeDir);
		if (
			latitude === null ||
			longitude === null ||
			Math.abs(latitude) > 90 ||
			Math.abs(longitude) > 180
		) {
			toast.error(t('toast_coordinates_invalid'));
			return;
		}

		if (state.timeRegime === 'auto' && (!hasResolvedLocation || !place.timezone)) {
			try {
				place.timezone = await resolveTimezone(latitude, longitude);
				update({ timezone: place.timezone, timezoneRegion: timeZoneRegion(place.timezone) });
			} catch (error) {
				toast.error(t('toast_location_resolve_failed'), { description: errorText(error) });
				return;
			}
		}

		let chart: AppChart;
		try {
			chart = appChartFromNewHoroscopeInput({
				locationName: state.name,
				chartKind: state.chartKind,
				dateTime: state.dateTime,
				timeSystem: state.timeSystem,
				julianDay: state.julianDay,
				julianCalendarDate: state.julianCalendarDate,
				location: place.location,
				tags: state.tags.join(', '),
				tagColors: Object.fromEntries(
					state.tags.map((tag, index) => [tag, state.tagColors[tag] ?? tagDefaultColor(index)])
				),
				latitude: place.latitude,
				longitude: place.longitude,
				latitudeDir: place.latitudeDir,
				longitudeDir: place.longitudeDir,
				timezone: place.timezone,
				utcOffset: formUtcOffset(state),
				locationRegime: state.locationRegime,
				timeRegime: state.timeRegime,
				rodenRating: state.rodenRating || undefined,
				workspaceDefaults,
				existingIds: existingChartIds
			});
		} catch (error) {
			toast.error(t('toast_time_invalid'), { description: errorText(error) });
			return;
		}

		if (initialValues) await onSaved?.({ ...chart, id: initialValues.id });
		else await onCreated?.(chart);
	};

	return {
		state,
		isEditMode: initialValues != null,
		isResolvingLocation,
		workspaceTags,
		update,
		setTags,
		renameTag,
		setTagColor,
		setTimeZoneRegion,
		setLocationText,
		setTimeSystem,
		applyResolvedLocation,
		submit
	};
}

export type NewHoroscopeForm = ReturnType<typeof useNewHoroscopeForm>;
