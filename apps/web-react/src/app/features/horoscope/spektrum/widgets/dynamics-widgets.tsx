import { useTranslation } from 'react-i18next';
import { Badge } from '@/app/components/ui/badge';
import { Text } from '@/app/components/ui/typography';
import { ShareRows } from '@/app/views/data/share-charts';
import { ObjectGlyph } from '@/app/views/domain/object-glyph';
import {
	aspectRows,
	focalPlanets,
	missingKeys,
	retrogradeSummary,
	singletons
} from '@/lib/astrology/informationView';
import { configurationLabel } from '@/lib/astrology/objectLabels';
import type { WidgetInstance } from '@/lib/widgets/types';
import { useSpektrum } from '../spektrum-context';
import { SpektrumWidget } from '../spektrum-widget';
import { useFactLabels } from '../use-fact-labels';
import { FocusRow } from './focus-row';

/** Glyphs of a few bodies in a row. */
function Glyphs({ ids }: { ids: readonly string[] }) {
	return (
		<span className="inline-flex flex-wrap items-center gap-1">
			{ids.map((id) => (
				<ObjectGlyph key={id} id={id} size={14} />
			))}
		</span>
	);
}

function None() {
	const { t } = useTranslation();
	return (
		<Text variant="caption" tone="muted">
			{t('info_none')}
		</Text>
	);
}

/** The Ptolemaic aspects between planets, counted, and the ones missing. */
export function AspectBalanceWidget({ instance }: { instance: WidgetInstance }) {
	const labels = useFactLabels();
	return (
		<SpektrumWidget instance={instance} title={labels.t('info_dominance_aspects')}>
			{(facts) => {
				const rows = aspectRows(facts);
				const max = Math.max(...rows.map((r) => r.count));
				const missing = missingKeys(rows);
				return (
					<>
						<ShareRows
							items={rows.map((r) => ({
								id: `aspect:${r.key}`,
								label: labels.aspect(r.key),
								count: r.count,
								share: r.share,
								color: r.count === max && max > 0 ? 'var(--token-viz-1)' : 'var(--token-viz-2)'
							}))}
						/>
						{missing.length > 0 ? (
							<Text variant="caption" tone="muted" className="mt-1">
								{labels.t('info_missing', { list: missing.map(labels.aspect).join(', ') })}
							</Text>
						) : null}
					</>
				);
			}}
		</SpektrumWidget>
	);
}

/** The chart's planetary configurations (T-square, grand trine, …) as computed. */
export function ConfigurationsWidget({ instance }: { instance: WidgetInstance }) {
	const { t, i18n } = useTranslation();
	const { chart } = useSpektrum();
	const configurations = chart?.computed?.configurations ?? [];
	return (
		<SpektrumWidget instance={instance} title={t('info_planetary_configuration')}>
			{() =>
				configurations.length === 0 ? (
					<None />
				) : (
					<div className="flex flex-wrap gap-1">
						{configurations.map((id) => (
							<Badge key={id} variant="outline" className="px-2 py-0.5 text-xs font-normal">
								{configurationLabel(id, t, (key) => i18n.exists(key))}
							</Badge>
						))}
					</div>
				)
			}
		</SpektrumWidget>
	);
}

/** Stelliums: three or more planets in one house, one sign, or a chain of conjunctions. */
export function StelliumsWidget({ instance }: { instance: WidgetInstance }) {
	const labels = useFactLabels();
	return (
		<SpektrumWidget instance={instance} title={labels.t('info_stellium')}>
			{(facts) =>
				facts.stelliums.length === 0 ? (
					<None />
				) : (
					<div className="space-y-1">
						{facts.stelliums.map((stellium, index) => (
							<FocusRow key={index} id={`stellium:${index}`} focus={{ bodies: stellium.members }}>
								<span className="min-w-0 flex-1">
									{labels.stellium(stellium.kind, stellium.house ?? stellium.sign)} (
									{stellium.members.length})
								</span>
								<Glyphs ids={stellium.members} />
							</FocusRow>
						))}
					</div>
				)
			}
		</SpektrumWidget>
	);
}

/** A planet alone in a chart half; it and its half show on the wheel. */
export function SingletonsWidget({ instance }: { instance: WidgetInstance }) {
	const labels = useFactLabels();
	return (
		<SpektrumWidget instance={instance} title={labels.t('info_singleton_hemisphere')}>
			{(facts) => {
				const found = singletons(facts);
				return found.length === 0 ? (
					<None />
				) : (
					<div className="space-y-1">
						{found.map((single) => (
							<FocusRow
								key={single.half}
								id={`singleton:${single.half}`}
								focus={{ bodies: [single.body], half: single.half }}
							>
								<ObjectGlyph id={single.body} size={14} />
								{labels.t('info_singleton_line', {
									body: labels.body(single.body),
									half: labels.half(single.half)
								})}
							</FocusRow>
						))}
					</div>
				);
			}}
		</SpektrumWidget>
	);
}

/** Retrograde planets, and chart halves whose planets are all retrograde. */
export function RetrogradeWidget({ instance }: { instance: WidgetInstance }) {
	const labels = useFactLabels();
	return (
		<SpektrumWidget instance={instance} title={labels.t('open_motion_retrograde')}>
			{(facts) => {
				const { retrograde, total, patterns } = retrogradeSummary(facts);
				return (
					<div className="space-y-2">
						<FocusRow id="retrograde:all" focus={{ bodies: retrograde }}>
							<span className="min-w-0 flex-1">
								{labels.t('info_retrograde_count', { count: retrograde.length, total })}
							</span>
							<Glyphs ids={retrograde} />
						</FocusRow>
						{patterns.map((pattern) => (
							<FocusRow
								key={pattern.half}
								id={`retrograde:${pattern.half}`}
								focus={{ bodies: pattern.bodies, half: pattern.half }}
							>
								{labels.t('info_retrograde_pattern', { half: labels.half(pattern.half) })}
							</FocusRow>
						))}
					</div>
				);
			}}
		</SpektrumWidget>
	);
}

/** Focal planets: chart ruler, final dispositor, angular and unaspected planets, with all of each
 *  planet's roles. */
export function FocalPlanetsWidget({ instance }: { instance: WidgetInstance }) {
	const labels = useFactLabels();
	return (
		<SpektrumWidget instance={instance} title={labels.t('info_focal_planets')}>
			{(facts) => {
				const rows = focalPlanets(facts);
				return rows.length === 0 ? (
					<None />
				) : (
					<div className="space-y-1">
						{rows.map((row) => (
							<FocusRow key={row.body} id={`focal:${row.body}`} focus={{ bodies: [row.body] }}>
								<ObjectGlyph id={row.body} size={16} />
								<span className="min-w-0 flex-1">
									<span className="font-medium">{labels.body(row.body)}</span>
									<span className="mt-0.5 flex flex-wrap gap-0.5">
										{row.roles.map((role, index) => (
											<Badge
												key={index}
												variant="secondary"
												className="px-1 py-0 text-xs font-normal"
											>
												{labels.role(role.role, role.detail)}
											</Badge>
										))}
									</span>
								</span>
							</FocusRow>
						))}
					</div>
				);
			}}
		</SpektrumWidget>
	);
}
