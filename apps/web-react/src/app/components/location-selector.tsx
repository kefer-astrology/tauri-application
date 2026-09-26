import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, MapPin } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Popover, PopoverAnchor, PopoverContent } from './ui/popover';
import { ScrollArea } from './ui/scroll-area';
import { cn } from './ui/utils';
import type { ResolvedLocation } from '@/lib/tauri/types';

type LocationSelectorProps = {
	id?: string;
	value: string;
	onValueChange: (value: string) => void;
	options?: string[];
	placeholder: string;
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

/** Direct-search location field: the field itself is the search box, and matches drop down
 *  underneath as the user types (no separate trigger/dialog indirection). Shared by every
 *  location input in the app (new chart, synastry participants, default location in settings). */
export function LocationSelector({
	id,
	value,
	onValueChange,
	options = [],
	placeholder,
	emptyLabel,
	disabled = false,
	className,
	iconClassName,
	searchLocations,
	onResolvedLocationSelect,
	loadingLabel = 'Searching...'
}: LocationSelectorProps) {
	const [open, setOpen] = useState(false);
	const [searchResults, setSearchResults] = useState<ResolvedLocation[]>([]);
	const [isSearching, setIsSearching] = useState(false);
	const anchorRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open || !searchLocations) {
			setSearchResults([]);
			setIsSearching(false);
			return;
		}

		const trimmedQuery = value.trim();
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
	}, [open, value, searchLocations]);

	const normalizedQuery = normalize(value);

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

	const hasAnyResults = visibleSearchResults.length > 0 || filteredOptions.length > 0;

	return (
		<Popover open={open} onOpenChange={(next) => !disabled && setOpen(next)}>
			<PopoverAnchor asChild>
				<div ref={anchorRef} className="relative">
					<MapPin
						className={cn(
							'pointer-events-none absolute top-1/2 left-3 z-10 h-4 w-4 -translate-y-1/2 opacity-50',
							iconClassName
						)}
					/>
					<Input
						id={id}
						value={value}
						onChange={(event) => onValueChange(event.target.value)}
						onFocus={() => !disabled && setOpen(true)}
						onKeyDown={(event) => {
							if (event.key === 'Escape') {
								setOpen(false);
								event.currentTarget.blur();
							}
						}}
						placeholder={placeholder}
						disabled={disabled}
						autoComplete="off"
						className={cn('h-10 w-full shadow-inner', className, 'pl-9')}
					/>
				</div>
			</PopoverAnchor>
			<PopoverContent
				className="w-[max(var(--radix-popover-trigger-width),22rem)] max-w-[min(32rem,calc(100vw-2rem))] border-[color:var(--theme-panel-border)] bg-[color:var(--theme-panel-bg)] p-2 text-[color:var(--theme-content-primary)] backdrop-blur-sm"
				align="start"
				sideOffset={6}
				onOpenAutoFocus={(event) => event.preventDefault()}
				onInteractOutside={(event) => {
					// Radix only exempts `PopoverTrigger` clicks from auto-dismiss; since this field
					// opens the popover itself (via `PopoverAnchor`, not `Trigger`), we exempt it here.
					if (anchorRef.current?.contains(event.target as Node)) event.preventDefault();
				}}
			>
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
							<div className="py-6 text-center text-sm text-[color:var(--theme-content-muted)]">
								{isSearching ? loadingLabel : emptyLabel}
							</div>
						) : null}
					</div>
				</ScrollArea>
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
