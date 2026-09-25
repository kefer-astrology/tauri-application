import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Heart } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { SecondaryNavPanel } from './secondary-nav-panel';
import { sidebarNavMenuRowClassName, sidebarThemeStyles, type Theme } from './astrology-sidebar';
import { cn } from './ui/utils';

export type SettingsSectionId =
	| 'jazyk_lokace'
	| 'system_domu'
	| 'pozorovane_objekty'
	| 'nastaveni_aspektu'
	| 'rozlozeni_symbolu'
	| 'rozlozeni_aplikace'
	| 'jan_kefer'
	| 'manual';

const SUPPORT_US_URL = 'https://keferastrology.com/donate';

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
	const st = sidebarThemeStyles[theme];

	const items = useMemo(
		() => [
			{
				id: 'jazyk_lokace' as const,
				label: t('section_jazyk_lokace', { defaultValue: 'Language & location' })
			},
			{ id: 'system_domu' as const, label: t('section_system_domu') },
			{
				id: 'pozorovane_objekty' as const,
				label: t('section_observable_objects', { defaultValue: 'Observable objects' })
			},
			{ id: 'nastaveni_aspektu' as const, label: t('section_nastaveni_aspektu') },
			{ id: 'rozlozeni_symbolu' as const, label: t('section_symbols_layout') },
			{ id: 'rozlozeni_aplikace' as const, label: t('section_app_layout') },
			{ id: 'jan_kefer' as const, label: t('section_jan_kefer', { defaultValue: 'Jan Kefer' }) },
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
			footer={
				<button
					type="button"
					onClick={() => {
						void openUrl(SUPPORT_US_URL);
					}}
					className={cn(
						'flex w-full items-center gap-2.5',
						sidebarNavMenuRowClassName,
						st.text,
						st.hover
					)}
				>
					<Heart className="h-4 w-4 shrink-0" />
					{t('settings_support_us', { defaultValue: 'Support us' })}
				</button>
			}
		/>
	);
}
