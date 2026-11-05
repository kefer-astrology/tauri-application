import { useTranslation } from 'react-i18next';
import { objectLabel } from '@/lib/astrology/objectLabels';
import type { FocalRole, Highlight } from '@/lib/astrology/informationView';
import type { ChartHalf } from '@/lib/astrology/wheelGeometry';
import { signPosition } from '@/lib/astrology/zodiac';

/** Display names for chart-fact values (elements, halves, phases, roles, …). */
export function useFactLabels() {
	const { t } = useTranslation();
	const body = (id: string) => objectLabel(id, t);
	const element = (key: string) => t(`info_element_${key}`);
	const modality = (key: string) => t(`open_modality_${key}`);
	const houseGroup = (key: string) => t(`open_house_group_${key}`);
	const half = (key: ChartHalf) => t(`open_hemisphere_${key}`);
	const sign = (index: number) => t(`open_sign_${signPosition(index * 30 + 1).signZodiacId}`);
	const aspect = (key: string) => t(`info_aspect_${key}`);
	const role = (value: FocalRole, detail?: string) => {
		switch (value) {
			case 'chart_ruler_traditional':
				return `${t('info_horoscope_ruler')} (${t('open_ruler_traditional')})`;
			case 'chart_ruler_modern':
				return `${t('info_horoscope_ruler')} (${t('open_ruler_modern')})`;
			case 'final_dispositor_traditional':
				return t('open_filter_final_dispositor_traditional');
			case 'final_dispositor_modern':
				return t('open_filter_final_dispositor_modern');
			case 'angular':
				return detail
					? `${t('info_angular_planet')} (${body(detail === 'dsc' ? 'desc' : detail)})`
					: t('info_angular_planet');
			case 'unaspected':
				return t('info_unaspected');
		}
	};
	const stellium = (kind: string, place?: number) =>
		kind === 'house'
			? t('info_stellium_house', { house: place })
			: kind === 'sign' && place !== undefined
				? t('info_stellium_sign', { sign: sign(place) })
				: t('info_stellium_chain');
	const highlight = (chip: Highlight) => {
		const share = chip.share !== undefined ? ` ${Math.round(chip.share * 100)} %` : '';
		switch (chip.kind) {
			case 'element':
				return `${t('info_dominance_element')}: ${element(chip.value)}`;
			case 'modality':
				return `${t('info_dominance_mode_quality')}: ${modality(chip.value)}`;
			case 'house_group':
				return `${t('info_dominance_houses')}: ${houseGroup(chip.value)}`;
			case 'aspect':
				return `${t('info_dominance_aspects')}: ${aspect(chip.value)}`;
			case 'stellium':
				return `${t('info_stellium')}: ${stellium(chip.value, chip.count)}`;
			case 'singleton':
				return `${t('info_singleton')}: ${body(chip.value)}`;
			case 'final_dispositor':
				return `${t('info_final_dispositor')}: ${body(chip.value)}`;
			case 'chart_ruler':
				return `${t('info_horoscope_ruler')}: ${body(chip.value)}`;
			case 'unaspected':
				return `${t('info_unaspected')}: ${body(chip.value)}`;
			case 'retrograde':
				return `${t('open_motion_retrograde')}: ${chip.count}`;
			case 'lunar_phase':
				return `${t('info_lunar_phases')}: ${t(`open_phase_${chip.value}`)}`;
			case 'hemisphere':
				return `${half(chip.value as ChartHalf)}${share}`;
			case 'quadrant':
				return `${t('info_quadrant', { n: chip.value })}${share}`;
		}
	};
	return { t, body, element, modality, houseGroup, half, sign, aspect, role, stellium, highlight };
}
