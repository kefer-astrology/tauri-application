import { useEffect, useMemo, useState } from 'react';
import { Clock } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { ScrollArea } from './ui/scroll-area';
import { cn } from './ui/utils';

function pad(value: number): string {
	return value.toString().padStart(2, '0');
}

function formatTimeValue(value: Date): string {
	return `${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
}

function parseTimeValue(raw: string): { hour: number; minute: number; second: number } | null {
	const match = raw.trim().match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
	if (!match) return null;
	const hour = Number(match[1]);
	const minute = Number(match[2]);
	const second = Number(match[3] ?? '0');
	if (hour < 0 || hour > 23) return null;
	if (minute < 0 || minute > 59) return null;
	if (second < 0 || second > 59) return null;
	return { hour, minute, second };
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
	iconClassName?: string;
	panelClassName?: string;
};

export function TimeRollerPicker({
	id,
	label,
	value,
	onValueChange,
	labelClassName,
	iconClassName,
	panelClassName
}: TimeRollerPickerProps) {
	const [open, setOpen] = useState(false);
	const [draftValue, setDraftValue] = useState(() => formatTimeValue(value));

	const parts = useMemo(
		() => ({
			hour: value.getHours(),
			minute: value.getMinutes(),
			second: value.getSeconds()
		}),
		[value]
	);

	useEffect(() => {
		setDraftValue(formatTimeValue(value));
	}, [value]);

	const updatePart = (part: 'hour' | 'minute' | 'second', nextValue: number) => {
		const next = new Date(value);
		if (part === 'hour') next.setHours(nextValue);
		if (part === 'minute') next.setMinutes(nextValue);
		if (part === 'second') next.setSeconds(nextValue);
		onValueChange(next);
	};

	const commitDraftValue = () => {
		const parsed = parseTimeValue(draftValue);
		if (!parsed) {
			setDraftValue(formatTimeValue(value));
			return;
		}
		const next = new Date(value);
		next.setHours(parsed.hour, parsed.minute, parsed.second, 0);
		onValueChange(next);
	};

	return (
		<div className="flex flex-col gap-2">
			<Label htmlFor={id} className={cn('mb-1.5 block', labelClassName)}>
				{label}
			</Label>
			<Popover open={open} onOpenChange={setOpen}>
				<div
					className={cn(
						'flex min-h-10 w-full items-stretch overflow-hidden rounded-xl border text-base shadow-inner transition-all md:text-sm',
						'border-[color:var(--theme-panel-border)] bg-[color:var(--theme-panel-bg)] text-[color:var(--theme-content-primary)] backdrop-blur-sm',
						'focus-within:border-transparent focus-within:ring-2 focus-within:ring-[var(--theme-accent)]'
					)}
				>
					<Input
						id={id}
						type="text"
						inputMode="numeric"
						value={draftValue}
						onChange={(event) => setDraftValue(event.target.value)}
						onBlur={commitDraftValue}
						onKeyDown={(event) => {
							if (event.key === 'Enter') {
								commitDraftValue();
								setOpen(false);
							}
						}}
						className="h-full flex-1 rounded-none border-0 bg-transparent px-4 py-2.5 tabular-nums shadow-none focus-visible:ring-0"
						placeholder="HH:MM:SS"
						aria-label={label}
					/>
					<PopoverTrigger asChild>
						<Button
							type="button"
							variant="ghost"
							className="h-full rounded-none border-l border-[color:var(--theme-panel-border)] px-3 shadow-none hover:bg-[color:var(--theme-soft-bg)]"
							aria-label={label}
						>
							<Clock className={cn('h-4 w-4 shrink-0', iconClassName)} />
						</Button>
					</PopoverTrigger>
				</div>
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
			<div className="text-[color:var(--theme-content-muted)] text-center text-xs font-medium uppercase tracking-[0.14em]">
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
