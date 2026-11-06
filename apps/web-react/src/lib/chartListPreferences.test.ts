import { beforeEach, describe, expect, it } from 'vitest';
import { readStoredHiddenFilterGroups } from './chartListPreferences';

const groups = ['chart-type-base', 'chart-type-derived', 'tags', 'date'];

describe('filter visibility migration', () => {
	beforeEach(() => localStorage.clear());

	it('splits the former hidden chart-type group', () => {
		localStorage.setItem(
			'open_chart_list_hidden_filter_groups',
			JSON.stringify(['chart-type', 'tags'])
		);
		expect(readStoredHiddenFilterGroups(groups)).toEqual([
			'chart-type-base',
			'chart-type-derived',
			'tags'
		]);
	});

	it('migrates the legacy visible list to hidden groups', () => {
		localStorage.setItem(
			'open_chart_list_visible_filter_groups',
			JSON.stringify(['chart-type', 'tags'])
		);
		expect(readStoredHiddenFilterGroups(groups)).toEqual(['date']);
	});

	it('preserves an explicitly empty visible list', () => {
		localStorage.setItem('open_chart_list_visible_filter_groups', '[]');
		expect(readStoredHiddenFilterGroups(groups)).toEqual(groups);
	});

	it('prefers current preferences and leaves new groups visible', () => {
		localStorage.setItem('open_chart_list_visible_filter_groups', '[]');
		localStorage.setItem('open_chart_list_hidden_filter_groups', '["tags"]');
		expect(readStoredHiddenFilterGroups(groups)).toEqual(['tags']);
	});
});
