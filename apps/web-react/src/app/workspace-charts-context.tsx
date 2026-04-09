import { createContext, useContext, type ReactNode } from 'react';
import type { AppChart } from '@/lib/tauri/chartPayload';

export type WorkspaceChartsValue = {
	charts: AppChart[];
	selectedChartId: string | null;
	selectedChart: AppChart | undefined;
	setSelectedChartId: (id: string | null) => void;
	setCharts: React.Dispatch<React.SetStateAction<AppChart[]>>;
	addChart: (chart: AppChart) => void;
	replaceChartsFromWorkspace: (loaded: AppChart[]) => void;
};

const WorkspaceChartsContext = createContext<WorkspaceChartsValue | null>(null);

export function WorkspaceChartsProvider({
	children,
	value
}: {
	children: ReactNode;
	value: WorkspaceChartsValue;
}) {
	return (
		<WorkspaceChartsContext.Provider value={value}>{children}</WorkspaceChartsContext.Provider>
	);
}

export function useWorkspaceCharts(): WorkspaceChartsValue {
	const ctx = useContext(WorkspaceChartsContext);
	if (!ctx) {
		throw new Error('useWorkspaceCharts must be used within WorkspaceChartsProvider');
	}
	return ctx;
}
