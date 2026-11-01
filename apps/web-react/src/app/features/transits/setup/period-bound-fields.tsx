import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { cn } from '@/app/components/ui/utils';
import { DatePickerInput } from '@/app/components/ui/date-picker-input';
import { TimeRollerPicker } from '@/app/components/ui/time-roller-picker';
import { useAppFormFieldTheme } from '@/app/components/form-field-theme';
import { dateFnsLocale } from '@/lib/time/dateFnsLocale';

/** One period bound: date, time and a (not yet available) time zone. */
export function PeriodBoundFields({
	label,
	value,
	onValueChange,
	disabled
}: {
	label: string;
	value: Date;
	onValueChange: (value: Date) => void;
	disabled: boolean;
}) {
	const { t, i18n } = useTranslation();
	const ft = useAppFormFieldTheme();
	const locale = useMemo(() => dateFnsLocale(i18n.language), [i18n.language]);
	const smallLabel = cn('mb-1 block text-xs', ft.muted);

	return (
		<div>
			<Label className={cn('mb-2 block', ft.label)}>{label}:</Label>
			<div className="grid grid-cols-3 gap-3">
				<DatePickerInput
					label={t('transits_general_item_date')}
					value={value}
					onValueChange={onValueChange}
					locale={locale}
					showLabel
					disabled={disabled}
					labelClassName={smallLabel}
					iconClassName={ft.iconColor}
					panelClassName={ft.datePicker}
				/>
				<TimeRollerPicker
					label={t('transits_general_item_time')}
					value={value}
					onValueChange={onValueChange}
					showLabel
					disabled={disabled}
					labelClassName={smallLabel}
					iconClassName={ft.iconColor}
					panelClassName={ft.datePicker}
				/>
				<div>
					<Label className={smallLabel}>{t('transits_general_item_timezone')}</Label>
					<Input
						type="text"
						placeholder={t('transits_timezone_placeholder')}
						disabled
						className={cn(ft.input, 'h-10 py-2 text-sm shadow-inner', ft.inputDisabled)}
					/>
				</div>
			</div>
		</div>
	);
}
