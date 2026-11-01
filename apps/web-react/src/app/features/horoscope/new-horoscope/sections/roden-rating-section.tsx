import { useTranslation } from 'react-i18next';
import { FormField, FormSelect } from '../form-controls';
import { RODEN_RATINGS } from '../options';
import type { NewHoroscopeForm } from '../use-new-horoscope-form';

/** Rodden rating of the birth data source. */
export function RodenRatingSection({ form }: { form: NewHoroscopeForm }) {
	const { t } = useTranslation();
	return (
		<FormField label={t('new_roden_rating')} htmlFor="roden-rating">
			<FormSelect
				id="roden-rating"
				value={form.state.rodenRating}
				onValueChange={(rodenRating) => form.update({ rodenRating })}
				placeholder={t('new_roden_rating_placeholder')}
				options={RODEN_RATINGS.map((rating) => ({
					value: rating.id,
					label: `${rating.id} – ${t(rating.labelKey)}`
				}))}
			/>
		</FormField>
	);
}
