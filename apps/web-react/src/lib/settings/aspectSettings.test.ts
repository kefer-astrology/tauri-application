import { describe, expect, it } from 'vitest';
import { DEFAULT_ASPECT_ORBS } from '@/lib/astrology/aspects';
import { DEFAULT_WORKSPACE_DEFAULTS } from '@/lib/tauri/chartPayload';
import {
	aspectDefaultsPatch,
	aspectRowsFromDefaults,
	suggestedObjectOrb,
	toggleExtendedObjectTypes
} from './aspectSettings';

describe('aspect settings', () => {
	it('round-trips rows through the defaults patch', () => {
		const rows = aspectRowsFromDefaults(DEFAULT_WORKSPACE_DEFAULTS);
		const patch = aspectDefaultsPatch(rows);
		expect(patch.defaultAspects).toEqual(Object.keys(rows).filter((id) => rows[id]!.enabled));
		const broken = { ...rows, conjunction: { ...rows.conjunction!, orb: Number.NaN } };
		// An invalid orb falls back to the catalog default (filled from Rust at app start).
		expect(aspectDefaultsPatch(broken).defaultAspectOrbs.conjunction).toBe(
			DEFAULT_ASPECT_ORBS.conjunction
		);
	});

	it('disabling a category keeps orbs; enabling never overwrites existing ones', () => {
		const off = toggleExtendedObjectTypes(
			{ extendedObjectTypes: ['asteroid'], objectOrbs: { ceres: 3 } },
			['asteroid'],
			false
		);
		expect(off).toEqual({ extendedObjectTypes: [], objectOrbs: { ceres: 3 } });
		const on = toggleExtendedObjectTypes(
			{ extendedObjectTypes: [], objectOrbs: { ceres: 3 } },
			['asteroid'],
			true
		);
		expect(on.extendedObjectTypes).toEqual(['asteroid']);
		expect(on.objectOrbs.ceres).toBe(3);
		expect(suggestedObjectOrb()).toBeGreaterThanOrEqual(0.5);
	});
});
