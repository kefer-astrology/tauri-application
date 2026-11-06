import { invoke } from '@tauri-apps/api/core';
import { getCurrentModelReport } from '@/lib/tauri/workspace';
import { setDomainCatalog } from '@/lib/astrology/domainCatalog';
import { setObservableObjectCatalog } from '@/lib/astrology/observableObjects';
import type { DomainCatalogDto } from '@/lib/tauri/types';
import { PointDataSection } from './point-data-section';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ObservableObjectList } from '@/app/views/domain/observable-object-list';
import { useWorkspace } from '@/app/providers/workspace';
import { DEFAULT_OBSERVABLE_OBJECT_IDS } from '@/lib/astrology/observableObjects';
import { useSettingsDraft } from '../settings-draft';

const selectionFrom = (bodies: string[]) =>
	bodies.length > 0 ? bodies : DEFAULT_OBSERVABLE_OBJECT_IDS;

/** Default observable objects and their colors (both apply immediately). */
export function ObservableObjectsSection() {
	const { t } = useTranslation();
	const { workspaceDefaults, applyDefaultsPatch, workspacePath } = useWorkspace();
	const { markChanged } = useSettingsDraft();
	const [selected, setSelected] = useState(() => selectionFrom(workspaceDefaults.defaultBodies));
	const [catalogRevision, setCatalogRevision] = useState(0);
	const [colors, setColors] = useState(workspaceDefaults.bodyColors);
	useEffect(() => {
		setSelected(selectionFrom(workspaceDefaults.defaultBodies));
		setColors(workspaceDefaults.bodyColors);
	}, [workspaceDefaults]);

	return (
		<div className="space-y-4">
			<PointDataSection
				onImported={async () => {
					if (workspacePath) await getCurrentModelReport(workspacePath);
					else {
						const catalog = await invoke<DomainCatalogDto>('get_builtin_domain_catalog');
						setDomainCatalog(catalog);
						setObservableObjectCatalog(catalog);
					}
					setCatalogRevision((revision) => revision + 1);
				}}
			/>
			<ObservableObjectList
				key={catalogRevision}
				subtitle={t('settings_observable_objects_hint')}
				selectedIds={selected}
				onSelectedIdsChange={(next) => {
					setSelected(next);
					markChanged();
					void applyDefaultsPatch({ defaultBodies: next });
				}}
				colors={colors}
				onColorChange={(id, color) => {
					const next = { ...colors, [id]: color };
					setColors(next);
					markChanged();
					void applyDefaultsPatch({ bodyColors: next });
				}}
			/>
		</div>
	);
}
