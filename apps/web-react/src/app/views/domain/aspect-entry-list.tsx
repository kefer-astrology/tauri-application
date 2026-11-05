import { ChoiceButton } from '@/app/components/ui/choice';
import { Text } from '@/app/components/ui/typography';
import { ASPECT_GLYPHS } from '@/lib/astrology/aspects';
import { formatOrb, type AspectEntry } from '@/lib/astrology/aspectarium';
import { AstrologyGlyph } from '@/ui/astrology-glyph';

/** Aspects as rows: glyph, the two bodies, the aspect name and its orb. */
export function AspectEntryList({
	entries,
	selectedId,
	onSelect,
	bodyLabel,
	aspectLabel,
	aspectColor,
	emptyText
}: {
	entries: readonly AspectEntry[];
	selectedId: string | null;
	onSelect: (entryId: string) => void;
	bodyLabel: (id: string) => string;
	aspectLabel: (type: string) => string;
	aspectColor: (type: string) => string;
	emptyText: string;
}) {
	if (entries.length === 0) {
		return (
			<Text variant="body" tone="muted" className="px-6 py-16 text-center">
				{emptyText}
			</Text>
		);
	}
	return (
		<div>
			{entries.map((entry) => (
				<ChoiceButton
					selected={selectedId === entry.id}
					key={entry.id}
					type="button"
					variant="row"
					className="rounded-none border-b border-[color:var(--theme-panel-border)] px-5 py-3.5"
					onClick={() => onSelect(entry.id)}
				>
					<span
						className="flex w-8 shrink-0 items-center justify-center text-2xl"
						style={{ color: aspectColor(entry.aspect.type) }}
					>
						<AstrologyGlyph
							glyphId={entry.aspect.type}
							domain="aspect"
							fallback={ASPECT_GLYPHS[entry.aspect.type] ?? '•'}
							size={22}
						/>
					</span>
					<span className="min-w-0 flex-1">
						<Text variant="label" as="span" tone="primary" className="block truncate">
							{bodyLabel(entry.aspect.from)} — {bodyLabel(entry.aspect.to)}
						</Text>
						<Text variant="caption" as="span" tone="muted" className="block">
							{aspectLabel(entry.aspect.type)}
						</Text>
					</span>
					<Text variant="body" as="span" tone="muted" className="shrink-0 font-mono">
						{formatOrb(entry.aspect.orb)}
					</Text>
				</ChoiceButton>
			))}
		</div>
	);
}
