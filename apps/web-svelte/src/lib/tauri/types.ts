/** Shapes returned by Tauri commands. Keep aligned with `src-tauri` and the React bridge. */

export interface WorkspaceChartSummary {
  id: string;
  name: string;
  chart_type: string;
  date_time: string;
  location: string;
  tags: string[];
}

export interface WorkspaceInfo {
  path: string;
  owner: string;
  active_model: string | null;
  charts: WorkspaceChartSummary[];
}

export type DiagnosticSeverity = 'error' | 'warning';

export interface BackendDiagnostic {
  code: string;
  severity: DiagnosticSeverity;
  message: string;
  path?: string | null;
}

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
  default_bodies?: string[] | null;
  default_aspects?: string[] | null;
  default_aspect_orbs?: Record<string, number> | null;
  default_aspect_colors?: Record<string, string> | null;
  aspect_line_tier_style?: AspectLineTierStyleDto | null;
}

export interface ModelOverrideEntryDto {
  id: string;
  glyph?: string | null;
  angle?: number | null;
  default_orb?: number | null;
  only_for?: string[] | null;
  i18n?: Record<string, string> | null;
  enabled?: boolean | null;
  /** Legacy function-wrapper metadata; persisted but not used as enablement. */
  computed?: boolean | null;
  valid_contexts?: Array<'chart' | 'transit' | 'direction'> | null;
  interpretation_weight?: number | null;
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
  object_type?: string | null;
  computation_map: Record<string, string | null>;
  requires_location: boolean;
  requires_house_system: boolean;
}

export interface AspectDefinitionDto {
  id: string;
  enabled: boolean;
  glyph: string;
  angle: number;
  default_orb: number;
  i18n: Record<string, string>;
  color?: string | null;
  importance?: number | null;
  line_style?: string | null;
  line_width?: number | null;
  show_label?: boolean | null;
  valid_contexts?: string[] | null;
  interpretation_weight?: number | null;
}

export interface SignDefinitionDto {
  name: string;
  glyph: string;
  abbreviation: string;
  element: string;
  i18n: Record<string, string>;
}

export interface ModelSettingsDto {
  default_house_system?: string | null;
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
    mode: string;
    house_system: string | null;
    zodiac_type: string;
    engine: string | null;
    model: string | null;
    model_overrides?: ModelOverridesDto | null;
    override_ephemeris: string | null;
    observable_objects?: string[];
    aspect_orbs?: Record<string, number>;
    selected_aspects?: string[];
    included_points?: string[];
    display_style?: string;
    color_theme?: string;
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
  positions?: Record<string, unknown>;
  motion?: Record<string, { speed: number; retrograde: boolean }>;
  aspects?: unknown[];
  axes?: {
    asc: number;
    desc: number;
    mc: number;
    ic: number;
  };
  house_cusps?: number[];
  moon_details?: MoonDetails | null;
  chart_id?: string;
}

export interface TransitSeriesEntry {
  datetime: string;
  transit_positions?: Record<string, unknown>;
  aspects?: Array<Record<string, unknown>>;
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
}

export interface Position {
  chart_id: string;
  datetime: string;
  object_id: string;
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
  engine?: string;
  ephemeris_file?: string;
  radix_chart_id?: string;
  is_radix: boolean;
  has_equatorial?: boolean;
  has_topocentric?: boolean;
  has_physical?: boolean;
}

export interface Aspect {
  from_object: string;
  to_object: string;
  aspect_type: string;
  angle: number;
  orb: number;
  exact_datetime?: string;
}

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
