import { AstrologyGlyph } from '@/ui/astrology-glyph';
import { Text } from '@/app/components/ui/typography';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger
} from '@/app/components/ui/accordion';
import { Button } from '@/app/components/ui/button';
import { SegmentedControl } from '@/app/components/ui/segmented-control';
import { cn } from '@/app/components/ui/utils';
import { useAppFormFieldTheme } from '@/app/components/form-field-theme';
import {
	SelectionList,
	type SelectionListGroup,
	type SelectionListItem
} from '@/app/views/data/selection-list';
import { ASPECT_GLYPHS, ASPECT_ROWS, type AspectRowId } from '@/lib/astrology/aspects';

type AspectRow = (typeof ASPECT_ROWS)[number];
type AspectItem = SelectionListItem & { row: AspectRow };
type ViewMode = 'type' | 'harmonic';

const PRESETS: { key: string; aspectIds: AspectRowId[] }[] = [
	{ key: 'traditional', aspectIds: ['conjunction', 'sextile', 'square', 'trine', 'opposition'] },
	{
		key: 'modern',
		aspectIds: [
			'conjunction',
			'sextile',
			'square',
			'trine',
			'opposition',
			'quincunx',
			'semisextile',
			'octile',
			'trioctile'
		]
	},
	{ key: 'transits', aspectIds: ['conjunction', 'sextile', 'square', 'trine', 'opposition'] },
	{ key: 'stars', aspectIds: ['conjunction'] },
	{
		key: 'harmonic',
		aspectIds: ['quintile', 'biquintile', 'septile', 'novile', 'binovile', 'quadrinovile']
	}
];

/** Aspect angle as degrees, with arc minutes for fractional angles (e.g. `51°26'`). */
export function formatAspectAngle(angle: number): string {
	const rounded = Math.round(angle * 100) / 100;
	if (Number.isInteger(rounded)) return `${rounded}°`;
	const whole = Math.floor(rounded);
	const minutes = Math.round((rounded - whole) * 60);
	return `${whole}°${minutes.toString().padStart(2, '0')}'`;
}

/**
 * Aspect catalog as a searchable multi-select, viewed by type (major / minor) or by harmonic
 * series, with selection presets.
 */
export function AspectList({
	selectedIds,
	onSelectedIdsChange
}: {
	selectedIds: string[];
	onSelectedIdsChange: (ids: string[]) => void;
}) {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme();
	const [viewMode, setViewMode] = useState<ViewMode>('type');

	const groups = useMemo<SelectionListGroup<AspectItem>[]>(() => {
		const harmonicLabel = (harmonic: number) =>
			t('transits_aspects_harmonic_series', { n: harmonic });
		const toItem = (row: AspectRow): AspectItem => ({
			id: row.id,
			label: t(row.labelKey, { defaultValue: row.fallbackLabel }),
			searchTerms: [formatAspectAngle(row.angle), harmonicLabel(row.harmonic)],
			row
		});
		if (viewMode === 'type') {
			return (['major', 'minor'] as const).map((type) => ({
				id: type,
				label: t(`transits_aspects_${type}`),
				items: ASPECT_ROWS.filter((row) => row.type === type).map(toItem)
			}));
		}
		const harmonics = Array.from(new Set(ASPECT_ROWS.map((row) => row.harmonic))).sort(
			(a, b) => a - b
		);
		return harmonics.map((harmonic) => ({
			id: `h${harmonic}`,
			label: harmonicLabel(harmonic),
			items: ASPECT_ROWS.filter((row) => row.harmonic === harmonic).map(toItem)
		}));
	}, [t, viewMode]);

	return (
		<SelectionList
			groups={groups}
			selectedIds={selectedIds}
			onSelectedIdsChange={onSelectedIdsChange}
			layout={viewMode === 'type' ? 'sections' : 'accordion'}
			headerStart={
				<div className="flex items-center gap-3">
					<Text variant="compactLabel" as="span" tone="muted">
						{t('transits_aspects_view_label')}
					</Text>
					<SegmentedControl
						value={viewMode}
						options={[
							{ value: 'type', label: t('transits_aspects_view_type') },
							{ value: 'harmonic', label: t('transits_aspects_view_harmonic') }
						]}
						onValueChange={setViewMode}
						ariaLabel={t('transits_aspects_view_label')}
					/>
				</div>
			}
			labels={{
				search: t('aspectarium_search_aspects'),
				clearSearch: t('clear'),
				selectedCount: (count) => t('aspectarium_selected_count', { count }),
				clearAll: t('aspectarium_clear_all'),
				noResults: t('open_search_no_results'),
				panelTitle: t('transits_aspects_panel_title'),
				panelEmpty: t('transits_aspects_empty_title'),
				panelEmptyHint: t('transits_aspects_empty_hint'),
				remove: (label) => t('remove_item', { label })
			}}
			renderItem={(item, { highlight }) => (
				<>
					<span className={cn('flex w-8 shrink-0 items-center justify-center', ft.iconColor)}>
						<AstrologyGlyph
							glyphId={item.id}
							domain="aspect"
							fallback={ASPECT_GLYPHS[item.id] ?? '•'}
							size={18}
						/>
					</span>
					<Text variant="body" as="span" tone="secondary" className="flex-1">
						{highlight(item.label)}
					</Text>
					<Text
						variant="caption"
						as="span"
						tone="muted"
						className="w-16 shrink-0 text-right tabular-nums"
					>
						{formatAspectAngle(item.row.angle)}
					</Text>
					{item.row.type === 'minor' && (
						<Text variant="caption" as="span" tone="muted" className="w-32 shrink-0 text-right">
							{t('transits_aspects_harmonic_series', { n: item.row.harmonic })}
						</Text>
					)}
				</>
			)}
			renderPanelMeta={(item) => formatAspectAngle(item.row.angle)}
			footer={
				<Accordion
					type="single"
					collapsible
					className="mt-6 w-full border-t border-[color:var(--theme-panel-border)] pt-2"
				>
					<AccordionItem value="presets" className="border-0">
						<AccordionTrigger className="py-2.5 hover:no-underline">
							<Text variant="body" as="span" tone="primary" className="font-semibold">
								{t('transits_aspects_presets_title')}
							</Text>
						</AccordionTrigger>
						<AccordionContent>
							<div className="divide-y divide-[color:var(--theme-panel-border)]">
								{PRESETS.map((preset) => (
									<div key={preset.key} className="flex items-center justify-between gap-4 py-3">
										<div>
											<div className={cn('text-sm font-medium', ft.bodyText)}>
												{t(`transits_aspects_preset_${preset.key}_name`)}
											</div>
											<div className={cn('mt-0.5 text-xs', ft.muted)}>
												{t(`transits_aspects_preset_${preset.key}_desc`)}
											</div>
										</div>
										<Button
											type="button"
											variant="ghost"
											size="sm"
											onClick={() => onSelectedIdsChange(preset.aspectIds)}
											className={cn('shrink-0 text-xs', ft.iconColor)}
										>
											{t('transits_aspects_apply_preset')}
										</Button>
									</div>
								))}
							</div>
						</AccordionContent>
					</AccordionItem>
				</Accordion>
			}
		/>
	);
}
