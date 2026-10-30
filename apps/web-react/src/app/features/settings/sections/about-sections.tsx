import { useTranslation } from 'react-i18next';
import { cn } from '@/app/components/ui/utils';
import { useAppFormFieldTheme } from '@/app/components/form-field-theme';
import { SUPPORTED_LANGUAGES, type AppLanguage } from '@/lib/i18n';
import { JAN_KEFER_BIOGRAPHY } from '@/lib/content/janKefer';

/** Jan Kefer's biography in the UI language (English when it has no translation). */
export function JanKeferSection() {
	const { t, i18n } = useTranslation();
	const ft = useAppFormFieldTheme();
	const language = i18n.language.split('-')[0] ?? 'en';
	const paragraphs =
		JAN_KEFER_BIOGRAPHY[
			(SUPPORTED_LANGUAGES as readonly string[]).includes(language)
				? (language as AppLanguage)
				: 'en'
		];
	return (
		<div className="space-y-4">
			<p className={ft.label}>{t('section_jan_kefer', { defaultValue: 'Jan Kefer' })}</p>
			{paragraphs.map((paragraph, index) => (
				<p key={index} className={cn('text-sm leading-relaxed', ft.bodyText)}>
					{paragraph}
				</p>
			))}
		</div>
	);
}

export function ManualSection() {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme();
	return (
		<div className="space-y-4">
			<p className={cn('text-sm leading-relaxed', ft.muted)}>{t('settings_guide')}</p>
		</div>
	);
}
