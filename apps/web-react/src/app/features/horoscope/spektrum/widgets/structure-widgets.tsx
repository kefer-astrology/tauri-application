import { Separator } from '@/app/components/ui/separator';
import { Text } from '@/app/components/ui/typography';
import {
	BalanceBar,
	HeatGrid,
	ShareColumns,
	ShareDonut,
	StackedShareBar
} from '@/app/views/data/share-charts';
import {
	elementRows,
	hemisphereRows,
	houseCounts,
	houseGroupRows,
	missingKeys,
	modalityRows,
	quadrantRows
} from '@/lib/astrology/informationView';
import type { WidgetInstance } from '@/lib/widgets/types';
import { useSpektrum } from '../spektrum-context';
import { focusInteraction, SpektrumWidget } from '../spektrum-widget';
import { useFactLabels } from '../use-fact-labels';

const VIZ = [
	'var(--token-viz-1)',
	'var(--token-viz-2)',
	'var(--token-viz-3)',
	'var(--token-viz-4)'
];
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

/** A "missing" line for keys counted zero. */
function Missing({ labels }: { labels: string[] }) {
	const { t } = useFactLabels();
	if (labels.length === 0) return null;
	return (
		<Text variant="caption" tone="muted" className="mt-1">
			{t('info_missing', { list: labels.join(', ') })}
		</Text>
	);
}

/** Planets per element (in the element colors), and the elements without any. */
export function ElementBalanceWidget({ instance }: { instance: WidgetInstance }) {
	const labels = useFactLabels();
	const spektrum = useSpektrum();
	const { elementColors } = spektrum;
	return (
		<SpektrumWidget instance={instance} title={labels.t('info_dominance_element')}>
			{(facts) => {
				const rows = elementRows(facts);
				const focus = focusInteraction(spektrum, (id) => ({
					bodies: rows.find((r) => `element:${r.key}` === id)?.bodies ?? []
				}));
				const ids = rows.map((r) => `element:${r.key}`);
				return (
					<>
						<ShareColumns
							items={rows.map((r) => ({
								id: `element:${r.key}`,
								label: labels.element(r.key),
								count: r.count,
								share: r.share,
								color: elementColors[r.key]
							}))}
							activeId={focus.activeIdOf(ids)}
							onItemHover={focus.onItemHover}
							onItemSelect={focus.onItemSelect}
						/>
						<Missing labels={missingKeys(rows).map(labels.element)} />
					</>
				);
			}}
		</SpektrumWidget>
	);
}

/** Planets per modality. */
export function ModalityBalanceWidget({ instance }: { instance: WidgetInstance }) {
	const labels = useFactLabels();
	const spektrum = useSpektrum();
	return (
		<SpektrumWidget instance={instance} title={labels.t('info_dominance_mode_quality')}>
			{(facts) => {
				const rows = modalityRows(facts);
				const focus = focusInteraction(spektrum, (id) => ({
					bodies: rows.find((r) => `modality:${r.key}` === id)?.bodies ?? []
				}));
				return (
					<>
						<StackedShareBar
							items={rows.map((r, index) => ({
								id: `modality:${r.key}`,
								label: labels.modality(r.key),
								count: r.count,
								share: r.share,
								color: VIZ[index]!
							}))}
							activeId={focus.activeIdOf(rows.map((r) => `modality:${r.key}`))}
							onItemHover={focus.onItemHover}
							onItemSelect={focus.onItemSelect}
						/>
						<Missing labels={missingKeys(rows).map(labels.modality)} />
					</>
				);
			}}
		</SpektrumWidget>
	);
}

