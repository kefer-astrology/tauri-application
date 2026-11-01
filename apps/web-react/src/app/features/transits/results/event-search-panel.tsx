import { useTranslation } from 'react-i18next';
import { cn } from '@/app/components/ui/utils';
import { useAppFormFieldTheme } from '@/app/components/form-field-theme';
import { ASPECT_GLYPHS } from '@/lib/astrology/aspects';
import { formatSignedDms } from '@/lib/astrology/dms';
import { objectIcon, objectLabel } from '@/lib/astrology/objectLabels';
import type { TransitEvent, TransitEventSearch } from '@/lib/tauri/types';
import { formatDateTime } from '@/lib/time/format';
import { AstrologyGlyph } from '@/ui/astrology-glyph';
import { OpenChartButton } from './open-chart-button';

/** Root-found exact events (aspect hits, stations) in time order — exact instants, unlike the
 *  hits table, which approximates them from the samples. Hidden when there is nothing to say. */
export function EventSearchPanel({
	eventSearch,
	onOpenInstant
}: {
	eventSearch: TransitEventSearch;
	onOpenInstant: (datetime: string) => void;
}) {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme();
	const { events, complete, warnings } = eventSearch;

	if (events.length === 0 && complete && warnings.length === 0) return null;

	return (
		<div className="shrink-0 border-t border-[color:var(--theme-panel-border)] p-4">
			<h3 className={cn('mb-2 text-xs font-semibold tracking-wide uppercase', ft.bodyText)}>
				{t('transits_event_search_title', { defaultValue: 'Exact events' })}
			</h3>

			{!complete && (
				<div className="mb-2 space-y-1">
					<p className="text-destructive text-xs">
						{t('transits_event_search_complete_false', {
							defaultValue:
								'One or more searches could not complete — the events below may be partial.'
						})}
					</p>
					{warnings.map((warning, index) => (
						<p key={index} className={cn('text-xs', ft.muted)}>
							{warning}
						</p>
					))}
				</div>
			)}

			{events.length === 0 ? (
				<p className={cn('text-xs', ft.muted)}>
					{t('transits_event_search_empty', {
						defaultValue: 'No exact events found in the selected interval.'
					})}
				</p>
			) : (
				<ul className="max-h-48 space-y-1 overflow-auto">
					{events.map((event, index) => (
						<EventRow key={index} event={event} onOpenInstant={onOpenInstant} />
					))}
				</ul>
			)}
		</div>
	);
}

function EventRow({
	event,
	onOpenInstant
}: {
	event: TransitEvent;
	onOpenInstant: (datetime: string) => void;
}) {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme();

	const motionBadge = (bodyId: string) => {
		const motion = event.motion?.[bodyId];
		if (!motion) return null;
		return (
			<span className={cn('ml-1 text-[10px]', ft.muted)}>
				({formatSignedDms(motion.speed)}
				{motion.retrograde
					? ` ${t('transits_event_search_retrograde', { defaultValue: 'retrograde' })}`
					: ''}
				)
			</span>
		);
	};
	const tangential =
		event.kind === 'aspect_hit'
			? event.contact === 'tangential'
			: event.direction_change === 'tangential_no_change';
	// A tangential candidate whose refinement did not converge is a heuristic near-miss and must
	// look different from a confirmed event.
	const unconfirmed = tangential && !event.confirmed;

	return (
		<li className={cn('flex flex-wrap items-center gap-2 rounded px-2 py-1 text-xs', ft.bodyText)}>
			<span className="whitespace-nowrap tabular-nums">{formatDateTime(event.datetime)}</span>
			{event.kind === 'aspect_hit' ? (
				<>
					<span className="inline-flex items-center gap-1">
						<AstrologyGlyph glyphId={event.from} fallback={objectIcon(event.from)} size={14} />
						<AstrologyGlyph
							glyphId={event.type}
							domain="aspect"
							fallback={ASPECT_GLYPHS[event.type] ?? '•'}
							size={14}
						/>
						<AstrologyGlyph glyphId={event.to} fallback={objectIcon(event.to)} size={14} />
					</span>
					<span className={cn('whitespace-nowrap', ft.muted)}>
						{t('transits_event_search_exact_angle', { defaultValue: 'Exact angle' })}:{' '}
						{event.exact_angle}°
					</span>
					{motionBadge(event.from)}
				</>
			) : (
				<>
					<span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', ft.muted)}>
						{t('transits_event_search_kind_station', { defaultValue: 'Station' })}
					</span>
					<span className="inline-flex items-center gap-1">
						<AstrologyGlyph glyphId={event.body} fallback={objectIcon(event.body)} size={14} />
						{objectLabel(event.body, t)}
					</span>
					{motionBadge(event.body)}
				</>
			)}
			{tangential && (
				<span className={cn('rounded px-1 py-0.5 text-[10px]', ft.muted)}>
					{t('transits_event_search_tangential', { defaultValue: 'tangential' })}
				</span>
			)}
			{unconfirmed && (
				<span
					className="rounded px-1 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400"
					title={t('transits_event_search_unconfirmed_hint', {
						defaultValue:
							'Refinement did not converge within tolerance -- a heuristic candidate, not a verified event.'
					})}
				>
					{t('transits_event_search_unconfirmed', { defaultValue: 'unconfirmed' })}
				</span>
			)}
			<OpenChartButton className="ml-auto" onClick={() => onOpenInstant(event.datetime)} />
		</li>
	);
}
