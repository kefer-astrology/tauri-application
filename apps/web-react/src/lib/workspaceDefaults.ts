import {
	aspectLineTierStyleFromDto,
	normalizeSupportedHouseSystem,
	type WorkspaceDefaultsState
} from '@/lib/tauri/chartPayload';
import type { CurrentModelReport, WorkspaceDefaultsDto } from '@/lib/tauri/types';

/** Overlay a persisted workspace defaults DTO onto the frontend defaults state. */
export function mergeWorkspaceDefaults(
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
		houseSystem: normalizeSupportedHouseSystem(dto.default_house_system) ?? prev.houseSystem,
		// Backend has no workspace-level zodiac/ayanamsa default field yet (only per-chart).
		zodiacType: prev.zodiacType,
		timezone: dto.default_timezone?.trim() || prev.timezone,
		locationName: dto.default_location_name?.trim() || prev.locationName,
		locationLatitude: lat,
		locationLongitude: lon,
		engine: dto.default_engine?.trim() || prev.engine,
		positionMode:
			dto.position_mode === 'geometric' || dto.position_mode === 'apparent'
				? dto.position_mode
				: prev.positionMode,
		defaultBodies: Array.isArray(dto.default_bodies) ? [...dto.default_bodies] : prev.defaultBodies,
		defaultAspects: Array.isArray(dto.default_aspects)
			? [...dto.default_aspects]
			: prev.defaultAspects,
		defaultAspectOrbs:
			dto.default_aspect_orbs && typeof dto.default_aspect_orbs === 'object'
				? { ...prev.defaultAspectOrbs, ...dto.default_aspect_orbs }
				: prev.defaultAspectOrbs,
		defaultAspectColors:
			dto.default_aspect_colors && typeof dto.default_aspect_colors === 'object'
				? { ...prev.defaultAspectColors, ...dto.default_aspect_colors }
				: prev.defaultAspectColors,
		bodyColors:
			dto.radix_point_colors && typeof dto.radix_point_colors === 'object'
				? { ...prev.bodyColors, ...dto.radix_point_colors }
				: prev.bodyColors,
		extendedObjectTypes: Array.isArray(dto.extended_object_types)
			? [...dto.extended_object_types]
			: prev.extendedObjectTypes,
		objectOrbs:
			dto.object_orbs && typeof dto.object_orbs === 'object'
				? { ...prev.objectOrbs, ...dto.object_orbs }
				: prev.objectOrbs,
		astrologyTradition: dto.astrology_tradition ?? prev.astrologyTradition,
		aspectLineTierStyle: aspectLineTierStyleFromDto(dto.aspect_line_tier_style)
	};
}

/** Apply a partial defaults change (records are merged, arrays replaced). */
export function mergeWorkspaceDefaultsPatch(
	prev: WorkspaceDefaultsState,
	patch: Partial<WorkspaceDefaultsState>
): WorkspaceDefaultsState {
	return {
		...prev,
		...patch,
		defaultBodies: Array.isArray(patch.defaultBodies)
			? [...patch.defaultBodies]
			: prev.defaultBodies,
		defaultAspects: Array.isArray(patch.defaultAspects)
			? [...patch.defaultAspects]
			: prev.defaultAspects,
		defaultAspectOrbs: patch.defaultAspectOrbs
			? { ...prev.defaultAspectOrbs, ...patch.defaultAspectOrbs }
			: prev.defaultAspectOrbs,
		defaultAspectColors: patch.defaultAspectColors
			? { ...prev.defaultAspectColors, ...patch.defaultAspectColors }
			: prev.defaultAspectColors,
		bodyColors: patch.bodyColors ? { ...prev.bodyColors, ...patch.bodyColors } : prev.bodyColors,
		extendedObjectTypes: Array.isArray(patch.extendedObjectTypes)
			? [...patch.extendedObjectTypes]
			: prev.extendedObjectTypes,
		objectOrbs: patch.objectOrbs ? { ...prev.objectOrbs, ...patch.objectOrbs } : prev.objectOrbs,
		astrologyTradition:
			patch.astrologyTradition !== undefined ? patch.astrologyTradition : prev.astrologyTradition,
		aspectLineTierStyle: patch.aspectLineTierStyle
			? { ...prev.aspectLineTierStyle, ...patch.aspectLineTierStyle }
			: prev.aspectLineTierStyle
	};
}

/** Apply the backend's resolved model-layer defaults before the workspace-layer DTO overlay. */
export function mergeModelReportDefaults(
	prev: WorkspaceDefaultsState,
	report: CurrentModelReport
): WorkspaceDefaultsState {
	const effective = report.effective_settings;
	return {
		...prev,
		defaultBodies:
			effective.default_bodies.length > 0 ? effective.default_bodies : prev.defaultBodies,
		defaultAspects:
			effective.default_aspects.length > 0 ? effective.default_aspects : prev.defaultAspects,
		defaultAspectOrbs:
			Object.keys(effective.aspect_orbs).length > 0
				? { ...prev.defaultAspectOrbs, ...effective.aspect_orbs }
				: prev.defaultAspectOrbs
	};
}
