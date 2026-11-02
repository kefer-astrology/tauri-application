import { Text, Heading } from '@/app/components/ui/typography';
import { useTranslation } from 'react-i18next';
import { cn } from '@/app/components/ui/utils';
import { useAppFormFieldTheme } from '@/app/components/form-field-theme';
import { objectIcon, objectLabel } from '@/lib/astrology/objectLabels';
import type { ConfigurationMatch } from '@/lib/tauri/types';
import { formatDateTime } from '@/lib/time/format';
import { AstrologyGlyph } from '@/ui/astrology-glyph';
import { OpenChartButton } from './open-chart-button';

const CLIPPED_LABELS: Record<string, { key: string; fallback: string }> = {
	period_start: {
		key: 'transits_configuration_clipped_period_start',
		fallback: 'clipped: period start'
	},
	period_end: { key: 'transits_configuration_clipped_period_end', fallback: 'clipped: period end' },
	missing_coverage: {
		key: 'transits_configuration_clipped_missing_coverage',
		fallback: 'clipped: missing coverage'
	}
};

/** Multi-body configuration intervals (Grand Trine, T-square, Yod, Grand Cross): entry, best fit
 *  and exit, with the reason a boundary was clipped. Hidden without matches. */
export function ConfigurationMatchesPanel({
	matches,
	onOpenInstant
}: {
	matches: ConfigurationMatch[];
	onOpenInstant: (datetime: string) => void;
}) {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme();

	if (matches.length === 0) return null;

	const clippedLabel = (reason: string | null) => {
		const label = reason ? CLIPPED_LABELS[reason] : undefined;
		return label ? t(label.key, { defaultValue: label.fallback }) : null;
	};

	/** One instant line: label, time, optional clipping note, and an open action. */
	const instantRow = (label: string, iso: string | null, clipped: string | null = null) => (
		<div className="flex flex-wrap items-center gap-2">
			<span className="whitespace-nowrap tabular-nums">
				{label}: {iso ? formatDateTime(iso) : '—'}
				{clipped && (
					<Text variant="caption" as="span" tone="muted" className="ml-1">
						({clipped})
					</Text>
				)}
			</span>
			{iso && <OpenChartButton onClick={() => onOpenInstant(iso)} />}
		</div>
	);

	return (
		<div className="shrink-0 border-t border-[color:var(--theme-panel-border)] p-4">
			<Heading variant="eyebrow" level={3} tone="secondary" className="mb-2">
				{t('transits_configuration_matches_title', { defaultValue: 'Multi-body configurations' })}
			</Heading>
			<ul className="max-h-64 space-y-2 overflow-auto">
				{matches.map((match, index) => (
					<li
						key={index}
						className={cn('rounded border p-2 text-xs', ft.bodyText, ft.footerBorder)}
					>
						<div className="mb-1 flex flex-wrap items-center gap-2">
							<span className="font-medium">
								{t(`transits_configuration_${match.configuration_id}`, {
									defaultValue: match.configuration_id
								})}
							</span>
							<span className="inline-flex items-center gap-1">
								{match.participants.map((participant) => (
									<AstrologyGlyph
										key={participant.role}
										glyphId={participant.body_id}
										fallback={objectIcon(participant.body_id)}
										size={14}
									/>
								))}
							</span>
							<Text variant="caption" as="span" tone="muted">
								{match.participants
									.map(
										(p) => `${p.role}=${objectLabel(p.body_id, t)}${p.is_fixed ? ' (fixed)' : ''}`
									)
									.join(', ')}
							</Text>
						</div>
						{instantRow(
							t('transits_configuration_entry', { defaultValue: 'Entry' }),
							match.entry,
							clippedLabel(match.entry_clipped)
						)}
						{match.best_fit &&
							instantRow(
								t('transits_configuration_best_fit', { defaultValue: 'Best fit' }),
								match.best_fit.datetime
							)}
						{instantRow(
							t('transits_configuration_exit', { defaultValue: 'Exit' }),
							match.exit,
							clippedLabel(match.exit_clipped)
						)}
					</li>
				))}
			</ul>
		</div>
	);
}
