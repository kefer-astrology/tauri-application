import { Search, X } from 'lucide-react';
import { Button } from './button';
import { Input } from './input';
import { cn } from './utils';

/**
 * Search box: icon + shared `Input` + clear button, in one bordered wrapper that carries the
 * focus glow (`focus-within`), per the compound-field rule in UI conventions.
 */
export function SearchField({
	value,
	onValueChange,
	placeholder,
	clearLabel,
	size = 'default',
	className
}: {
	value: string;
	onValueChange: (value: string) => void;
	placeholder?: string;
	/** Accessible name of the clear button. */
	clearLabel: string;
	size?: 'default' | 'sm';
	className?: string;
}) {
	const small = size === 'sm';
	return (
		<div
			className={cn(
				'flex items-center gap-3 rounded-xl border transition-all',
				'border-[color:var(--theme-panel-border)] bg-[color:var(--theme-panel-bg)] backdrop-blur-sm',
				'focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]',
				small ? 'gap-2 rounded-lg px-3 py-1' : 'px-4 py-1',
				className
			)}
		>
			<Search
				className={cn(
					'shrink-0 text-[color:var(--theme-content-muted)]',
					small ? 'size-3.5' : 'size-4'
				)}
			/>
			<Input
				// Plain text: a `search` input would add a second, native clear button.
				type="text"
				value={value}
				onChange={(event) => onValueChange(event.target.value)}
				placeholder={placeholder}
				className={cn(
					'h-8 flex-1 border-0 bg-transparent px-0 shadow-none focus:ring-0 dark:bg-transparent',
					'text-[color:var(--theme-content-secondary)] placeholder:text-[color:var(--theme-content-muted)]',
					small ? 'text-xs md:text-xs' : 'text-sm'
				)}
			/>
			{value && (
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="size-6 shrink-0 text-[color:var(--theme-content-muted)] hover:text-[color:var(--theme-content-primary)]"
					onClick={() => onValueChange('')}
					aria-label={clearLabel}
				>
					<X className="size-4" />
				</Button>
			)}
		</div>
	);
}
