import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SecondaryNavPanel } from '@/app/views/data/secondary-nav-panel';

export type TransitSection = 'general' | 'transiting-bodies' | 'transited-bodies' | 'aspects';

/** Setup sections; the dynamic-transits variant has no transited bodies. */
export function TransitsSetupSidebar({
	activeSection,
	onSectionChange,
	dynamic = false
}: {
	activeSection: TransitSection;
	onSectionChange: (section: TransitSection) => void;
	dynamic?: boolean;
}) {
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
			title={dynamic ? t('dynamic_transits') : t('transits_2')}
			items={items}
			activeId={activeSection}
			onSelect={(id) => onSectionChange(id as TransitSection)}
			ariaLabel={dynamic ? t('dynamic_transits') : t('transits_2')}
		/>
	);
}
