import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronsUpDown, MapPin } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { ScrollArea } from './ui/scroll-area';
import { cn } from './ui/utils';
import type { ResolvedLocation } from '@/lib/tauri/types';

type LocationSelectorProps = {
	id?: string;
	value: string;
	onValueChange: (value: string) => void;
	options?: string[];
	placeholder: string;
	searchPlaceholder: string;
	emptyLabel: string;
	disabled?: boolean;
	className?: string;
	iconClassName?: string;
	searchLocations?: (query: string) => Promise<ResolvedLocation[]>;
	onResolvedLocationSelect?: (location: ResolvedLocation) => void;
	loadingLabel?: string;
};

function normalize(value: string) {
	return value.trim().toLowerCase();
}

export function LocationSelector({
	id,
	value,
	onValueChange,
	options = [],
	placeholder,
	searchPlaceholder,
	emptyLabel,
	disabled = false,
	className,
	iconClassName,
	searchLocations,
	onResolvedLocationSelect,
	loadingLabel = 'Searching...'
}: LocationSelectorProps) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState(value);
	const [searchResults, setSearchResults] = useState<ResolvedLocation[]>([]);
	const [isSearching, setIsSearching] = useState(false);

	useEffect(() => {
		if (!open) setQuery(value);
	}, [open, value]);

	useEffect(() => {
		if (!open || !searchLocations) {
			setSearchResults([]);
			setIsSearching(false);
			return;
		}

		const trimmedQuery = query.trim();
		if (trimmedQuery.length < 2) {
			setSearchResults([]);
			setIsSearching(false);
			return;
		}

		let active = true;
		setIsSearching(true);
		const timeoutId = window.setTimeout(async () => {
			try {
				const results = await searchLocations(trimmedQuery);
				if (!active) return;
				setSearchResults(results);
			} catch {
				if (!active) return;
				setSearchResults([]);
			} finally {
				if (active) setIsSearching(false);
			}
		}, 250);

		return () => {
			active = false;
			window.clearTimeout(timeoutId);
		};
	}, [open, query, searchLocations]);

	const normalizedQuery = normalize(query);

	const uniqueOptions = useMemo(() => {
		const seen = new Set<string>();
		return options.filter((option) => {
			const key = normalize(option);
			if (!key || seen.has(key)) return false;
			seen.add(key);
			return true;
		});
	}, [options]);

	const filteredOptions = useMemo(() => {
		if (!normalizedQuery) return uniqueOptions;
		return uniqueOptions.filter((option) => normalize(option).includes(normalizedQuery));
	}, [normalizedQuery, uniqueOptions]);

	const visibleSearchResults = useMemo(() => {
		const localKeys = new Set(uniqueOptions.map((option) => normalize(option)));
		return searchResults.filter((result) => !localKeys.has(normalize(result.display_name)));
	}, [searchResults, uniqueOptions]);

	const showCustomOption =
		normalizedQuery.length > 0 &&
		!uniqueOptions.some((option) => normalize(option) === normalizedQuery) &&
		!visibleSearchResults.some((result) => normalize(result.display_name) === normalizedQuery);

	const hasAnyResults =
		visibleSearchResults.length > 0 || filteredOptions.length > 0 || showCustomOption;

	return (
		<Popover open={open} onOpenChange={(next) => !disabled && setOpen(next)}>
			<PopoverTrigger asChild>
				<Button
					id={id}
					type="button"
					variant="outline"
					role="combobox"
					aria-expanded={open}
					disabled={disabled}
					className={cn(
						'h-10 w-full justify-between text-left font-normal shadow-inner',
						className
					)}
				>
					<span className="flex min-w-0 items-center gap-2">
						<MapPin className={cn('h-4 w-4 shrink-0', iconClassName)} />
						<span className="truncate">{value.trim() || placeholder}</span>
					</span>
					<ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				className="w-[max(var(--radix-popover-trigger-width),22rem)] max-w-[min(32rem,calc(100vw-2rem))] p-2"
				align="start"
				sideOffset={6}
			>
				<div className="space-y-2">
					<Input
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder={searchPlaceholder}
						autoFocus
					/>
					<ScrollArea className="h-[240px] rounded-md border">
						<div className="space-y-1 p-1">
							{visibleSearchResults.map((result) => {
								const selected = normalize(result.display_name) === normalize(value);
								return (
									<OptionRow
										key={`${result.display_name}-${result.latitude}-${result.longitude}`}
										selected={selected}
										onSelect={() => {
											onValueChange(result.display_name);
											onResolvedLocationSelect?.(result);
											setOpen(false);
										}}
									>
										{result.display_name}
									</OptionRow>
								);
							})}
							{showCustomOption ? (
								<OptionRow
									selected={normalize(query) === normalize(value)}
									onSelect={() => {
										onValueChange(query.trim());
										setOpen(false);
									}}
								>
									{query.trim()}
								</OptionRow>
							) : null}
							{filteredOptions.map((option) => {
								const selected = normalize(option) === normalize(value);
								return (
									<OptionRow
										key={option}
										selected={selected}
										onSelect={() => {
											onValueChange(option);
											setOpen(false);
										}}
									>
										{option}
									</OptionRow>
								);
							})}
							{!hasAnyResults ? (
								<div className="text-muted-foreground py-6 text-center text-sm">
									{isSearching ? loadingLabel : emptyLabel}
								</div>
							) : null}
						</div>
					</ScrollArea>
				</div>
			</PopoverContent>
		</Popover>
	);
}

function OptionRow({
	children,
	selected,
	onSelect
}: {
	children: React.ReactNode;
	selected: boolean;
	onSelect: () => void;
}) {
	return (
		<Button
			type="button"
			variant="ghost"
			className={cn(
				'h-auto w-full justify-start gap-2 px-2 py-2 text-left text-sm whitespace-normal',
				selected && 'bg-accent text-accent-foreground'
			)}
			onClick={onSelect}
		>
			<Check className={cn('h-4 w-4 shrink-0', selected ? 'opacity-100' : 'opacity-0')} />
			<span className="min-w-0 flex-1">{children}</span>
		</Button>
	);
}
