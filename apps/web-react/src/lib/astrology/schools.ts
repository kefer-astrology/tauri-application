import type { AstrologicalTraditionId } from '@/lib/tauri/types';

/** The astrological schools ("Škola") of a workspace. A school decides what is calculated
 *  (aspect set and orbs, seeded in Rust) and which widget profiles are offered. Only some are
 *  available yet; the others are listed but cannot be chosen. */
export const ASTROLOGY_SCHOOLS: readonly {
	id: AstrologicalTraditionId;
	labelKey: string;
	enabled: boolean;
}[] = [
	{ id: 'modern_western', labelKey: 'tradition_modern_western', enabled: true },
	{ id: 'medieval_traditional', labelKey: 'tradition_medieval_traditional', enabled: true },
	{ id: 'hellenistic', labelKey: 'tradition_hellenistic', enabled: false },
	{ id: 'harmonic', labelKey: 'tradition_harmonic', enabled: false },
	{ id: 'cosmobiology', labelKey: 'tradition_cosmobiology', enabled: false },
	{ id: 'uranian_hamburg', labelKey: 'tradition_uranian_hamburg', enabled: false },
	{ id: 'jyotish_parashari', labelKey: 'tradition_jyotish_parashari', enabled: false }
];

/** The school a workspace uses when it has none or an unavailable one. */
export const DEFAULT_SCHOOL: AstrologicalTraditionId = 'modern_western';

export function isSchoolEnabled(school: AstrologicalTraditionId): boolean {
	return ASTROLOGY_SCHOOLS.some((entry) => entry.id === school && entry.enabled);
}

/** The school in effect: the workspace's own when available, else the default. */
export function effectiveSchool(
	school: AstrologicalTraditionId | null | undefined
): AstrologicalTraditionId {
	return school && isSchoolEnabled(school) ? school : DEFAULT_SCHOOL;
}
