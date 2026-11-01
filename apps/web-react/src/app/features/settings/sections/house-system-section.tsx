import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useWorkspace } from '@/app/providers/workspace';
import { catalogHouseSystems } from '@/lib/astrology/domainCatalog';
import { SettingSelect } from '../settings-controls';
import { useSettingsDraft } from '../settings-draft';

/** Historical house-system names stay untranslated; only real words get a key. */
const HOUSE_SYSTEM_LABEL_KEYS: Record<string, string> = {
	'Whole Sign': 'house_system_whole_sign',
	Equal: 'house_system_equal'
};

/** Workspace house system and position mode (both apply immediately). */
export function HouseSystemSection() {
	const { t } = useTranslation();
	const { workspaceDefaults, applyDefaultsPatch } = useWorkspace();
	const { markChanged } = useSettingsDraft();
	const [houseSystem, setHouseSystem] = useState<string>(workspaceDefaults.houseSystem);
	useEffect(() => setHouseSystem(workspaceDefaults.houseSystem), [workspaceDefaults.houseSystem]);

	return (
		<div className="space-y-4">
			<SettingSelect
				label={t('house_system')}
				hint={t('settings_house_system_hint', {
					defaultValue: 'Shown options are computed by the current Rust JPL backend.'
				})}
				value={houseSystem}
				options={catalogHouseSystems().map((name) => ({
					value: name,
					label: HOUSE_SYSTEM_LABEL_KEYS[name]
						? t(HOUSE_SYSTEM_LABEL_KEYS[name]!, { defaultValue: name })
						: name
				}))}
				onValueChange={(value) => {
					setHouseSystem(value);
					markChanged();
					void applyDefaultsPatch({ houseSystem: value });
				}}
			/>
			<SettingSelect
				label={t('settings_position_mode')}
				hint={t('settings_position_mode_hint')}
				value={workspaceDefaults.positionMode}
				options={[
					{ value: 'apparent', label: t('settings_position_mode_apparent') },
					{ value: 'geometric', label: t('settings_position_mode_geometric') }
				]}
				onValueChange={(positionMode) => {
					markChanged();
					void applyDefaultsPatch({ positionMode });
				}}
			/>
		</div>
	);
}
