import type { SortingState } from '@tanstack/react-table';

const SORT_KEY = 'open_chart_list_sort';
const FAVORITES_KEY = 'open_chart_list_favorites';

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
