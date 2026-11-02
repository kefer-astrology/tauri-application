import { Text } from '@/app/components/ui/typography';
import { useTranslation } from 'react-i18next';

import { SUPPORTED_LANGUAGES, type AppLanguage } from '@/lib/i18n';
import { JAN_KEFER_BIOGRAPHY } from '@/lib/content/janKefer';

/** Jan Kefer's biography in the UI language (English when it has no translation). */
export function JanKeferSection() {
	const { t, i18n } = useTranslation();

	const language = i18n.language.split('-')[0] ?? 'en';
	const paragraphs =
		JAN_KEFER_BIOGRAPHY[
			(SUPPORTED_LANGUAGES as readonly string[]).includes(language)
				? (language as AppLanguage)
				: 'en'
		];
	return (
		<div className="space-y-4">
			<Text variant="label" tone="secondary">
				{t('section_jan_kefer', { defaultValue: 'Jan Kefer' })}
			</Text>
			{paragraphs.map((paragraph, index) => (
				<Text variant="body" tone="secondary" key={index}>
					{paragraph}
				</Text>
			))}
		</div>
	);
}

export function ManualSection() {
	const { t } = useTranslation();

	return (
		<div className="space-y-4">
			<Text variant="body" tone="muted">
				{t('settings_guide')}
			</Text>
		</div>
	);
}
