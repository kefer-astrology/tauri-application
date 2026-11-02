import { Chip } from '@/app/components/ui/choice';
import { InputGroup, InputGroupButton } from '@/app/components/ui/input-group';
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
		<InputGroup className="relative overflow-visible focus-within:z-[80]">
			<div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 px-3 py-2">
				{tags.map((tag, index) => (
					<Chip selected key={tag} className="border-0 py-0.5 text-sm">
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
					</Chip>
				))}
				<TagSuggestionInput
					embedded
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
					inputClassName="h-auto px-0 py-0 text-base md:text-sm"
				/>
			</div>
			<InputGroupButton
				type="button"
				onClick={onOpenEditor}
				className="h-auto min-h-10 self-stretch rounded-r-xl"
				aria-label={editorLabel}
			>
				<Pencil className={cn('h-4 w-4 shrink-0', iconClassName)} />
			</InputGroupButton>
		</InputGroup>
	);
}
