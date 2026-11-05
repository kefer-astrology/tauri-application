import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/app/components/ui/button';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/app/components/ui/select';
import { useWidgetWorkspace } from '@/app/providers/widget-workspace';
import type { WidgetModule, WidgetPresetId } from '@/lib/widgets/types';
import type { WidgetDefinition } from './widget-definition';
import { WidgetCatalog } from './widget-catalog';

/** A module's workspace controls: the profile in use and the module's widget catalog. */
export function WorkspaceToolbar({
	module,
	widgets
}: {
	module: WidgetModule;
	widgets: Record<string, WidgetDefinition>;
}) {
	const { t } = useTranslation();
	const { presets, activePreset, setActivePreset } = useWidgetWorkspace();
	const [catalogOpen, setCatalogOpen] = useState(false);

	return (
		<>
			<Select
				value={activePreset}
				onValueChange={(value) => setActivePreset(value as WidgetPresetId)}
			>
				<SelectTrigger
					variant="form"
					density="compact"
					className="w-auto min-w-40"
					aria-label={t('widget_profile', { defaultValue: 'Profile' })}
				>
					<SelectValue />
				</SelectTrigger>
				<SelectContent variant="form">
					{presets.map((preset) => (
						<SelectItem variant="form" key={preset.preset} value={preset.preset}>
							{t(preset.nameKey!)}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<Button
				variant="outline"
				size="sm"
				data-workspace-action="catalog"
				onClick={() => setCatalogOpen(true)}
			>
				<Plus aria-hidden="true" />
				{t('widgets_add', { defaultValue: 'Widgets' })}
			</Button>
			<WidgetCatalog
				module={module}
				widgets={widgets}
				open={catalogOpen}
				onOpenChange={setCatalogOpen}
			/>
		</>
	);
}
