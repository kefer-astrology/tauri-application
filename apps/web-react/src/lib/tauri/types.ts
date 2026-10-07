/** Shapes returned by Tauri commands (Rust/Python). Keep aligned with `src-tauri`. */

export interface WorkspaceChartSummary {
	id: string;
	name: string;
	definition: ChartDefinitionDto;
	date_time: string;
	location: string;
	tags: string[];
	tag_colors?: Record<string, string>;
}

export interface AnalysisInputDto {
	role?: string | null;
	chart_id?: string | null;
	inline_subject?: {
		id: string;
		name: string;
		event_time?: string | null;
		location: {
			name: string;
			latitude: number;
			longitude: number;
			timezone: string;
		};
	} | null;
	derivations: Array<{
		method: DerivedChartMethodDto;
		parameters?: unknown;
	}>;
}

export interface AnalysisDto {
	version: number;
	id: string;
	name: string;
	method: 'synastry' | 'transit_comparison' | 'chart_comparison';
	inputs: AnalysisInputDto[];
	parameters?: unknown;
	tags: string[];
}

export interface InlineSubjectDto {
	name: string;
	event_time?: string | null;
	location: {
		name: string;
		latitude: number;
		longitude: number;
		timezone: string;
	};
}

export type BaseChartPurposeDto = 'natal' | 'event' | 'horary' | 'electional' | 'moment';
export type DerivedChartMethodDto =
	| 'return'
	| 'progression'
	| 'direction'
	| 'relocation'
	| 'harmonic'
	| 'persona'
	| 'composite'
	| 'davison'
	| 'draconic'
	| 'coalescent';

export type ChartDefinitionDto =
	| { kind: 'base'; purpose: BaseChartPurposeDto }
	| {
			kind: 'derived';
			method: DerivedChartMethodDto;
			inputs: string[];
			parameters?: unknown;
	  };

export interface WorkspaceTagDefinition {
	name: string;
	color?: string | null;
}

export interface WorkspaceInfo {
	path: string;
	owner: string;
	active_model: string | null;
	tag_catalog: WorkspaceTagDefinition[];
	charts: WorkspaceChartSummary[];
	analyses: AnalysisDto[];
}

export type DiagnosticSeverity = 'error' | 'warning';

export interface BackendDiagnostic {
	code: string;
	severity: DiagnosticSeverity;
	message: string;
	path?: string | null;
}

/** Orb tightness tiers for radix aspect line stroke width (percent of configured max orb). */
export interface AspectLineTierStyleDto {
	tight_threshold_pct?: number | null;
	medium_threshold_pct?: number | null;
	loose_threshold_pct?: number | null;
	width_tight?: number | null;
	width_medium?: number | null;
	width_loose?: number | null;
	width_outer?: number | null;
	outer_line_style?: string | null;
}

export interface WorkspaceDefaultsDto {
	default_house_system?: string | null;
	default_timezone?: string | null;
	default_location_name?: string | null;
	default_location_latitude?: number | null;
	default_location_longitude?: number | null;
	default_engine?: string | null;
	position_mode?: 'apparent' | 'geometric' | null;
	default_bodies?: string[] | null;
	default_aspects?: string[] | null;
	default_aspect_orbs?: Record<string, number> | null;
	default_aspect_colors?: Record<string, string> | null;
	default_aspect_include_angles?: Record<string, boolean> | null;
	default_aspect_include_extended?: Record<string, boolean> | null;
	default_aspect_extended_orbs?: Record<string, number> | null;
	/** The workspace's chosen astrological tradition ("Škola"). Distinct from the
	 *  free-form `active_school`/model-catalog selector — see AstrologicalTradition
	 *  in src-tauri/src/workspace/models.rs. */
	astrology_tradition?: AstrologicalTraditionId | null;
	aspect_line_tier_style?: AspectLineTierStyleDto | null;
}

/**
 * Mirrors the Rust `AstrologicalTradition` enum (src-tauri/src/workspace/models.rs).
 * A closed set of well-known traditions, each seeding a suggested aspect-settings
 * bundle (see `workspace::tradition::tradition_aspect_preset`). First iteration:
 * only touches aspects — object selection and each tradition's native orb model
 * are future work.
 */
export type AstrologicalTraditionId =
	| 'hellenistic'
	| 'medieval_traditional'
	| 'modern_western'
	| 'harmonic'
	| 'cosmobiology'
	| 'uranian_hamburg'
	| 'jyotish_parashari';

/** Mirrors the Rust `ObjectType` enum (src-tauri/src/workspace/models.rs). */
export type ObjectTypeId =
	| 'planet'
	| 'asteroid'
	| 'angle'
	| 'house_cusp'
	| 'calculated_point'
	| 'lunar_node'
	| 'part';

/**
 * Restricts which object categories an aspect may form between. Mirrors the
 * Rust `ObjectTypeRule` enum: `exclude` drops a pair if either side belongs
 * to `types`; `only_between` requires both sides to belong to `types`.
 */
