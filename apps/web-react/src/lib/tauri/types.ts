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

export interface WorkspaceDefaultsDto {
	default_house_system?: string | null;
	default_timezone?: string | null;
	default_location_name?: string | null;
	default_location_latitude?: number | null;
	default_location_longitude?: number | null;
	default_engine?: string | null;
	default_bodies?: string[] | null;
	default_aspects?: string[] | null;
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
