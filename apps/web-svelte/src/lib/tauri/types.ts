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

export interface AspectLineTierStyleDto {
  tight_threshold_pct?: number | null;
  medium_threshold_pct?: number | null;
  loose_threshold_pct?: number | null;
  width_tight?: number | null;
  width_medium?: number | null;
  width_loose?: number | null;
  width_outer?: number | null;
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
    };
  };
  config: {
    mode: string;
    house_system: string | null;
    zodiac_type: string;
    engine: string | null;
    model: string | null;
    override_ephemeris: string | null;
  };
  tags: string[];
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
