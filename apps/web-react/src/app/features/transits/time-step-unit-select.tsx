import { useTranslation } from 'react-i18next';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/app/components/ui/select';
import { cn } from '@/app/components/ui/utils';
import { useAppFormFieldTheme } from '@/app/components/form-field-theme';
import { TIME_STEP_UNITS, type TimeStepUnit } from '@/lib/astrology/transitSetup';

const UNIT_LABELS: Record<TimeStepUnit, { key: string; fallback: string }> = {
	seconds: { key: 'transits_granularity_seconds', fallback: 'Seconds' },
	minutes: { key: 'transits_granularity_minutes', fallback: 'Minutes' },
	hours: { key: 'transits_granularity_hours', fallback: 'Hours' },
	days: { key: 'transits_granularity_days', fallback: 'Days' }
};

/** Unit of the graph sampling interval. */
export function TimeStepUnitSelect({
	value,
	onValueChange,
	disabled,
	triggerClassName
}: {
	value: TimeStepUnit;
	onValueChange: (unit: TimeStepUnit) => void;
	disabled?: boolean;
	triggerClassName?: string;
}) {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme();
	return (
		<Select
			value={value}
			onValueChange={(next) => onValueChange(next as TimeStepUnit)}
			disabled={disabled}
		>
			<SelectTrigger className={cn(ft.selectTrigger, triggerClassName)}>
				<SelectValue />
			</SelectTrigger>
			<SelectContent className={ft.selectContent}>
				{TIME_STEP_UNITS.map((unit) => (
					<SelectItem key={unit} value={unit} className={ft.selectItem}>
						{t(UNIT_LABELS[unit].key, { defaultValue: UNIT_LABELS[unit].fallback })}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
