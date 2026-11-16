import { afterEach, describe, expect, it } from 'vitest';
import type { DomainCatalogDto } from '@/lib/tauri/types';
import { catalogHouseSystems, houseSystemSubstitute, setDomainCatalog } from './domainCatalog';
import { normalizeSupportedHouseSystem } from '@/lib/tauri/chartPayload';

function catalog(): DomainCatalogDto {
	return {
		model: {} as DomainCatalogDto['model'],
		house_systems: [
			{ id: 'Placidus', computation_supported: true },
			{ id: 'Whole Sign', computation_supported: true },
			{ id: 'Koch', computation_supported: false, substitute: 'Whole Sign' }
		],
		shapes: [],
		configurations: []
	};
}

describe('house-system catalog', () => {
	afterEach(() => setDomainCatalog(null as unknown as DomainCatalogDto));

	it('lists substituted systems instead of hiding them', () => {
		setDomainCatalog(catalog());
		expect(catalogHouseSystems()).toEqual(['Placidus', 'Whole Sign', 'Koch']);
	});

	it('reports the substitute only for systems that are not computed natively', () => {
		setDomainCatalog(catalog());
		expect(houseSystemSubstitute('Koch')).toBe('Whole Sign');
		expect(houseSystemSubstitute('Placidus')).toBeNull();
		expect(houseSystemSubstitute('Unknown')).toBeNull();
	});

	// Regression: filtering on computation_supported made a persisted "Koch"
	// normalize to the workspace default on the next save.
	it('keeps a persisted substituted house system when building payloads', () => {
		setDomainCatalog(catalog());
		expect(normalizeSupportedHouseSystem('Koch')).toBe('Koch');
		expect(normalizeSupportedHouseSystem('Bogus')).toBeNull();
	});
});
