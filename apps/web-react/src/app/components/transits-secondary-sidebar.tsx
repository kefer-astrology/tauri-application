import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SecondaryNavPanel } from './secondary-nav-panel';
import type { Theme } from './astrology-sidebar';

export type TransitSection = 'general' | 'transiting-bodies' | 'transited-bodies' | 'aspects';

export interface TransitsSecondarySidebarProps {
	activeSection: TransitSection;
	onSectionChange: (section: TransitSection) => void;
	theme: Theme;
	dynamic?: boolean;
}

export function TransitsSecondarySidebar({
	activeSection,
	onSectionChange,
	theme,
	dynamic = false
}: TransitsSecondarySidebarProps) {
	const { t } = useTranslation();

	const items = useMemo(() => {
		const sections = [
			{ id: 'general' as const, label: t('transits_menu_general') },
			{ id: 'transiting-bodies' as const, label: t('transits_menu_transiting') },
			{ id: 'transited-bodies' as const, label: t('transits_menu_transited') },
			{ id: 'aspects' as const, label: t('transits_menu_aspects_used') }
		];
		return dynamic ? sections.filter((section) => section.id !== 'transited-bodies') : sections;
	}, [dynamic, t]);

	return (
		<SecondaryNavPanel
			theme={theme}
			title={dynamic ? t('dynamic_transits') : t('transits_2')}
			items={items}
			activeId={activeSection}
			onSelect={(id) => onSectionChange(id as TransitSection)}
			ariaLabel={dynamic ? t('dynamic_transits') : t('transits_2')}
		/>
	);
}
