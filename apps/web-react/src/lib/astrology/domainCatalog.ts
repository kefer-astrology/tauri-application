import type { DomainCatalogDto } from '@/lib/tauri/types';

/** Runtime Rust catalog. It is populated before App is imported. */
export let DOMAIN_CATALOG: DomainCatalogDto | null = null;

export function setDomainCatalog(catalog: DomainCatalogDto): void {
	DOMAIN_CATALOG = catalog;
}

export function domainIds(kind: 'shapes' | 'configurations'): string[] {
	return DOMAIN_CATALOG?.[kind].map((definition) => definition.id) ?? [];
}

export function catalogHouseSystems(): string[] {
	return DOMAIN_CATALOG?.house_systems
		.filter((system) => system.computation_supported)
		.map((system) => system.id) ?? [];
}

export function catalogSigns() {
	return DOMAIN_CATALOG?.model.signs ?? [];
}
