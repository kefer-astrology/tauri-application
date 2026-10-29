import { describe, expect, it } from 'vitest';
import type { AppChart } from '@/lib/tauri/chartPayload';
import { applyWorkspaceTagColors, mergeWorkspaceTagCatalog } from './workspaceTags';

const chart = (id: string, tags: string[], tagColors?: Record<string, string>) =>
	({ id, tags, tagColors }) as unknown as AppChart;

describe('workspace tags', () => {
	it('keeps the catalog and adds tags only charts use', () => {
		const merged = mergeWorkspaceTagCatalog(
			[{ name: ' work ', color: '#f00' }],
			[chart('a', ['work', 'family'], { family: '#0f0' })]
		);
		expect(merged).toEqual([
			{ name: 'work', color: '#f00' },
			{ name: 'family', color: '#0f0' }
		]);
	});

	it('colors chart tags from the catalog, falling back to the chart', () => {
		const [colored] = applyWorkspaceTagColors(
			[chart('a', ['work', 'family', 'plain'], { family: '#0f0' })],
			[{ name: 'work', color: '#f00' }]
		);
		expect(colored!.tagColors).toEqual({ work: '#f00', family: '#0f0' });
	});
});
