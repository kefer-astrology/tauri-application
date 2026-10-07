import { useTranslation } from 'react-i18next';
import type { TransitSeriesEntry } from '@/lib/tauri/types';
import type { AspectTimelineSeries } from '@/lib/astrology/aspectTimeline';
import { motionStateFromSpeed } from '@/lib/astrology/objectDetail';
import { objectIcon, objectLabel, aspectLabel } from '@/lib/astrology/objectLabels';
import { ASPECT_GLYPHS } from '@/lib/astrology/aspects';
import { AstrologyGlyph } from '@/ui/astrology-glyph';
import type { AstrologyGlyphSetId } from '@/lib/astrology/glyphs';
import { cn } from './ui/utils';
import { useAppFormFieldTheme } from './form-field-theme';
import type { Theme } from './astrology-sidebar';

interface CycleAnalysisPanelProps {
	theme: Theme;
	glyphSet: AstrologyGlyphSetId;
	series: AspectTimelineSeries[];
	entries: readonly TransitSeriesEntry[];
	colorByKey: Map<string, string>;
}

const MAX_PAIRS_SHOWN = 6;

function lastNonNullIndex(values: Array<number | null>): number | null {
	for (let i = values.length - 1; i >= 0; i -= 1) {
		if (values[i] !== null) return i;
	}
	return null;
}

export function CycleAnalysisPanel({
	theme,
	glyphSet,
	series,
	entries,
	colorByKey
}: CycleAnalysisPanelProps) {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme(theme);

	const ranked = [...series]
		.sort((a, b) => b.hits.length - a.hits.length || a.key.localeCompare(b.key))
		.slice(0, MAX_PAIRS_SHOWN);

	return (
		<aside
			className={cn(
				'flex h-full w-[320px] shrink-0 flex-col gap-4 overflow-y-auto border-l p-4',
				'border-[color:var(--theme-panel-border)]'
			)}
		>
			<h3 className={cn('text-sm font-semibold', ft.title)}>
				{t('cycle_analysis_title', { defaultValue: 'Cycle analysis' })}
			</h3>

			{ranked.length === 0 ? (
				<p className={cn('text-xs', ft.muted)}>
					{t('cycle_analysis_empty', {
						defaultValue: 'Select a pair or compute a transit series to see its cycle.'
					})}
				</p>
			) : (
				<div className="space-y-4">
					{ranked.map((s) => {
						const lastIndex = lastNonNullIndex(s.closeness);
						const closeness = lastIndex !== null ? s.closeness[lastIndex] : null;
						const phase = lastIndex !== null ? s.phase[lastIndex] : null;
						const speed = lastIndex !== null ? entries[lastIndex]?.motion?.[s.from]?.speed : undefined;
						const retrograde =
							lastIndex !== null ? entries[lastIndex]?.motion?.[s.from]?.retrograde : undefined;
						const motionState = motionStateFromSpeed(speed);
						const color = colorByKey.get(s.key);

						return (
							<div
								key={s.key}
								className={cn(
									'rounded-lg border p-3 text-xs',
									'border-[color:var(--theme-panel-border)]'
								)}
							>
								<div className="mb-2 flex items-center gap-1.5">
									{color && (
										<span
											className="inline-block h-0.5 w-2.5 shrink-0 rounded-full"
											style={{ backgroundColor: color }}
										/>
									)}
									<AstrologyGlyph
										glyphId={s.from}
										glyphSet={glyphSet}
										fallback={objectIcon(s.from)}
										size={14}
									/>
									<AstrologyGlyph
										glyphId={s.aspectType}
										glyphSet={glyphSet}
										domain="aspect"
										fallback={ASPECT_GLYPHS[s.aspectType] ?? '•'}
										size={14}
									/>
									<AstrologyGlyph
										glyphId={s.to}
										glyphSet={glyphSet}
										fallback={objectIcon(s.to)}
										size={14}
									/>
									<span className={cn('font-medium', ft.bodyText)}>
										{objectLabel(s.from, t)} {aspectLabel(s.aspectType, t)} {objectLabel(s.to, t)}
									</span>
								</div>

								{closeness !== null && phase && (
									<p className={ft.bodyText}>
										{phase === 'applying'
											? t('cycle_analysis_status_applying', {
													defaultValue: 'Applying — {{percent}}% to exact',
													percent: Math.round(closeness * 100)
												})
											: t('cycle_analysis_status_separating', {
													defaultValue: 'Separating — {{percent}}% past exact',
													percent: Math.round(closeness * 100)
												})}
									</p>
								)}

								<p className={ft.muted}>
									{motionState === 'retrograde' || retrograde
										? t('cycle_analysis_motion_retrograde', {
												defaultValue: '{{body}} is retrograde',
												body: objectLabel(s.from, t)
											})
										: motionState === 'stationary'
											? t('cycle_analysis_motion_stationary', {
													defaultValue: '{{body}} is stationary',
													body: objectLabel(s.from, t)
												})
											: t('cycle_analysis_motion_direct', {
													defaultValue: '{{body}} is direct',
													body: objectLabel(s.from, t)
												})}
								</p>

								{s.hits.length > 0 && (
									<p className={cn('mt-1', ft.muted)}>
										{t('cycle_analysis_exact_hits', { defaultValue: 'Exact hits' })}:{' '}
										{s.hits
											.map(
												(hit) =>
													new Date(hit.timestampMs).toLocaleDateString() +
													(hit.fromRetrograde
														? ` (${t('aspect_timeline_retrograde_tag', { defaultValue: 'R' })})`
														: '')
											)
											.join(', ')}
									</p>
								)}
							</div>
						);
					})}
				</div>
			)}

			<div
				className={cn(
					'mt-auto space-y-1.5 border-t pt-3 text-[11px]',
					'border-[color:var(--theme-panel-border)]',
					ft.muted
				)}
			>
				<p className="font-semibold">
					{t('cycle_analysis_glossary_title', { defaultValue: 'Definitions' })}
				</p>
				<p>
					{t('cycle_analysis_glossary_applying', {
						defaultValue: 'Applying — the orb is shrinking; the aspect is approaching exactness.'
					})}
				</p>
				<p>
					{t('cycle_analysis_glossary_separating', {
						defaultValue: 'Separating — the orb is widening; the aspect has passed exactness.'
					})}
				</p>
				<p>
					{t('cycle_analysis_glossary_retrograde', {
						defaultValue:
							"Retrograde — the transiting body's apparent motion is reversed, which can make the same aspect perfect more than once."
					})}
				</p>
				<p>
					{t('cycle_analysis_glossary_stationary', {
						defaultValue:
							"Stationary — the transiting body's daily motion is near zero, just before or after it turns retrograde or direct."
					})}
				</p>
				<p>
					{t('cycle_analysis_glossary_orb', {
						defaultValue: "Orb — the maximum deviation from an aspect's exact angle still counted as that aspect."
					})}
				</p>
			</div>
		</aside>
	);
}