export type ObjectTypeRuleDto =
	| { mode: 'exclude'; types: ObjectTypeId[] }
	| { mode: 'only_between'; types: ObjectTypeId[] };

export interface ModelOverrideEntryDto {
	id: string;
	glyph?: string | null;
	angle?: number | null;
	harmonic?: number | null;
	default_orb?: number | null;
	only_for?: string[] | null;
	i18n?: Record<string, string> | null;
	enabled?: boolean | null;
	/** Legacy function-wrapper metadata; persisted but not used as enablement. */
	computed?: boolean | null;
	valid_contexts?: Array<'chart' | 'transit' | 'direction'> | null;
	interpretation_weight?: number | null;
	object_type_rule?: ObjectTypeRuleDto | null;
	extended_orb?: number | null;
}

export interface ModelOverridesDto {
	points: ModelOverrideEntryDto[];
	aspects: ModelOverrideEntryDto[];
	override_orbs: Record<string, number>;
}

export interface BodyDefinitionDto {
	id: string;
	enabled: boolean;
	glyph: string;
	formula: string;
	element?: string | null;
	avg_speed: number;
	max_orb: number;
	i18n: Record<string, string>;
	object_type?: ObjectTypeId | null;
	computation_map: Record<string, string | null>;
	requires_location: boolean;
	requires_house_system: boolean;
}

export interface AspectDefinitionDto {
  id: string;
  type: 'major' | 'minor';
  enabled: boolean;
	glyph: string;
	angle: number;
	harmonic: number;
	default_orb: number;
	i18n: Record<string, string>;
	color?: string | null;
	importance?: number | null;
	line_style?: string | null;
	line_width?: number | null;
	show_label?: boolean | null;
	valid_contexts?: string[] | null;
	interpretation_weight?: number | null;
	object_type_rule?: ObjectTypeRuleDto | null;
	extended_orb?: number | null;
}

export interface SignDefinitionDto {
	id: string;
	name: string;
	glyph: string;
	abbreviation: string;
	element: string;
	i18n: Record<string, string>;
}

export interface ModelSettingsDto {
	default_house_system?: string | null;
	position_mode?: 'apparent' | 'geometric' | null;
	default_aspects: string[];
	default_bodies: string[];
	standard_orb: number;
	default_transit_aspects?: string[] | null;
	default_direction_aspects?: string[] | null;
	default_transit_bodies?: string[] | null;
	default_direction_bodies?: string[] | null;
	degrees_in_circle: number;
	obliquity_j2000: number;
	coordinate_tolerance: number;
}

export interface AstroModelDto {
	name: string;
	school?: string | null;
	version: number;
	body_definitions: BodyDefinitionDto[];
	aspect_definitions: AspectDefinitionDto[];
	signs: SignDefinitionDto[];
	settings?: ModelSettingsDto | null;
	engine?: string | null;
	zodiac_type?: string | null;
	ayanamsa?: string | null;
}

export interface EffectiveModelSettingsDto {
	default_house_system?: string | null;
	default_bodies: string[];
	default_aspects: string[];
	default_transit_aspects?: string[] | null;
	default_direction_aspects?: string[] | null;
	default_transit_bodies?: string[] | null;
	default_direction_bodies?: string[] | null;
	aspect_orbs: Record<string, number>;
	standard_orb: number;
	engine?: string | null;
	position_mode: 'apparent' | 'geometric';
	zodiac_type?: string | null;
	ayanamsa?: string | null;
	time_system?: string | null;
	degrees_in_circle: number;
	obliquity_j2000: number;
	coordinate_tolerance: number;
	sources: EffectiveSettingsSourcesDto;
}

export interface ComputeSettingsOverrides {
	houseSystem?: string | null;
	bodies?: string[] | null;
	aspects?: string[] | null;
	aspectOrbs?: Record<string, number>;
	engine?: string | null;
	positionMode?: 'apparent' | 'geometric' | null;
	zodiacType?: string | null;
	ayanamsa?: string | null;
	timeSystem?: string | null;
}

export type SettingSource =
	| 'application'
	| 'model'
	| 'workspace'
	| 'preset'
	| 'chart'
	| 'operation';

export interface EffectiveSettingsSourcesDto {
	default_house_system?: SettingSource | null;
	default_bodies: SettingSource;
	default_aspects: SettingSource;
	aspect_orbs: Record<string, SettingSource>;
	standard_orb: SettingSource;
	engine?: SettingSource | null;
	position_mode: SettingSource;
	zodiac_type?: SettingSource | null;
	ayanamsa?: SettingSource | null;
	time_system?: SettingSource | null;
	computational_constants: SettingSource;
}

export interface CurrentModelReport {
	requested_school?: string | null;
	resolved_school?: string | null;
	requested_model?: string | null;
	resolved_model: string;
	source: string;
	available_models: string[];
	model: AstroModelDto;
	effective_settings: EffectiveModelSettingsDto;
	model_overrides?: ModelOverridesDto | null;
	warnings: string[];
	diagnostics: BackendDiagnostic[];
}