/** Planets in active / reactive / resulting houses, and per house I–XII. */
export function HouseBalanceWidget({ instance }: { instance: WidgetInstance }) {
	const labels = useFactLabels();
	const spektrum = useSpektrum();
	return (
		<SpektrumWidget instance={instance} title={labels.t('info_dominance_houses')}>
			{(facts) => {
				const rows = houseGroupRows(facts);
				const focus = focusInteraction(spektrum, (id) => ({
					bodies: rows.find((r) => `house:${r.key}` === id)?.bodies ?? []
				}));
				return (
					<div className="space-y-2">
						<StackedShareBar
							items={rows.map((r, index) => ({
								id: `house:${r.key}`,
								label: labels.houseGroup(r.key),
								count: r.count,
								share: r.share,
								color: VIZ[index === 2 ? 3 : index]!
							}))}
							activeId={focus.activeIdOf(rows.map((r) => `house:${r.key}`))}
							onItemHover={focus.onItemHover}
							onItemSelect={focus.onItemSelect}
						/>
						<HeatGrid
							cells={houseCounts(facts).map((value, index) => ({
								id: `house-${index + 1}`,
								label: ROMAN[index]!,
								value
							}))}
						/>
					</div>
				);
			}}
		</SpektrumWidget>
	);
}

/** Planets per quadrant I–IV. */
export function QuadrantsWidget({ instance }: { instance: WidgetInstance }) {
	const labels = useFactLabels();
	const spektrum = useSpektrum();
	return (
		<SpektrumWidget instance={instance} title={labels.t('info_quadrant_division')}>
			{(facts) => {
				const rows = quadrantRows(facts);
				const focus = focusInteraction(spektrum, (id) => ({
					bodies: rows.find((r) => `quadrant:${r.quadrant}` === id)?.bodies ?? []
				}));
				return (
					<ShareDonut
						items={rows.map((r, index) => ({
							id: `quadrant:${r.quadrant}`,
							label: labels.t('info_quadrant', { n: ROMAN[r.quadrant - 1] }),
							count: r.count,
							share: r.share,
							color: VIZ[index]!
						}))}
						activeId={focus.activeIdOf(rows.map((r) => `quadrant:${r.quadrant}`))}
						onItemHover={focus.onItemHover}
						onItemSelect={focus.onItemSelect}
					/>
				);
			}}
		</SpektrumWidget>
	);
}

/** Planets east vs west of the meridian and above vs below the horizon; a half also shows on
 *  the wheel. */
export function HemispheresWidget({ instance }: { instance: WidgetInstance }) {
	const labels = useFactLabels();
	const spektrum = useSpektrum();
	return (
		<SpektrumWidget instance={instance} title={labels.t('info_hemisphere_emphasis')}>
			{(facts) => {
				const rows = hemisphereRows(facts);
				const byHalf = Object.fromEntries(rows.map((r) => [r.half, r]));
				const focus = focusInteraction(spektrum, (id) => {
					const row = rows.find((r) => `half:${r.half}` === id);
					return row ? { bodies: row.bodies, half: row.half } : undefined;
				});
				const pair = (a: 'east' | 'upper', b: 'west' | 'lower') => (
					<div className="space-y-1">
						<StackedShareBar
							items={[a, b].map((half, index) => ({
								id: `half:${half}`,
								label: labels.half(half),
								count: byHalf[half]!.count,
								share: byHalf[half]!.share,
								color: VIZ[index]!
							}))}
							activeId={focus.activeIdOf([`half:${a}`, `half:${b}`])}
							onItemHover={focus.onItemHover}
							onItemSelect={focus.onItemSelect}
						/>
					</div>
				);
				return (
					<div className="space-y-3">
						{pair('east', 'west')}
						<Separator />
						{pair('upper', 'lower')}
					</div>
				);
			}}
		</SpektrumWidget>
	);
}

/** Extraversion (fire + air) against introversion (earth + water). */
export function OrientationWidget({ instance }: { instance: WidgetInstance }) {
	const labels = useFactLabels();
	return (
		<SpektrumWidget instance={instance} title={labels.t('info_extroversion_introversion_ratio')}>
			{(facts) => {
				const { extroverted, introverted } = facts.orientation;
				const total = extroverted + introverted;
				return (
					<BalanceBar
						left={{ label: labels.t('info_extroversion'), share: total ? extroverted / total : 0 }}
						right={{ label: labels.t('info_introversion'), share: total ? introverted / total : 0 }}
					/>
				);
			}}
		</SpektrumWidget>
	);
}
