import { describe, expect, it } from 'vitest';
import { DEFAULT_WORKSPACE_DEFAULTS } from '@/lib/tauri/chartPayload';
import type { WorkspaceDefaultsDto } from '@/lib/tauri/types';
import { mergeWorkspaceDefaults, mergeWorkspaceDefaultsPatch } from './workspaceDefaults';

describe('workspace defaults', () => {
	it('overlays a DTO, merging records and keeping unset fields', () => {
		const merged = mergeWorkspaceDefaults(DEFAULT_WORKSPACE_DEFAULTS, {
			default_location_name: ' Prague ',
			default_aspect_orbs: { conjunction: 9 },
			position_mode: 'geometric'
		} as WorkspaceDefaultsDto);
		expect(merged.locationName).toBe('Prague');
		expect(merged.positionMode).toBe('geometric');
		expect(merged.defaultAspectOrbs.conjunction).toBe(9);
		expect(merged.timezone).toBe(DEFAULT_WORKSPACE_DEFAULTS.timezone);
	});

	it('patches replace arrays and merge records', () => {
		const patched = mergeWorkspaceDefaultsPatch(DEFAULT_WORKSPACE_DEFAULTS, {
			defaultBodies: ['sun'],
			bodyColors: { sun: '#ff0' }
		});
		expect(patched.defaultBodies).toEqual(['sun']);
		expect(patched.bodyColors.sun).toBe('#ff0');
		expect(patched.defaultAspects).toEqual(DEFAULT_WORKSPACE_DEFAULTS.defaultAspects);
	});
});
