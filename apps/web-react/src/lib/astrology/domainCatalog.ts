import type { DomainCatalogDto } from '@/lib/tauri/types';

/** Runtime Rust catalog. It is populated before App is imported. */
export let DOMAIN_CATALOG: DomainCatalogDto | null = null;

export function setDomainCatalog(catalog: DomainCatalogDto): void {
	DOMAIN_CATALOG = catalog;
}

export function domainIds(kind: 'shapes' | 'configurations'): string[] {
	return DOMAIN_CATALOG?.[kind].map((definition) => definition.id) ?? [];
}

/**
 * Every house system the catalog knows, including ones the backend computes
 * by substitution. Filtering on `computation_supported` here used to make
 * persisted values such as "Koch" normalize away to the default on save.
 */
export function catalogHouseSystems(): string[] {
	return DOMAIN_CATALOG?.house_systems.map((system) => system.id) ?? [];
}

/** System actually computed for `id`, or null when it is computed natively. */
export function houseSystemSubstitute(id: string): string | null {
	const system = DOMAIN_CATALOG?.house_systems.find((entry) => entry.id === id);
	if (!system || system.computation_supported) return null;
	return system.substitute ?? 'Whole Sign';
}

export function catalogSigns() {
	return DOMAIN_CATALOG?.model.signs ?? [];
}
