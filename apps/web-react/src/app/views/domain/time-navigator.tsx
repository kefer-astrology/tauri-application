import type { ComponentType } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Clock, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/app/components/ui/button';
import { Surface } from '@/app/components/ui/container';
import { Input } from '@/app/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/app/components/ui/select';
import { cn } from '@/app/components/ui/utils';
import { useAppFormFieldTheme } from '@/app/components/form-field-theme';
import { ASTROLABE_UNITS, astrolabeMaxAmount, type AstrolabeUnit } from '@/lib/astrology/chartView';

const stepSelect = 'w-full min-w-0 flex-1 [color-scheme:inherit]';
const stepButton =
	'rounded-full border-[color:var(--token-border-subtle)] hover:bg-[color:var(--token-hover-subtle)]';

/** A read-only value with an icon (date, time, place). */
function Readout({
	value,
	icon: Icon
}: {
	value: string;
	icon: ComponentType<{ className?: string }>;
}) {
	const ft = useAppFormFieldTheme();
	return (
		<Surface variant="inset" className="flex items-center gap-2 px-3 py-2">
			<Input
				variant="form"
				readOnly
				value={value}
				className="flex-1 cursor-default border-0 bg-transparent px-0 py-0 text-sm shadow-none focus:ring-0"
			/>
			<Icon className={cn('h-4 w-4 shrink-0', ft.muted)} />
		</Surface>
	);
}

/** Step a chart's moment back or forward by an amount of a unit, with its current date, time and
 *  place below. */
export function TimeNavigator({
	amount,
	unit,
	onAmountChange,
	onUnitChange,
	onStep,
	disabled,
	readouts
}: {
	amount: number;
	unit: AstrolabeUnit;
	onAmountChange: (amount: number) => void;
	onUnitChange: (unit: AstrolabeUnit) => void;
	onStep: (direction: -1 | 1) => void;
	disabled: boolean;
	readouts: { date: string; time: string; location: string };
}) {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme();

	return (
		<div className="@container space-y-3">
			<div className="grid grid-cols-2 items-center gap-2 @min-[15rem]:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto]">
				<Button
					variant="outline"
					size="icon"
					className={cn(stepButton, ft.title)}
					onClick={() => onStep(-1)}
					disabled={disabled}
					aria-label={t('astrolabe_step_back', { defaultValue: 'Step back' })}
				>
					<ChevronLeft className="h-4 w-4" />
				</Button>

				<Select value={String(amount)} onValueChange={(value) => onAmountChange(Number(value))}>
					<SelectTrigger variant="form" density="compact" className={stepSelect}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent variant="form">
						{Array.from({ length: astrolabeMaxAmount(unit) }, (_, i) => i + 1).map((n) => (
							<SelectItem variant="form" key={n} value={String(n)}>
								{n}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				<Select value={unit} onValueChange={(value) => onUnitChange(value as AstrolabeUnit)}>
					<SelectTrigger variant="form" density="compact" className={stepSelect}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent variant="form">
						{ASTROLABE_UNITS.map((option) => (
							<SelectItem variant="form" key={option} value={option}>
								{t(`astrolabe_unit_${option}`)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				<Button
					variant="outline"
					size="icon"
					className={cn(stepButton, ft.title)}
					onClick={() => onStep(1)}
					disabled={disabled}
					aria-label={t('astrolabe_step_forward', { defaultValue: 'Step forward' })}
				>
					<ChevronRight className="h-4 w-4" />
				</Button>
			</div>

			<Readout value={readouts.date} icon={Calendar} />
			<Readout value={readouts.time} icon={Clock} />
			<Readout value={readouts.location} icon={MapPin} />
		</div>
	);
}
