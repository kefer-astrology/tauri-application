import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { cn } from './ui/utils';
import { sidebarThemeStyles } from './astrology-sidebar';
import type { Theme } from './astrology-sidebar';
import { objectLabel } from '@/lib/astrology/objectLabels';
import type { AspectTimelineSeries } from '@/lib/astrology/aspectTimeline';
import { useTransitsWorkspace } from '../providers/transits-workspace';

interface TransitLayersPanelProps {
	theme: Theme;
}

interface TransitedGroup {
	to: string;
	keys: string[];
}

/** Flat list of the *transited* bodies actually present in the computed series — the small,
 *  deliberately-selected anchor set, not the transiting bodies or aspect types that produced
 *  these waves. One checkbox per transited body toggles every aspect/transiting-body wave
 *  pointing to it at once: activating a body shows only the aspects related to that body in the
 *  resonance chart. There is deliberately no further breakdown by aspect or transiting body here
 *  — those dimensions can be large/arbitrary, while this list mirrors exactly what was selected
 *  as "Transited Bodies" in setup. */
export function TransitLayersPanel({ theme }: TransitLayersPanelProps) {
	const { t } = useTranslation();
	const st = sidebarThemeStyles[theme];
	const { aspectTimelineSeries, hiddenSeriesKeys, setSeriesGroupVisibility } = useTransitsWorkspace();

	const groups = useMemo<TransitedGroup[]>(() => {
		const byTo = new Map<string, string[]>();
		for (const series of aspectTimelineSeries as AspectTimelineSeries[]) {
			const keys = byTo.get(series.to) ?? [];
			keys.push(series.key);
			byTo.set(series.to, keys);
		}
		return Array.from(byTo.entries())
			.map(([to, keys]) => ({ to, keys }))
			.sort((a, b) => a.to.localeCompare(b.to));
	}, [aspectTimelineSeries]);

	return (
		<aside
			data-titlebar-secondary-rail="fixed"
			className={cn(
				'flex h-full min-h-0 w-[220px] shrink-0 flex-col border-r pt-2',
				st.bg,
				st.border
			)}
			style={{
				background:
					'linear-gradient(to bottom, var(--theme-secondary-sidebar-start) 0%, var(--theme-secondary-sidebar-end) 100%)',
				borderColor: 'var(--theme-sidebar-border)'
			}}
		>
			<div className="shrink-0 px-3 py-4">
				<h2 className={cn('text-sm font-semibold tracking-wide uppercase', st.text)}>
					{t('transit_layers_panel_title', { defaultValue: 'Layers' })}
				</h2>
			</div>
			<nav
				className="scrollbar-hide flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 pb-3"
				aria-label={t('transit_layers_panel_label', { defaultValue: 'Transited bodies' })}
			>
				{groups.length === 0 ? (
					<p className={cn('px-2 py-3 text-xs', st.text)}>
						{t('transit_layers_panel_empty', { defaultValue: 'No aspects in this series.' })}
					</p>
				) : (
					groups.map((group) => {
						const hiddenCount = group.keys.filter((key) => hiddenSeriesKeys.has(key)).length;
						const checked = hiddenCount === 0 ? true : hiddenCount === group.keys.length ? false : 'indeterminate';
						return (
							<Label
								key={group.to}
								className={cn(
									'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium',
									st.text
								)}
							>
								<Checkbox
									checked={checked}
									onCheckedChange={(next) => setSeriesGroupVisibility(group.keys, next === true)}
									className="h-3.5 w-3.5 shrink-0"
								/>
								<span className="truncate">{objectLabel(group.to, t)}</span>
								<span className="ml-auto text-[0.65rem] opacity-60">{group.keys.length}</span>
							</Label>
						);
					})
				)}
			</nav>
		</aside>
	);
}
