import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from '@/app/components/ui/typography';
import { WidgetFrame } from '@/app/views/data/widget-frame';
import type { WheelFocus } from '@/lib/astrology/informationView';
import type { ChartFacts } from '@/lib/tauri/types';
import type { WidgetInstance } from '@/lib/widgets/types';
import { useWidgetChrome } from '../workspace/use-widget-chrome';
import { useSpektrum, type SpektrumValue } from './spektrum-context';

/** A Spektrum card: the widget frame, and its body drawn from the chart's facts — or an empty
 *  state when the selected chart has none. */
export function SpektrumWidget({
	instance,
	title,
	children
}: {
	instance: WidgetInstance;
	title: string;
	children: (facts: ChartFacts) => ReactNode;
}) {
	const { t } = useTranslation();
	const { facts } = useSpektrum();
	const chrome = useWidgetChrome(instance, title);
	return (
		<WidgetFrame {...chrome} title={title}>
			{facts ? (
				children(facts)
			) : (
				<Text variant="caption" tone="muted">
					{t('info_no_facts')}
				</Text>
			)}
		</WidgetFrame>
	);
}

/** Interaction props of a share chart whose items each focus some bodies (and a half). */
export function focusInteraction(
	{ isActive, preview, toggleLock, focus }: SpektrumValue,
	focusOf: (id: string) => WheelFocus | undefined
) {
	return {
		activeIdOf: (ids: readonly string[]) => ids.find((id) => isActive(id)) ?? null,
		onItemHover: (id: string | null) => preview(id, id ? focusOf(id) : undefined),
		onItemSelect: (id: string) => {
			const target = focusOf(id);
			if (target) toggleLock(id, target);
		},
		focus
	};
}
