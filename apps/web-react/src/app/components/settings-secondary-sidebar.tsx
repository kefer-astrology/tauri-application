import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SecondaryNavPanel } from './secondary-nav-panel';
import type { Theme } from './astrology-sidebar';

export type SettingsSectionId =
	| 'jazyk'
	| 'lokace'
	| 'system_domu'
	| 'pozorovane_objekty'
	| 'nastaveni_aspektu'
	| 'vzhled'
	| 'manual';

export interface SettingsSecondarySidebarProps {
	activeSection: SettingsSectionId;
	onSectionChange: (section: SettingsSectionId) => void;
	theme: Theme;
}

export function SettingsSecondarySidebar({
	activeSection,
	onSectionChange,
	theme
}: SettingsSecondarySidebarProps) {
	const { t } = useTranslation();

	const items = useMemo(
		() =>
			[
				{ id: 'jazyk' as const, label: t('section_jazyk') },
				{ id: 'lokace' as const, label: t('section_lokace') },
				{ id: 'system_domu' as const, label: t('section_system_domu') },
				{ id: 'pozorovane_objekty' as const, label: t('section_observable_objects', { defaultValue: 'Observable objects' }) },
				{ id: 'nastaveni_aspektu' as const, label: t('section_nastaveni_aspektu') },
				{ id: 'vzhled' as const, label: t('section_vzhled') },
				{ id: 'manual' as const, label: t('section_manual') }
			],
		[t]
	);

	return (
		<SecondaryNavPanel
			theme={theme}
			title={t('app_settings')}
			items={items}
			activeId={activeSection}
			onSelect={(id) => onSectionChange(id as SettingsSectionId)}
			ariaLabel={t('settings')}
		/>
	);
}
