import { useMemo } from 'react';
import { Toolbar } from '@/app/components/ui/container';
import { Text } from '@/app/components/ui/typography';
import { useWidgetWorkspace } from '@/app/providers/widget-workspace';
import { useWorkspace } from '@/app/providers/workspace';
import { WidgetGrid } from '@/app/views/data/widget-grid';
import { gridItems, withoutOrphans } from '@/lib/widgets/profiles';
import type { Breakpoint } from '@/lib/widgets/types';
import { useTranslation } from 'react-i18next';
import { WorkspaceToolbar } from '../workspace/workspace-toolbar';
import { SpektrumProvider, type SpektrumOptions } from './spektrum-context';
import { SPEKTRUM_WIDGETS } from './widgets';

const KNOWN_WIDGETS = new Set(Object.keys(SPEKTRUM_WIDGETS));

type GridItem = ReturnType<typeof gridItems>[number] & { key: string };

/** Spektrum (Information): the selected chart's facts as widgets on a grid around its wheel.
 *  Hovering a card's row previews it on the wheel; a click locks it. */
export function SpektrumView(options: Omit<SpektrumOptions, 'workspaceDefaults'>) {
	const { t } = useTranslation();
	const { workspaceDefaults } = useWorkspace();
	const workspace = useWidgetWorkspace();
	const items = useMemo(() => {
		const profile = withoutOrphans(workspace.profile, KNOWN_WIDGETS);
		const forBreakpoint = (bp: Breakpoint): GridItem[] =>
			gridItems(profile, 'spektrum', bp).map((item) => ({
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
		<SpektrumProvider {...options} workspaceDefaults={workspaceDefaults}>
			<div className="flex h-full min-h-0 flex-col" data-handoff="View_InformationDashboard">
				<Toolbar padding="compact" align="between" className="gap-2 md:px-5">
					<Text variant="label" as="span" tone="primary">
						{t('sidebar_information')}
					</Text>
					<div className="flex items-center gap-2">
						<WorkspaceToolbar module="spektrum" widgets={SPEKTRUM_WIDGETS} />
					</div>
				</Toolbar>
				<div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
					<WidgetGrid
						items={items}
						renderItem={({ instance }) => {
							const { Component } = SPEKTRUM_WIDGETS[instance.widgetId]!;
							return <Component instance={instance} />;
						}}
					/>
				</div>
			</div>
		</SpektrumProvider>
	);
}
