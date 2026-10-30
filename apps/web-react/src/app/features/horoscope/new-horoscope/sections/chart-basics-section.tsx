import { useTranslation } from 'react-i18next';
import { Input } from '@/app/components/ui/input';
import { cn } from '@/app/components/ui/utils';
import { useAppFormFieldTheme } from '@/app/components/form-field-theme';
import { FormField, FormSelect } from '../form-controls';
import { CHART_KINDS } from '../options';
import type { NewHoroscopeForm } from '../use-new-horoscope-form';

/** Chart name and chart type. */
export function ChartBasicsSection({ form }: { form: NewHoroscopeForm }) {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme();
	return (
		<>
			<FormField label={t('new_name')} htmlFor="locationName">
				<Input
					id="locationName"
					value={form.state.name}
					onChange={(event) => form.update({ name: event.target.value })}
					className={cn(ft.input, 'shadow-inner')}
				/>
			</FormField>
			<FormField label={t('new_type')} htmlFor="chart-type">
				<FormSelect
					id="chart-type"
					value={form.state.chartKind}
					onValueChange={(chartKind) => form.update({ chartKind })}
					options={CHART_KINDS.map((kind) => ({ value: kind.id, label: t(kind.labelKey) }))}
				/>
			</FormField>
		</>
	);
}
