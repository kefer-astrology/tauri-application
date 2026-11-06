import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_ASPECT_COLORS } from '@/lib/astrology/aspects';
import { aspectLabel, objectLabel } from '@/lib/astrology/objectLabels';
import { getDefaultBodyColor } from '@/lib/astrology/observableObjects';
import { useAspectarium } from './aspectarium-context';

/** Names and colors the Aspectarium views take as props. */
export function useAspectariumLabels() {
	const { t } = useTranslation();
	const { workspaceDefaults } = useAspectarium();
	return {
		bodyLabel: useCallback((id: string) => objectLabel(id, t), [t]),
		aspectLabel: useCallback((type: string) => aspectLabel(type, t), [t]),
		bodyColor: useCallback(
			(id: string) => workspaceDefaults.bodyColors[id] ?? getDefaultBodyColor(id),
			[workspaceDefaults.bodyColors]
		),
		aspectColor: useCallback(
			(type: string) =>
				workspaceDefaults.defaultAspectColors[type] ??
				DEFAULT_ASPECT_COLORS[type] ??
				'var(--theme-accent)',
			[workspaceDefaults.defaultAspectColors]
		)
	};
}
