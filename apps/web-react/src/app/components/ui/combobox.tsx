import { useMemo, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from './command';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { cn } from './utils';

/**
 * Searchable single select over a long list of strings: a select-like trigger opening a
 * filtered list. Shows at most `limit` matches; typing narrows the list.
 */
export function Combobox({
	value,
	onValueChange,
	options,
	placeholder,
	emptyLabel,
	limit = 120,
	triggerClassName,
	contentClassName,
	itemClassName
}: {
	value: string;
	onValueChange: (value: string) => void;
	options: readonly string[];
	/** Shown in the empty trigger and the search box. */
	placeholder: string;
	emptyLabel: string;
	limit?: number;
	triggerClassName?: string;
	contentClassName?: string;
	itemClassName?: string;
}) {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState('');

	const filtered = useMemo(() => {
		const query = search.trim().toLowerCase();
		const matches = query
			? options.filter((option) => option.toLowerCase().includes(query))
			: options;
		return matches.slice(0, limit);
	}, [options, search, limit]);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					role="combobox"
					aria-expanded={open}
					className={cn(
						'flex h-auto min-h-10 w-full items-center justify-between gap-2 text-left',
						triggerClassName
					)}
				>
					<span className={value ? '' : 'opacity-50'}>{value || placeholder}</span>
					<ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
				</button>
			</PopoverTrigger>
			<PopoverContent
				className={cn('w-[var(--radix-popover-trigger-width)] p-0', contentClassName)}
				align="end"
			>
				<Command className="bg-transparent text-[color:var(--theme-content-primary)]">
					<CommandInput
						value={search}
						onValueChange={setSearch}
						placeholder={placeholder}
						className="text-[color:var(--theme-content-primary)] placeholder:text-[color:var(--theme-content-muted)]"
					/>
					<CommandList>
						{filtered.length === 0 && <CommandEmpty>{emptyLabel}</CommandEmpty>}
						{filtered.map((option) => (
							<CommandItem
								key={option}
								value={option}
								onSelect={() => {
									onValueChange(option);
									setOpen(false);
									setSearch('');
								}}
								className={cn(
									'data-[selected=true]:bg-[color:var(--theme-soft-bg)] data-[selected=true]:text-[color:var(--theme-content-primary)]',
									itemClassName
								)}
							>
								<Check
									className={cn('mr-2 h-4 w-4', value === option ? 'opacity-100' : 'opacity-0')}
								/>
								{option}
							</CommandItem>
						))}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
