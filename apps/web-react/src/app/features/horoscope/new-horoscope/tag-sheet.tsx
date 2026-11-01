import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/app/components/ui/button';
import { ColorInput } from '@/app/components/ui/color-input';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle
} from '@/app/components/ui/sheet';
import { cn } from '@/app/components/ui/utils';
import { useAppFormFieldTheme } from '@/app/components/form-field-theme';
import { tagColor } from '@/lib/chartTags';
import { mergeTags, parseTags } from '@/lib/newHoroscopeForm';
import type { WorkspaceTagDefinition } from '@/lib/tauri/types';
import { TagSuggestionInput } from './tag-suggestion-input';

/** Side sheet for the chart's tags: add several at once, rename, recolor, remove. */
export function TagSheet({
	open,
	onOpenChange,
	tags,
	tagColors,
	suggestions,
	onChange,
	onRename,
	onColorChange
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	tags: string[];
	tagColors: Record<string, string>;
	suggestions: WorkspaceTagDefinition[];
	onChange: (tags: string[]) => void;
	onRename: (tag: string, nextName: string) => void;
	onColorChange: (tag: string, color: string) => void;
}) {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme();
	const [draft, setDraft] = useState('');
	const [draftNames, setDraftNames] = useState<Record<string, string>>({});

	useEffect(() => {
		if (!open) return;
		setDraftNames(Object.fromEntries(tags.map((tag) => [tag, tag])));
	}, [open, tags]);

	const addDraftTags = (raw = draft) => {
		const next = parseTags(raw);
		if (next.length === 0) return;
		onChange(mergeTags(tags, next));
		setDraft('');
	};

	const commitTagName = (tag: string) => {
		const nextName = (draftNames[tag] ?? tag).trim();
		if (!nextName || nextName === tag) {
			setDraftNames((prev) => ({ ...prev, [tag]: tag }));
			return;
		}
		onRename(tag, nextName);
	};

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				side="right"
				className={cn(
					'w-full gap-0 p-0 sm:max-w-md',
					'border-[color:var(--theme-panel-border)] shadow-2xl',
					'bg-[color:var(--theme-panel-bg-solid)] text-[color:var(--theme-content-primary)]'
				)}
			>
				<div className="flex h-full min-h-0 flex-col">
					<SheetHeader className="shrink-0 px-5 py-4">
						<SheetTitle className={cn('text-lg font-semibold', ft.title)}>
							{t('new_tags')}
						</SheetTitle>
						<SheetDescription className={cn('text-sm', ft.muted)}>
							{t('new_tags_comma_hint')}
						</SheetDescription>
					</SheetHeader>

					<div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
						<div className="space-y-2">
							<Label htmlFor="advanced-tags" className={ft.label}>
								{t('new_tags')}
							</Label>
							<div className="flex items-start gap-2">
								<TagSuggestionInput
									id="advanced-tags"
									value={draft}
									onValueChange={setDraft}
									onCommit={addDraftTags}
									suggestions={suggestions}
									selectedTags={tags}
									placeholder={t('placeholder_tags_example')}
									className="flex-1"
									inputClassName={cn(ft.input, 'h-auto shadow-inner')}
								/>
								<Button
									type="button"
									size="icon"
									className={cn(ft.footerPrimary, 'h-10 w-10 flex-none rounded-xl')}
									onClick={() => addDraftTags()}
									aria-label={t('new_tags')}
								>
									<Plus className="h-4 w-4" />
								</Button>
							</div>
						</div>

						<div className="space-y-2">
							<div className={cn('text-sm font-medium', ft.label)}>{t('table_tags')}</div>
							{tags.length > 0 ? (
								<div className="space-y-2">
									{tags.map((tag, index) => (
										<div
											key={tag}
											className={cn(
												'flex items-center gap-2 rounded-xl border px-3 py-2',
												'border-[color:var(--theme-panel-border)] bg-[color:var(--theme-soft-bg)]'
											)}
										>
											<ColorInput
												value={tagColor(tagColors, tag, index)}
												onChange={(event) => onColorChange(tag, event.currentTarget.value)}
												className="h-8 w-9 rounded-lg"
												aria-label={`${t('new_tags')} ${tag}`}
											/>
											<Input
												value={draftNames[tag] ?? tag}
												onChange={(event) =>
													setDraftNames((prev) => ({ ...prev, [tag]: event.target.value }))
												}
												onBlur={() => commitTagName(tag)}
												onKeyDown={(event) => {
													if (event.key === 'Enter') {
														event.preventDefault();
														commitTagName(tag);
													}
													if (event.key === 'Escape') {
														setDraftNames((prev) => ({ ...prev, [tag]: tag }));
													}
												}}
												className={cn(ft.input, 'h-8 min-w-0 flex-1 rounded-lg shadow-inner')}
												aria-label={`${t('new_tags')} ${tag}`}
											/>
											<Button
												type="button"
												variant="ghost"
												size="icon"
												className={cn('h-8 w-8 flex-none rounded-lg', ft.muted)}
												onClick={() => onChange(tags.filter((item) => item !== tag))}
												aria-label={t('remove_item', { label: tag })}
											>
												<X className="h-4 w-4" />
											</Button>
										</div>
									))}
								</div>
							) : (
								<div className={cn('rounded-xl border border-dashed px-3 py-4 text-sm', ft.muted)}>
									{t('placeholder_tags_example')}
								</div>
							)}
						</div>
					</div>

					<SheetFooter className="shrink-0 border-t border-[color:var(--theme-panel-border)] px-5 py-4">
						<Button
							type="button"
							variant="outline"
							className={cn(ft.footerCancel, '!flex-none')}
							onClick={() => onOpenChange(false)}
						>
							{t('button_close')}
						</Button>
					</SheetFooter>
				</div>
			</SheetContent>
		</Sheet>
	);
}
