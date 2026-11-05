import { useTranslation } from 'react-i18next';
import { Button } from '@/app/components/ui/button';
import { Surface } from '@/app/components/ui/container';
import { Text } from '@/app/components/ui/typography';
import { useWidgetWorkspace } from '@/app/providers/widget-workspace';
import { DetailSidePanel } from '@/app/views/data/detail-side-panel';
import { instanceCount, moduleInstanceIds } from '@/lib/widgets/profiles';
import type { WidgetModule } from '@/lib/widgets/types';
import type { WidgetDefinition } from './widget-definition';

/**
 * The widget catalog in the right panel: every widget of a module with a one-line description.
 * Repeatable widgets are added again ("+ Add"); a unique widget already on the workspace is found
 * there instead. A new or found widget is briefly highlighted.
 */
export function WidgetCatalog({
	module,
	widgets,
	open,
	onOpenChange
}: {
	module: WidgetModule;
	widgets: Record<string, WidgetDefinition>;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const { t } = useTranslation();
	const { profile, addHoroskopWidget, addGridWidget, highlight } = useWidgetWorkspace();
	const add = (definition: WidgetDefinition) => {
		const { manifest } = definition;
		const settings = { ...manifest.defaultSettings };
		if (module === 'horoskop') {
			addHoroskopWidget(manifest.id, manifest.horoskopRegion ?? 'right', settings);
		} else {
			addGridWidget(module, manifest.id, manifest.sizes.default, settings);
		}
	};

	const find = (widgetId: string) => {
		const placed = moduleInstanceIds(profile, module);
		const instance = profile.instances.find(
			(i) => i.widgetId === widgetId && placed.has(i.instanceId)
		);
		if (!instance) return;
		onOpenChange(false);
		highlight(instance.instanceId);
		document
			.querySelector(`[data-widget-instance="${instance.instanceId}"]`)
			?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
	};

	return (
		<DetailSidePanel
			open={open}
			onOpenChange={onOpenChange}
			title={t('widget_catalog_title', { defaultValue: 'Widgets' })}
			description={t('widget_catalog_hint', {
				defaultValue: 'Add widgets to the workspace or find the ones already on it.'
			})}
			bodyClassName="overflow-y-auto"
		>
			<ul className="flex flex-col gap-2">
				{Object.values(widgets)
					.filter(({ manifest }) => manifest.modules.includes(module))
					.map((definition) => {
						const { manifest } = definition;
						const count = instanceCount(profile, manifest.id, module);
						const onWorkspace = !manifest.repeatable && count > 0;
						return (
							<li key={manifest.id}>
								<Surface
									variant="soft"
									className="flex items-start justify-between gap-3 px-3 py-2"
									data-catalog-widget={manifest.id}
								>
									<div className="min-w-0">
										<Text variant="label">{t(manifest.titleKey)}</Text>
										<Text variant="caption" tone="muted">
											{t(manifest.descriptionKey)}
										</Text>
										{manifest.repeatable && count > 0 ? (
											<Text variant="caption" tone="muted">
												{t('widget_on_workspace_count', {
													count,
													defaultValue: 'On the workspace: {{count}}'
												})}
											</Text>
										) : null}
									</div>
									{onWorkspace ? (
										<Button
											type="button"
											variant="ghost"
											size="sm"
											className="shrink-0"
											onClick={() => find(manifest.id)}
										>
											{t('widget_find', { defaultValue: 'On the workspace · Find' })}
										</Button>
									) : (
										<Button
											type="button"
											variant="outline"
											size="sm"
											className="shrink-0"
											onClick={() => {
												add(definition);
												onOpenChange(false);
											}}
										>
											{t('widget_add', { defaultValue: '+ Add' })}
										</Button>
									)}
								</Surface>
							</li>
						);
					})}
			</ul>
		</DetailSidePanel>
	);
}
