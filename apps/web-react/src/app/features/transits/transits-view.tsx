import { TransitLayersPanel } from './results/transit-layers-panel';
import { TransitsResultsView } from './results/transits-results-view';
import { TransitsSetupSidebar, type TransitSection } from './setup/transits-setup-sidebar';
import { TransitsSetupView } from './setup/transits-setup-view';
import { useTransits } from './transits-provider';

export type { TransitSection };

/** Transits main area: the setup section, or the results once computed. */
export function TransitsView({ section }: { section: TransitSection }) {
	const { mode } = useTransits();
	return mode === 'results' ? <TransitsResultsView /> : <TransitsSetupView section={section} />;
}

/** Transits secondary sidebar: setup sections, or the transited-body layers of the results. */
export function TransitsSidebar({
	dynamic,
	activeSection,
	onSectionChange
}: {
	dynamic: boolean;
	activeSection: TransitSection;
	onSectionChange: (section: TransitSection) => void;
}) {
	const { mode } = useTransits();
	if (mode === 'results') return <TransitLayersPanel />;
	return (
		<TransitsSetupSidebar
			activeSection={activeSection}
			onSectionChange={onSectionChange}
			dynamic={dynamic}
		/>
	);
}