export interface DomainDefinitionDto {
	id: string;
	translation_key: string;
	parent_id?: string | null;
	generated_variant?: { prefix: string; source: string } | null;
}

export interface HouseSystemDefinitionDto {
	id: string;
	computation_supported: boolean;
}

export interface DomainCatalogDto {
	model: AstroModelDto;
	house_systems: HouseSystemDefinitionDto[];
	shapes: DomainDefinitionDto[];
	configurations: DomainDefinitionDto[];
}

export interface ChartDetails {
	id: string;
	subject: {
		id: string;
		name: string;
		event_time: string | null;
		location: {
			name: string;
			latitude: number;
			longitude: number;
			timezone: string;
			utc_offset?: string | null;
			location_mode?: 'auto' | 'manual' | null;
			timezone_mode?: 'auto' | 'manual' | null;
		};
	};
	config: {
		definition: ChartDefinitionDto;
		house_system: string | null;
		zodiac_type: string;
		engine: string | null;
		position_mode?: 'apparent' | 'geometric' | null;
		model: string | null;
		model_overrides?: ModelOverridesDto | null;
		override_ephemeris: string | null;
		observable_objects?: string[] | null;
		aspect_orbs?: Record<string, number>;
		selected_aspects?: string[] | null;
		ayanamsa?: string | null;
		time_system?: string | null;
	};
	tags: string[];
	tag_colors?: Record<string, string>;
	roden_rating?: string | null;
}

export interface MoonDetails {
	elongation_deg: number;
	illuminated_fraction: number;
	age_days: number;
	waxing: boolean;
	phase_id: string;
	phase_label: string;
}

export interface ComputeChartResult {
	positions: Record<string, unknown>;
	motion?: Record<
		string,
		{
			speed: number;
			retrograde: boolean;
		}
	>;
	// Rust-native route only (anise-based JPL backend); empty/absent on the Swiss-ephemeris
	// route and, on the Python sidecar route, absent here since the same data instead rides
	// along inside each `positions[id]` value (see `chartPayload.ts`'s extended-fields handling).
	right_ascension?: Record<string, number>;
	declination?: Record<string, number>;
	altitude?: Record<string, number>;
	azimuth?: Record<string, number>;
	aspects: unknown[];
	axes?: {
		asc: number;
		desc: number;
		mc: number;
		ic: number;
	};
	house_cusps?: number[];
	moon_details?: MoonDetails | null;
	chart_id: string;
}

export interface TransitSeriesEntry {
	datetime: string;
	transit_positions?: Record<string, unknown>;
	/** Daily motion (degrees/day) per transiting body at this step — Rust-native route only;
	 *  absent on the Python-sidecar fallback route. */
	motion?: Record<string, { speed: number; retrograde: boolean }>;
	aspects?: Array<Record<string, unknown>>;
}

export interface TransitSetup {
	version: 1;
	source_chart_id: string;
	transit_type: string;
	period_mode: string;
	from_date: string;
	from_time: string;
	to_date: string;
	to_time: string;
	time_step_seconds: number;
	transiting_bodies: string[];
	transited_bodies: string[];
	aspect_types: string[];
	aspect_orbs?: Record<string, number>;
	school?: string | null;
	model?: string | null;
	model_overrides?: ModelOverridesDto | null;
	house_transitions: boolean;
	sign_transitions: boolean;
	exact_hits?: boolean;
	station_events?: boolean;
	transit_limits: boolean;
	precession_correction: boolean;
}

export interface TransitSeriesRequest extends Record<string, unknown> {
	workspacePath: string;
	chartId: string;
	startDatetime: string;
	endDatetime: string;
	timeStepSeconds: number;
	transitingObjects: string[];
	transitedObjects: string[];
	aspectTypes: string[];
	presetId?: string | null;
	settingsOverrides?: ComputeSettingsOverrides | null;
}

/** `compute_transit_series_from_data` counterpart to `TransitSeriesRequest` — an in-memory chart
 *  payload instead of a workspace/chart id, for when no workspace is open. Rust-native only. */
export interface TransitSeriesFromDataRequest extends Record<string, unknown> {
	chartJson: Record<string, unknown>;
	startDatetime: string;
	endDatetime: string;
	timeStepSeconds: number;
	transitingObjects: string[];
	transitedObjects: string[];
	aspectTypes: string[];
	settingsOverrides?: ComputeSettingsOverrides | null;
}

export interface TransitSeriesResult {
	source_chart_id?: string;
	time_range?: { start: string; end: string };
	time_step?: string;
	results?: TransitSeriesEntry[];
	backend_used?: string;
	fallback_used?: boolean;
	ephemeris_source?: string;
	warnings?: string[];
}

export interface ResolvedLocation {
	query: string;
	display_name: string;
	latitude: number;
	longitude: number;
	timezone: string;
}
