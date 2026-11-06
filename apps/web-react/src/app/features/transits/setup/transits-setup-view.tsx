import { Text } from '@/app/components/ui/typography';
import { useTranslation } from 'react-i18next';
import { AppMainContentContainer, AppMainContentRoot } from '@/app/components/ui/app-main-content';

import { AspectList } from '@/app/views/domain/aspect-list';
import { ObservableObjectList } from '@/app/views/domain/observable-object-list';
import { useTransits } from '../transits-provider';
import { GeneralSection } from './general-section';
import type { TransitSection } from './transits-setup-sidebar';

/** The transit setup, one section at a time. Transiting bodies move across the period;
 *  transited bodies are held at the chart's moment. */
export function TransitsSetupView({ section }: { section: TransitSection }) {
	const { t } = useTranslation();

	const { setup, updateSetup } = useTransits();

	return (
		<AppMainContentRoot>
			<AppMainContentContainer width="wide">
				{section === 'general' && <GeneralSection />}
				{section === 'transiting-bodies' && (
					<ObservableObjectList
						subtitle={t('transits_subtitle_transiting')}
						selectedIds={setup.transitingBodies}
						onSelectedIdsChange={(transitingBodies) => updateSetup({ transitingBodies })}
					/>
				)}
				{section === 'transited-bodies' && (
					<ObservableObjectList
						subtitle={t('transits_subtitle_transited')}
						selectedIds={setup.transitedBodies}
						onSelectedIdsChange={(transitedBodies) => updateSetup({ transitedBodies })}
					/>
				)}
				{section === 'aspects' && (
					<div className="space-y-6">
						<Text variant="body" tone="muted">
							{t('transits_aspects_subtitle')}
						</Text>
						<AspectList
							selectedIds={setup.selectedAspects}
							onSelectedIdsChange={(selectedAspects) => updateSetup({ selectedAspects })}
						/>
					</div>
				)}
			</AppMainContentContainer>
		</AppMainContentRoot>
	);
}
