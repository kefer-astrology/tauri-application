import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/app/components/ui/button';
import { ActionBar } from '@/app/components/ui/container';
import { cn } from '@/app/components/ui/utils';
import { useAppFormFieldTheme } from '@/app/components/form-field-theme';
import { DetailSidePanel } from '@/app/views/data/detail-side-panel';
import { WidgetFrame } from '@/app/views/data/widget-frame';
import { ObservableObjectList } from '@/app/views/domain/observable-object-list';
import { PositionsList } from '@/app/views/domain/positions-list';
import type { WidgetInstance } from '@/lib/widgets/types';
import { useHoroskop } from '../horoskop-context';
import { useWidgetChrome } from '../../workspace/use-widget-chrome';

/** The active chart's positions; a row selects the body as on the wheel. The pencil picks which
 *  objects the chart shows. */
export function PositionsWidget({ instance }: { instance: WidgetInstance }) {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme();
	const {
		chart,
		data,
		selectedObject,
		selectObject,
		workspaceDefaults,
		onObservableObjectsChange
	} = useHoroskop();
	const chrome = useWidgetChrome(instance, t('right_panel'));
	const [pickerOpen, setPickerOpen] = useState(false);
	const [pickerBodies, setPickerBodies] = useState<string[]>([]);

	return (
		<>
			<WidgetFrame
				{...chrome}
				title={t('right_panel')}
				dataTour="radix-positions"
				fill
				bodyClassName="min-h-0 flex-1 overflow-auto"
				actions={
					<Button
						variant="ghost"
						size="icon"
						className="rounded-lg hover:bg-[color:var(--token-hover-subtle)]"
						aria-label={t('section_observable_objects')}
						onClick={() => {
							setPickerBodies(chart?.observableObjects ?? workspaceDefaults.defaultBodies);
							setPickerOpen(true);
						}}
					>
						<Pencil className={cn('h-4 w-4', ft.muted)} />
					</Button>
				}
			>
				<PositionsList
					positions={data.positionRows}
					selectedId={selectedObject?.layer === 'radix' ? selectedObject.bodyId : null}
					onSelect={(bodyId) => selectObject({ bodyId, layer: 'radix' })}
					emptyText={t('dashboard_no_positions')}
				/>
			</WidgetFrame>

			<DetailSidePanel
				open={pickerOpen}
				onOpenChange={setPickerOpen}
				title={t('dashboard_positions_picker_title')}
				description={t('aspectarium_selected_count', { count: pickerBodies.length })}
				contentClassName="sm:max-w-lg lg:w-[30vw] lg:max-w-xl"
				bodyClassName="overflow-hidden p-0"
			>
				<div className="flex h-full min-h-0 flex-col">
					<div className="min-h-0 flex-1 overflow-y-auto">
						<ObservableObjectList
							subtitle={t('dashboard_positions_picker_hint')}
							selectedIds={pickerBodies}
							onSelectedIdsChange={setPickerBodies}
						/>
					</div>
					<ActionBar padding="relaxed" align="end" wrap="nowrap" className="gap-3">
						<Button
							size="form"
							type="button"
							variant="form-secondary"
							onClick={() => setPickerOpen(false)}
							className="flex-none"
						>
							{t('cancel')}
						</Button>
						<Button
							variant="form-primary"
							size="form"
							type="button"
							className="flex-none"
							onClick={() => {
								if (chart) onObservableObjectsChange?.(chart.id, pickerBodies);
								setPickerOpen(false);
							}}
						>
							{t('sidebar_save')}
						</Button>
					</ActionBar>
				</div>
			</DetailSidePanel>
		</>
	);
}
