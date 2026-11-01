import { useTranslation } from 'react-i18next';
import { AppMainContentContainer, AppMainContentRoot } from '@/app/components/ui/app-main-content';
import { cn } from '@/app/components/ui/utils';
import { useAppFormFieldTheme } from '@/app/components/form-field-theme';
import { AspectList } from '@/app/views/domain/aspect-list';
import { ObservableObjectList } from '@/app/views/domain/observable-object-list';
import { useTransits } from '../transits-provider';
import { GeneralSection } from './general-section';
import type { TransitSection } from './transits-setup-sidebar';

/** The transit setup, one section at a time. Transiting bodies move across the period;
 *  transited bodies are held at the chart's moment. */
export function TransitsSetupView({ section }: { section: TransitSection }) {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme();
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
						<p className={cn('text-sm', ft.muted)}>{t('transits_aspects_subtitle')}</p>
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
