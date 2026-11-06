import { useTranslation } from 'react-i18next';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/app/components/ui/select';
import {
	MultiSelectPopover,
	type MultiSelectPopoverItem
} from '@/app/views/data/multi-select-popover';
import { ObjectGlyph } from '@/app/views/domain/object-glyph';
import { ORB_PRESETS, type OrbPreset } from '@/lib/astrology/aspectarium';
import { ASPECT_GLYPHS, ASPECT_ROWS } from '@/lib/astrology/aspects';
import { AstrologyGlyph } from '@/ui/astrology-glyph';
import { useAspectarium } from './aspectarium-context';
import { useAspectariumLabels } from './use-aspectarium-labels';

/** The filters every Aspectarium widget shares: bodies, aspect types and the orb. */
export function AspectariumFilters() {
	const { t } = useTranslation();
	const { data, bodyIds, setBodyIds, aspectTypes, setAspectTypes, orbPreset, setOrbPreset } =
		useAspectarium();
	const labels = useAspectariumLabels();
	const popoverLabels = (all: string, search: string) => ({
		all,
		none: t('aspectarium_none_selected'),
		selectedCount: (count: number) => t('aspectarium_selected_count', { count }),
		search,
		clearSearch: t('clear'),
		selectAll: t('aspectarium_select_all'),
		clearAll: t('aspectarium_clear_all'),
		noResults: t('open_search_no_results')
	});
	const bodyItems: MultiSelectPopoverItem[] = data.availableBodyIds.map((id) => ({
		id,
		label: labels.bodyLabel(id),
		icon: <ObjectGlyph id={id} size={18} color={labels.bodyColor(id)} />
	}));
	const aspectItems: MultiSelectPopoverItem[] = ASPECT_ROWS.map((aspect) => ({
		id: aspect.id,
		label: t(aspect.labelKey),
		icon: (
			<AstrologyGlyph
				glyphId={aspect.id}
				domain="aspect"
				fallback={ASPECT_GLYPHS[aspect.id] ?? '•'}
				size={16}
			/>
		),
		color: labels.aspectColor(aspect.id)
	}));

	return (
		<>
			<MultiSelectPopover
				items={bodyItems}
				selected={bodyIds as Set<string>}
				onSelectedChange={setBodyIds}
				labels={popoverLabels(t('aspectarium_all_planets'), t('aspectarium_search_planets'))}
			/>
			<MultiSelectPopover
				items={aspectItems}
				selected={aspectTypes as Set<string>}
				onSelectedChange={setAspectTypes}
				labels={popoverLabels(t('aspectarium_all_aspects'), t('aspectarium_search_aspects'))}
			/>
			<Select value={orbPreset} onValueChange={(value) => setOrbPreset(value as OrbPreset)}>
				<SelectTrigger variant="form" className="h-9 min-h-9 w-auto min-w-36 py-1">
					<SelectValue />
				</SelectTrigger>
				<SelectContent variant="form">
					{ORB_PRESETS.map((preset) => (
						<SelectItem variant="form" key={preset.id} value={preset.id}>
							{t('label_orb')}: {t(preset.labelKey)}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</>
	);
}
