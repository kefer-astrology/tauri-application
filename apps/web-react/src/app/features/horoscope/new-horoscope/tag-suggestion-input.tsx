import { ChoiceButton } from '@/app/components/ui/choice';
import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';

import { Input } from '@/app/components/ui/input';
import { InputGroupInput } from '@/app/components/ui/input-group';
import { cn } from '@/app/components/ui/utils';
import { formSelectContentClassName } from '@/app/components/ui/form-variants';
import { tagDefaultColor } from '@/lib/chartTags';
import type { WorkspaceTagDefinition } from '@/lib/tauri/types';

/** Tag text box with workspace-catalog suggestions. Enter, comma and blur commit the text;
 *  arrow keys move through the suggestions. */
export function TagSuggestionInput({
	id,
	value,
	onValueChange,
	onCommit,
	suggestions,
	selectedTags,
	placeholder,
	className,
	inputClassName,
	onBackspaceEmpty,
	embedded = false
}: {
	id?: string;
	value: string;
	onValueChange: (value: string) => void;
	onCommit: (value: string) => void;
	suggestions: WorkspaceTagDefinition[];
	selectedTags: string[];
	placeholder?: string;
	className?: string;
	inputClassName?: string;
	onBackspaceEmpty?: () => void;
	embedded?: boolean;
}) {
	const Field = embedded ? InputGroupInput : Input;
	const [focused, setFocused] = useState(false);
	const [activeIndex, setActiveIndex] = useState(0);
	const normalizedQuery = value.trim().toLocaleLowerCase();
	const options = suggestions
		.filter((suggestion) => !selectedTags.includes(suggestion.name))
		.filter(
			(suggestion) =>
				!normalizedQuery || suggestion.name.toLocaleLowerCase().includes(normalizedQuery)
		)
		.slice(0, 8);

	useEffect(() => setActiveIndex(0), [value]);

	const selectSuggestion = (name: string) => {
		onCommit(name);
		onValueChange('');
	};

	return (
		<div className={cn('relative min-w-0', focused && 'z-[80]', className)}>
			<Field
				variant={embedded ? 'default' : 'form'}
				id={id}
				value={value}
				onChange={(event) => {
					onValueChange(event.target.value);
					setFocused(true);
				}}
				onFocus={() => setFocused(true)}
				onBlur={() => {
					setFocused(false);
					if (value.trim()) onCommit(value);
				}}
				onKeyDown={(event) => {
					if (event.key === 'ArrowDown' && options.length > 0) {
						event.preventDefault();
						setActiveIndex((current) => (current + 1) % options.length);
						return;
					}
					if (event.key === 'ArrowUp' && options.length > 0) {
						event.preventDefault();
						setActiveIndex((current) => (current - 1 + options.length) % options.length);
						return;
					}
					if (event.key === 'Enter') {
						event.preventDefault();
						const suggestion = value.trim() ? options[activeIndex] : undefined;
						if (suggestion) selectSuggestion(suggestion.name);
						else if (value.trim()) onCommit(value);
						return;
					}
					if (event.key === ',') {
						event.preventDefault();
						if (value.trim()) onCommit(value);
						return;
					}
					if (event.key === 'Escape') {
						setFocused(false);
						return;
					}
					if (event.key === 'Backspace' && !value) onBackspaceEmpty?.();
				}}
				placeholder={placeholder}
				className={inputClassName}
				role="combobox"
				aria-autocomplete="list"
				aria-expanded={focused && options.length > 0}
			/>
			{focused && options.length > 0 && (
				<div
					role="listbox"
					className={cn(
						formSelectContentClassName,
						'absolute top-full right-0 left-0 z-[90] mt-1 max-h-52 overflow-y-auto p-1 opacity-100'
					)}
				>
					{options.map((suggestion, index) => (
						<ChoiceButton
							selected={index === activeIndex}
							key={suggestion.name}
							type="button"
							variant="row"
							role="option"

							onMouseDown={(event) => event.preventDefault()}
							onMouseEnter={() => setActiveIndex(index)}
							onClick={() => selectSuggestion(suggestion.name)}
							className="gap-2 px-3"
						>
							<span
								className="h-2.5 w-2.5 shrink-0 rounded-full"
								style={{ backgroundColor: suggestion.color ?? tagDefaultColor(index) }}
							/>
							<span className="truncate">{suggestion.name}</span>
							<Check
								className={cn(
									'ml-auto h-4 w-4',
									index === activeIndex ? 'opacity-100' : 'opacity-0'
								)}
							/>
						</ChoiceButton>
					))}
				</div>
			)}
		</div>
	);
}
