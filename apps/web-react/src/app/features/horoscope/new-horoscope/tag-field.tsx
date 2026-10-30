import { useState } from 'react';
import { Pencil, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/app/components/ui/utils';
import { tagColor } from '@/lib/chartTags';
import { mergeTags, parseTags } from '@/lib/newHoroscopeForm';
import type { WorkspaceTagDefinition } from '@/lib/tauri/types';
import { TagSuggestionInput } from './tag-suggestion-input';

/** Tag chips with an inline text box and a trailing button that opens the tag editor. */
export function TagField({
	tags,
	tagColors,
	suggestions,
	onChange,
	onOpenEditor,
	editorLabel,
	placeholder,
	iconClassName
}: {
	tags: string[];
	tagColors: Record<string, string>;
	suggestions: WorkspaceTagDefinition[];
	onChange: (tags: string[]) => void;
	onOpenEditor: () => void;
	editorLabel: string;
	placeholder?: string;
	iconClassName: string;
}) {
	const { t } = useTranslation();
	const [input, setInput] = useState('');

	const commit = (raw: string) => {
		const next = parseTags(raw);
		if (next.length > 0) onChange(mergeTags(tags, next));
		setInput('');
	};

	return (
		<div
			className={cn(
				'relative flex min-h-10 w-full items-stretch rounded-xl border text-base shadow-inner transition-all md:text-sm',
				'focus-within:border-ring focus-within:ring-ring/50 focus-within:z-[80] focus-within:ring-[3px]',
				'border-[color:var(--theme-panel-border)] bg-[color:var(--theme-panel-bg)] backdrop-blur-sm'
			)}
		>
			<div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 px-3 py-2">
				{tags.map((tag, index) => (
					<span
						key={tag}
						className={cn(
							'flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-medium',
							'bg-[color:var(--theme-selected-bg)] text-[color:var(--theme-content-primary)]'
						)}
					>
						<span
							className="h-2.5 w-2.5 rounded-full"
							style={{ backgroundColor: tagColor(tagColors, tag, index) }}
						/>
						{tag}
						<Button
							type="button"
							variant="ghost"
							size="icon"
							onClick={() => onChange(tags.filter((item) => item !== tag))}
							aria-label={t('remove_item', { label: tag })}
							className={cn(
								'ml-0.5 size-auto rounded-full p-0.5 transition-colors',
								'text-[color:var(--theme-content-muted)] hover:bg-transparent hover:text-[color:var(--theme-accent)]'
							)}
						>
							<X className="size-3" />
						</Button>
					</span>
				))}
				<TagSuggestionInput
					value={input}
					onValueChange={setInput}
					onCommit={commit}
					suggestions={suggestions}
					selectedTags={tags}
					onBackspaceEmpty={() => {
						if (tags.length > 0) onChange(tags.slice(0, -1));
					}}
					placeholder={tags.length === 0 ? placeholder : undefined}
					className="min-w-[8rem] flex-1"
					inputClassName={cn(
						'h-auto rounded-none border-0 bg-transparent px-0 py-0 text-base shadow-none md:text-sm',
						'focus:ring-0 dark:bg-transparent',
						'text-[color:var(--theme-content-primary)] placeholder:text-[color:var(--theme-content-muted)]'
					)}
				/>
			</div>
			<Button
				type="button"
				variant="ghost"
				onClick={onOpenEditor}
				className="h-auto min-h-10 self-stretch rounded-l-none rounded-r-xl border-l border-[color:var(--theme-panel-border)] px-3 shadow-none hover:bg-[color:var(--theme-soft-bg)]"
				aria-label={editorLabel}
			>
				<Pencil className={cn('h-4 w-4 shrink-0', iconClassName)} />
			</Button>
		</div>
	);
}
