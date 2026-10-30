import { useTranslation } from 'react-i18next';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/app/components/ui/utils';
import {
	AppMainContentContainer,
	AppMainContentRoot,
	type AppMainContentWidth
} from '@/app/components/app-main-content';
import { useAppFormFieldTheme } from '@/app/components/form-field-theme';
import { useAppTheme } from '@/app/providers/app-theme';
import { ChartBasicsSection } from './sections/chart-basics-section';
import { LocationSection } from './sections/location-section';
import { RodenRatingSection } from './sections/roden-rating-section';
import { TagsSection } from './sections/tags-section';
import { TimeSection } from './sections/time-section';
import { useNewHoroscopeForm, type NewHoroscopeFormOptions } from './use-new-horoscope-form';

interface NewHoroscopeProps extends NewHoroscopeFormOptions {
	/** `page`: the New horoscope screen; `panel`: inside the edit side panel. */
	presentation?: 'page' | 'panel';
	pageWidth?: AppMainContentWidth;
	/** Leave the form (edit mode shows a Back button). */
	onBack?: () => void;
}

/** Create a chart, or edit one when `initialValues` is given (then `onSaved` replaces
 *  `onCreated`). */
export function NewHoroscope({
	presentation = 'page',
	pageWidth = 'standard',
	onBack,
	...options
}: NewHoroscopeProps) {
	const { t } = useTranslation();
	const { theme } = useAppTheme();
	const ft = useAppFormFieldTheme();
	const form = useNewHoroscopeForm(options);
	const { isEditMode, isResolvingLocation } = form;

	return (
		<AppMainContentRoot
			className={cn(
				presentation === 'panel'
					? 'bg-transparent px-5 py-4'
					: cn(ft.formPageBg, theme === 'twilight' && 'kefer-twilight-bg')
			)}
		>
			<AppMainContentContainer width={presentation === 'panel' ? 'full' : pageWidth}>
				<div className="space-y-4">
					<ChartBasicsSection form={form} />
					<TimeSection form={form} />
					<LocationSection form={form} workspaceDefaults={options.workspaceDefaults} />
					<TagsSection form={form} />
					<RodenRatingSection form={form} />

					<div className="flex gap-4 pt-4">
						{isEditMode && (
							<Button
								type="button"
								variant="ghost"
								className={ft.footerCancel}
								onClick={() => onBack?.()}
							>
								{t('new_back')}
							</Button>
						)}
						<Button
							type="button"
							variant="ghost"
							className={cn(ft.footerPrimary, !isEditMode && 'flex-1')}
							disabled={isResolvingLocation}
							onClick={() => void form.submit()}
						>
							{isResolvingLocation
								? t('new_resolving_location')
								: isEditMode
									? t('edit_save_submit')
									: t('new_create_submit')}
						</Button>
					</div>
				</div>
			</AppMainContentContainer>
		</AppMainContentRoot>
	);
}
