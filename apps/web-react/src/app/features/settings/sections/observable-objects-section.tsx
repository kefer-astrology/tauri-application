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
	const { workspaceDefaults, applyDefaultsPatch } = useWorkspace();
	const { markChanged } = useSettingsDraft();
	const [selected, setSelected] = useState(() => selectionFrom(workspaceDefaults.defaultBodies));
	const [colors, setColors] = useState(workspaceDefaults.bodyColors);
	useEffect(() => {
		setSelected(selectionFrom(workspaceDefaults.defaultBodies));
		setColors(workspaceDefaults.bodyColors);
	}, [workspaceDefaults]);

	return (
		<ObservableObjectList
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
	);
}
