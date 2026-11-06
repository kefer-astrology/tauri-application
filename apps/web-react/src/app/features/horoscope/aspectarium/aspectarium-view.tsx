import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Surface, Toolbar } from '@/app/components/ui/container';
import { useWidgetWorkspace } from '@/app/providers/widget-workspace';
import { DetailSidePanel } from '@/app/views/data/detail-side-panel';
import { WidgetGrid } from '@/app/views/data/widget-grid';
import { AspectDetailPanel } from '@/app/views/domain/aspect-detail-panel';
import { gridItems, withoutOrphans } from '@/lib/widgets/profiles';
import type { Breakpoint } from '@/lib/widgets/types';
import { WorkspaceToolbar } from '../workspace/workspace-toolbar';
import {
	AspectariumProvider,
	useAspectarium,
	type AspectariumOptions
} from './aspectarium-context';
import { AspectariumFilters } from './aspectarium-filters';
import { useAspectDetail } from './use-aspect-detail';
import { ASPEKTARIUM_WIDGETS } from './widgets';

const KNOWN_WIDGETS = new Set(Object.keys(ASPEKTARIUM_WIDGETS));
type GridItem = ReturnType<typeof gridItems>[number] & { key: string };

/** The Aspectarium: its widgets (aspect grid, aspect list, midpoints) on a grid, with the shared
 *  filters, the profile choice and the widget catalog in its toolbar. */
export function AspectariumView(options: AspectariumOptions) {
	return (
		<AspectariumProvider {...options}>
			<AspectariumPage />
		</AspectariumProvider>
	);
}

function AspectariumPage() {
	const { t } = useTranslation();
	const workspace = useWidgetWorkspace();
	const { transitOverlay, selected, select } = useAspectarium();
	const detail = useAspectDetail();
	const items = useMemo(() => {
		const profile = withoutOrphans(workspace.profile, KNOWN_WIDGETS);
		const forBreakpoint = (bp: Breakpoint): GridItem[] =>
			gridItems(profile, 'aspektarium', bp).map((item) => ({
				...item,
				key: item.instance.instanceId
			}));
		return {
			desktop: forBreakpoint('desktop'),
			tablet: forBreakpoint('tablet'),
			mobile: forBreakpoint('mobile')
		};
	}, [workspace.profile]);

	return (
		<>
			<div className="flex h-full min-h-0 flex-col">
				<Toolbar padding="compact" align="between" className="gap-2 md:px-5">
					<div className="flex flex-wrap items-center gap-2">
						<AspectariumFilters />
					</div>
					<div className="flex items-center gap-2">
						<WorkspaceToolbar module="aspektarium" widgets={ASPEKTARIUM_WIDGETS} />
					</div>
				</Toolbar>
				<div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
					<WidgetGrid
						items={items}
						renderItem={({ instance }) => {
							const { Component } = ASPEKTARIUM_WIDGETS[instance.widgetId]!;
							return <Component instance={instance} />;
						}}
					/>
				</div>
			</div>

			<DetailSidePanel
				open={selected !== null}
				onOpenChange={(open) => {
					if (!open) select(null);
				}}
				title={t('details')}
				description={
					transitOverlay ? t('transit_overlay_aspectarium_hint') : t('aspectarium_reported_aspects')
				}
			>
				{detail ? (
					<Surface
						variant="soft"
						padding="default"
						className="h-full min-h-0 overflow-y-auto bg-[color:var(--theme-soft-bg)]/42 pr-2"
					>
						<AspectDetailPanel
							aspect={detail.aspect}
							fromObject={detail.fromObject}
							toObject={detail.toObject}
						/>
					</Surface>
				) : null}
			</DetailSidePanel>
		</>
	);
}
