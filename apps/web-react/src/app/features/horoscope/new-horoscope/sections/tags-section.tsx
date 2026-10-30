import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppFormFieldTheme } from '@/app/components/form-field-theme';
import { FormField } from '../form-controls';
import { TagField } from '../tag-field';
import { TagSheet } from '../tag-sheet';
import type { NewHoroscopeForm } from '../use-new-horoscope-form';

/** The chart's tags, inline and in the tag editor sheet. */
export function TagsSection({ form }: { form: NewHoroscopeForm }) {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme();
	const [sheetOpen, setSheetOpen] = useState(false);
	const { tags, tagColors } = form.state;

	return (
		<FormField label={t('new_tags')}>
			<TagField
				tags={tags}
				tagColors={tagColors}
				suggestions={form.workspaceTags}
				onChange={form.setTags}
				onOpenEditor={() => setSheetOpen(true)}
				editorLabel={t('new_tags')}
				placeholder={t('new_tags_comma_hint')}
				iconClassName={ft.iconColor}
			/>
			<TagSheet
				open={sheetOpen}
				onOpenChange={setSheetOpen}
				tags={tags}
				tagColors={tagColors}
				suggestions={form.workspaceTags}
				onChange={form.setTags}
				onRename={form.renameTag}
				onColorChange={form.setTagColor}
			/>
		</FormField>
	);
}
