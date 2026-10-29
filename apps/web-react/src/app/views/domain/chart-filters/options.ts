import type { FilterOption } from '@/app/views/data/filter-controls';
import { DOMAIN_CATALOG } from '@/lib/astrology/domainCatalog';
import { FACT_PLANET_IDS } from '@/lib/astrology/factFilters';

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** Option lists shared by the chart filter sections. Values match `ChartQuery` / `FactFilters`. */

export const planetOptions = (
	t: Translate,
	ids: readonly string[] = FACT_PLANET_IDS
): FilterOption[] => ids.map((id) => ({ value: id, label: t(`planet_${id}`) }));

/** Sign index (`'0'` = Aries … `'11'` = Pisces) → localized sign name. */
export const signOptions = (t: Translate): FilterOption[] =>
	(DOMAIN_CATALOG?.model.signs ?? []).map((sign, index) => ({
		value: String(index),
		label: t(`open_sign_${sign.id}`)
	}));

export const houseOptions = (): FilterOption[] =>
	Array.from({ length: 12 }, (_, index) => ({ value: String(index + 1), label: `${index + 1}.` }));

/** 1-based degree within a sign. */
export const degreeOptions = (): FilterOption[] =>
	Array.from({ length: 30 }, (_, index) => ({ value: String(index + 1), label: `${index + 1}°` }));

export const motionOptions = (t: Translate, withStationary = true): FilterOption[] => [
	{ value: 'direct', label: t('open_motion_direct') },
	...(withStationary ? [{ value: 'stationary', label: t('open_motion_stationary') }] : []),
	{ value: 'retrograde', label: t('open_motion_retrograde') }
];
