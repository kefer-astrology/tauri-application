import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { objectLabel } from '@/lib/astrology/objectLabels';
import { getDefaultTransitBodyIds, useTransitsWorkspace } from '../providers/transits-workspace';
import { SecondaryNavPanel } from './secondary-nav-panel';
import type { Theme } from './astrology-sidebar';

interface TransitedObjectsNavProps {
	theme: Theme;
	dynamic?: boolean;
}

const ALL_ID = '__all__';

/** Left nav for the results dashboard — swaps in for `TransitsSecondarySidebar` once a series
 *  has been computed. Lists every selected fixed-anchor body ("Transited Bodies" tab, i.e.
 *  `transitedBodies` — see the naming note in transits-workspace.tsx) regardless of whether it
 *  actually has a detected aspect right now, so picking one and finding nothing is visibly "no
 *  hits for this anchor" rather than the anchor silently not being offered at all. Moving-to-moving
 *  pairs (no single fixed "to") only ever show under "All". */
export function TransitedObjectsNav({ theme, dynamic = false }: TransitedObjectsNavProps) {
	const { t } = useTranslation();
	const { transitedBodies, aspectTimelineSeries, selectedTransitedObjectId, setSelectedTransitedObjectId } =
		useTransitsWorkspace();

	const objectIds = useMemo(() => {
		const ids = new Set(transitedBodies);
		// Defensive fallback: if nothing is selected (shouldn't normally happen) but the series
		// still produced fixed-anchor pairs somehow, still offer navigation to them.
		if (ids.size === 0) {
			for (const s of aspectTimelineSeries) {
				if (s.kind === 'moving-fixed') ids.add(s.to);
			}
		}
		const preferred = getDefaultTransitBodyIds().filter((id) => ids.has(id));
		const rest = Array.from(ids)
			.filter((id) => !preferred.includes(id))
			.sort();
		return [...preferred, ...rest];
	}, [transitedBodies, aspectTimelineSeries]);

	const items = useMemo(
		() => [
			{ id: ALL_ID, label: t('transited_objects_nav_all', { defaultValue: 'All' }) },
			...objectIds.map((id) => ({ id, label: objectLabel(id, t) }))
		],
		[objectIds, t]
	);

	return (
		<SecondaryNavPanel
			theme={theme}
			title={dynamic ? t('dynamic_transits') : t('transits_2')}
			items={items}
			activeId={selectedTransitedObjectId ?? ALL_ID}
			onSelect={(id) => setSelectedTransitedObjectId(id === ALL_ID ? null : id)}
			ariaLabel={t('transited_objects_nav_label', { defaultValue: 'Transiting objects' })}
		/>
	);
}
