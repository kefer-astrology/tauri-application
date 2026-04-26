/** Shapes returned by Tauri commands (Rust/Python). Keep aligned with `src-tauri`. */

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

/** Orb tightness tiers for radix aspect line stroke width (percent of configured max orb). */
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

export interface ComputeChartResult {
	positions: Record<string, unknown>;
	motion?: Record<
		string,
		{
			speed: number;
			retrograde: boolean;
		}
	>;
	aspects: unknown[];
	axes?: {
		asc: number;
		desc: number;
		mc: number;
		ic: number;
	};
	house_cusps?: number[];
	chart_id: string;
}

export interface ResolvedLocation {
	query: string;
	display_name: string;
	latitude: number;
	longitude: number;
}
