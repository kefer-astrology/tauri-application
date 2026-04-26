import { useMemo, useState } from 'react';
import { Clock } from 'lucide-react';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { ScrollArea } from './ui/scroll-area';
import { cn } from './ui/utils';

function pad(value: number): string {
	return value.toString().padStart(2, '0');
}

function buildRange(count: number): number[] {
	return Array.from({ length: count }, (_, index) => index);
}

const HOURS = buildRange(24);
const MINUTES = buildRange(60);
const SECONDS = buildRange(60);

type TimeRollerPickerProps = {
	id?: string;
	label: string;
	value: Date;
	onValueChange: (value: Date) => void;
	labelClassName?: string;
	triggerClassName?: string;
	iconClassName?: string;
	panelClassName?: string;
};

export function TimeRollerPicker({
	id,
	label,
	value,
	onValueChange,
	labelClassName,
	triggerClassName,
	iconClassName,
	panelClassName
}: TimeRollerPickerProps) {
	const [open, setOpen] = useState(false);

	const parts = useMemo(
		() => ({
			hour: value.getHours(),
			minute: value.getMinutes(),
			second: value.getSeconds()
		}),
		[value]
	);

	const updatePart = (part: 'hour' | 'minute' | 'second', nextValue: number) => {
		const next = new Date(value);
		if (part === 'hour') next.setHours(nextValue);
		if (part === 'minute') next.setMinutes(nextValue);
		if (part === 'second') next.setSeconds(nextValue);
		onValueChange(next);
	};

	return (
			<div className="flex flex-col gap-2">
			<Label htmlFor={id} className={cn('mb-1.5 block', labelClassName)}>
				{label}
			</Label>
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<Button
						type="button"
						id={id}
						variant="outline"
						className={cn(
							'h-10 w-full justify-between font-mono tabular-nums shadow-inner',
							triggerClassName
						)}
					>
						<span>{`${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`}</span>
						<Clock className={cn('h-4 w-4 shrink-0', iconClassName)} />
					</Button>
				</PopoverTrigger>
				<PopoverContent align="start" className={cn('w-[280px] p-3', panelClassName)}>
					<div className="grid grid-cols-3 gap-3">
						<TimeColumn
							label="Hour"
							values={HOURS}
							selected={parts.hour}
							onSelect={(nextHour) => updatePart('hour', nextHour)}
						/>
						<TimeColumn
							label="Minute"
							values={MINUTES}
							selected={parts.minute}
							onSelect={(nextMinute) => updatePart('minute', nextMinute)}
						/>
						<TimeColumn
							label="Second"
							values={SECONDS}
							selected={parts.second}
							onSelect={(nextSecond) => updatePart('second', nextSecond)}
						/>
					</div>
				</PopoverContent>
			</Popover>
		</div>
	);
}

function TimeColumn({
	label,
	values,
	selected,
	onSelect
}: {
	label: string;
	values: number[];
	selected: number;
	onSelect: (value: number) => void;
}) {
	return (
		<div className="space-y-2">
			<div className="text-muted-foreground text-center text-xs font-medium uppercase tracking-[0.14em]">
				{label}
			</div>
			<ScrollArea className="h-56 rounded-lg border">
				<div className="space-y-1 p-1">
					{values.map((value) => {
						const isSelected = value === selected;
						return (
							<Button
								key={value}
								type="button"
								variant={isSelected ? 'default' : 'ghost'}
								className="h-9 w-full justify-center font-mono tabular-nums"
								onClick={() => onSelect(value)}
							>
								{pad(value)}
							</Button>
						);
					})}
				</div>
			</ScrollArea>
		</div>
	);
}
