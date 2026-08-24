import { useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { AstrologyGlyph } from '@/ui/astrology-glyph';
import { normalizeGlyphId, ZODIAC_IDS, type AstrologyGlyphSetId } from '@/lib/astrology/glyphs';
import {
	OBSERVABLE_OBJECTS,
	OBSERVABLE_OBJECT_CATEGORY_LABELS,
	getObservableCategoryLabel,
	getObservableObjectLabel,
	type ObservableObjectCategory
} from '@/lib/astrology/observableObjects';
import { ASPECT_ROWS, ASPECT_GLYPHS } from '@/lib/astrology/aspects';
import { resetCustomGlyph, setCustomGlyph, useCustomGlyphOverrides } from '@/lib/astrology/customGlyphs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { Button } from './ui/button';

type GlyphDomain = 'planet' | 'zodiac' | 'aspect';

type GlyphManagerRowData = { id: string; label: string; domain: GlyphDomain; fallback: string };

type GlyphManagerGroup = { key: string; label: string; rows: GlyphManagerRowData[] };

/** Exotic/large groups collapsed by default, mirroring `BodySelector`. */
const COLLAPSED_BY_DEFAULT = new Set<string>([
	'asteroids',
	'sensitive_points',
	'geocentric_nodes',
	'trans_neptunian',
	'fixed_stars',
	'hypothetical'
]);

function titleCase(id: string): string {
	return id
		.split('_')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');
}

function useGlyphManagerGroups(): GlyphManagerGroup[] {
	const { t } = useTranslation();

	const zodiacGroup: GlyphManagerGroup = {
		key: 'zodiac',
		label: t('observable_category_zodiac', { defaultValue: 'Zodiac Signs' }),
		rows: ZODIAC_IDS.map((id) => ({
			id,
			label: titleCase(id),
			domain: 'zodiac' as const,
			fallback: id.slice(0, 2).toUpperCase()
		}))
	};

	const bodyCategories = Object.keys(OBSERVABLE_OBJECT_CATEGORY_LABELS) as ObservableObjectCategory[];
	const bodyGroups: GlyphManagerGroup[] = bodyCategories.map((category) => ({
		key: category,
		label: getObservableCategoryLabel(category, t),
		rows: OBSERVABLE_OBJECTS.filter((item) => item.category === category).map((item) => ({
			id: item.id,
			label: getObservableObjectLabel(item, t),
			domain: 'planet' as const,
			fallback: item.icon
		}))
	}));

	const aspectGroup: GlyphManagerGroup = {
		key: 'aspects',
		label: t('observable_category_aspects', { defaultValue: 'Aspects' }),
		rows: ASPECT_ROWS.map((row) => ({
			id: row.id,
			label: t(row.labelKey, { defaultValue: titleCase(row.id) }),
			domain: 'aspect' as const,
			fallback: ASPECT_GLYPHS[row.id] ?? row.id.slice(0, 3)
		}))
	};

	return [zodiacGroup, ...bodyGroups, aspectGroup].filter((group) => group.rows.length > 0);
}

function GlyphManagerRow({
	row,
	glyphSet,
	isCustom
}: {
	row: GlyphManagerRowData;
	glyphSet: AstrologyGlyphSetId;
	isCustom: boolean;
}) {
	const [error, setError] = useState<string | null>(null);

	function handleUpload(event: ChangeEvent<HTMLInputElement>) {
		const file = event.target.files?.[0];
		event.target.value = '';
		if (!file) return;
		if (!file.name.toLowerCase().endsWith('.svg') && file.type !== 'image/svg+xml') {
			setError('Please upload an SVG file');
			return;
		}
		setError(null);
		const reader = new FileReader();
		reader.onload = (loadEvent) => {
			const svg = loadEvent.target?.result;
			if (typeof svg === 'string') {
				setCustomGlyph(row.id, row.label, svg, file.name);
			}
		};
		reader.onerror = () => setError('Failed to read file');
		reader.readAsText(file);
	}

	return (
		<div className="flex min-w-[240px] grow basis-[260px] items-center justify-between gap-2 rounded-lg border border-[color:var(--theme-panel-border)] p-2">
			<div className="flex min-w-0 items-center gap-2">
				<AstrologyGlyph
					glyphId={row.id}
					glyphSet={glyphSet}
					domain={row.domain}
					fallback={row.fallback}
					size={22}
				/>
				<span className="truncate text-sm">{row.label}</span>
				{isCustom ? (
					<span className="text-xs text-[color:var(--theme-content-muted)]">(custom)</span>
				) : null}
			</div>
			<div className="flex shrink-0 items-center gap-1">
				<label className="cursor-pointer">
					<input type="file" accept=".svg,image/svg+xml" className="hidden" onChange={handleUpload} />
					<Button variant="ghost" size="sm" type="button" asChild>
						<span>Upload</span>
					</Button>
				</label>
				{isCustom ? (
					<Button
						variant="ghost"
						size="sm"
						type="button"
						onClick={() => resetCustomGlyph(row.id)}
					>
						Reset
					</Button>
				) : null}
			</div>
			{error ? <p className="w-full text-xs text-red-500">{error}</p> : null}
		</div>
	);
}

export function GlyphManager({ glyphSet }: { glyphSet: AstrologyGlyphSetId }) {
	const groups = useGlyphManagerGroups();
	const overrides = useCustomGlyphOverrides();
	const defaultOpen = groups.map((g) => g.key).filter((key) => !COLLAPSED_BY_DEFAULT.has(key));

	return (
		<div className="space-y-2">
			<p className="text-xs text-[color:var(--theme-content-muted)]">
				Upload a custom SVG to replace any glyph below. Uploads are stored on this device only.
			</p>
			<Accordion type="multiple" defaultValue={defaultOpen} className="w-full">
				{groups.map((group) => (
					<AccordionItem key={group.key} value={group.key}>
						<AccordionTrigger>{group.label}</AccordionTrigger>
						<AccordionContent>
							<div className="flex flex-wrap gap-2 pt-1">
								{group.rows.map((row) => (
									<GlyphManagerRow
										key={row.id}
										row={row}
										glyphSet={glyphSet}
										isCustom={Boolean(overrides[normalizeGlyphId(row.id)])}
									/>
								))}
							</div>
						</AccordionContent>
					</AccordionItem>
				))}
			</Accordion>
		</div>
	);
}
