import { useTranslation } from 'react-i18next';
import { ChoiceButton } from '@/app/components/ui/choice';
import { Text } from '@/app/components/ui/typography';
import { highlights } from '@/lib/astrology/informationView';
import type { WidgetInstance } from '@/lib/widgets/types';
import { useSpektrum } from '../spektrum-context';
import { SpektrumWidget } from '../spektrum-widget';
import { useFactLabels } from '../use-fact-labels';

/** The chart's headline facts as chips; hovering one previews it on the wheel, a click locks it. */
export function HighlightsWidget({ instance }: { instance: WidgetInstance }) {
	const { t } = useTranslation();
	const labels = useFactLabels();
	const { isActive, preview, toggleLock, focus } = useSpektrum();
	return (
		<SpektrumWidget
			instance={instance}
			title={t('widget_highlights', { defaultValue: 'Highlights' })}
		>
			{(facts) => {
				const chips = highlights(facts);
				return chips.length === 0 ? (
					<Text variant="caption" tone="muted">
						{t('info_none')}
					</Text>
				) : (
					<div className="flex flex-wrap gap-1.5" data-handoff="BottomHighlights">
						{chips.map((chip) => {
							const id = `highlight:${chip.id}`;
							return (
								<ChoiceButton
									key={chip.id}
									type="button"
									variant="chip"
									size="sm"
									emphasis="outline"
									selected={isActive(id) && focus !== null}
									aria-pressed={isActive(id)}
									onMouseEnter={() => preview(id, chip.focus)}
									onMouseLeave={() => preview(null)}
									onFocus={() => preview(id, chip.focus)}
									onBlur={() => preview(null)}
									onClick={() => toggleLock(id, chip.focus)}
								>
									{labels.highlight(chip)}
								</ChoiceButton>
							);
						})}
					</div>
				);
			}}
		</SpektrumWidget>
	);
}
