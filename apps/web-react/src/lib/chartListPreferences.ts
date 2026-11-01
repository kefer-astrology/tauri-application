import type { SortingState } from '@tanstack/react-table';

const SORT_KEY = 'open_chart_list_sort';
const FAVORITES_KEY = 'open_chart_list_favorites';
const HIDDEN_FILTER_GROUPS_KEY = 'open_chart_list_hidden_filter_groups';

export function readStoredChartListSort(): SortingState {
	try {
		const raw = localStorage.getItem(SORT_KEY);
		if (!raw) return [];
		const parsed: unknown = JSON.parse(raw);
		if (
			Array.isArray(parsed) &&
			parsed.every(
				(entry): entry is SortingState[number] =>
					!!entry && typeof entry.id === 'string' && typeof entry.desc === 'boolean'
			)
		)
			return parsed;
	} catch {
		/* ignore */
	}
	return [];
}

export function persistChartListSort(sorting: SortingState) {
	try {
		localStorage.setItem(SORT_KEY, JSON.stringify(sorting));
	} catch {
		/* ignore */
	}
}

export function readStoredChartFavorites(): string[] {
	try {
		const raw = localStorage.getItem(FAVORITES_KEY);
		if (!raw) return [];
		const parsed: unknown = JSON.parse(raw);
		if (Array.isArray(parsed) && parsed.every((id): id is string => typeof id === 'string'))
			return parsed;
	} catch {
		/* ignore */
	}
	return [];
}

export function persistChartFavorites(ids: string[]) {
	try {
		localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
	} catch {
		/* ignore */
	}
}

/** Filter groups the user hid in the Open view. Stored as the hidden set so groups added in
 *  later versions start visible. */
export function readStoredHiddenFilterGroups(): string[] {
	try {
		const raw = localStorage.getItem(HIDDEN_FILTER_GROUPS_KEY);
		if (!raw) return [];
		const parsed: unknown = JSON.parse(raw);
		if (Array.isArray(parsed) && parsed.every((id): id is string => typeof id === 'string'))
			return parsed;
	} catch {
		/* ignore */
	}
	return [];
}

export function persistHiddenFilterGroups(ids: string[]) {
	try {
		localStorage.setItem(HIDDEN_FILTER_GROUPS_KEY, JSON.stringify(ids));
	} catch {
		/* ignore */
	}
}
