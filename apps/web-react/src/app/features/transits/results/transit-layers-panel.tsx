import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Label } from '@/app/components/ui/label';
import { cn } from '@/app/components/ui/utils';
import { sidebarThemeStyles } from '@/app/components/ui/sidebar-theme';
import { objectLabel } from '@/lib/astrology/objectLabels';
import { layerVisibility, transitingLayers } from '@/lib/astrology/transitResults';
import { useTransits } from '../transits-provider';
import { useAppTheme } from '@/app/providers/app-theme';

/** One checkbox per transiting body present in the results, showing or hiding every wave it
 *  draws. Follows the order of the "Transiting bodies" selection. */
export function TransitLayersPanel() {
	const { t } = useTranslation();
	const { theme } = useAppTheme();
	const st = sidebarThemeStyles[theme];
	const { timelineSeries, setup, view } = useTransits();
	const layers = useMemo(
		() => transitingLayers(timelineSeries, setup.transitingBodies),
		[timelineSeries, setup.transitingBodies]
	);

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
				aria-label={t('transits_menu_transiting')}
			>
				{layers.length === 0 ? (
					<p className={cn('px-2 py-3 text-xs', st.text)}>
						{t('transit_layers_panel_empty', { defaultValue: 'No aspects in this series.' })}
					</p>
				) : (
					layers.map((group) => {
						const checked = layerVisibility(group.keys, view.hiddenSeriesKeys);
						return (
							<Label
								key={group.from}
								className={cn(
									'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium',
									st.text
								)}
							>
								<Checkbox
									checked={checked}
									onCheckedChange={(next) => view.setSeriesGroupVisible(group.keys, next === true)}
									className="h-3.5 w-3.5 shrink-0"
								/>
								<span className="truncate">{objectLabel(group.from, t)}</span>
								<span className="ml-auto text-[0.65rem] opacity-60">{group.keys.length}</span>
							</Label>
						);
					})
				)}
			</nav>
		</aside>
	);
}
