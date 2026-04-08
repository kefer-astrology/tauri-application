import { Fragment, useMemo } from 'react';
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator
} from './ui/breadcrumb';
import { Button } from './ui/button';
import { cn } from './ui/utils';
import { getAppFormFieldTheme } from './form-field-theme';
import type { Theme } from './astrology-sidebar';
import { useWorkspaceCharts } from '../workspace-charts-context';

type HoroscopeContextTabsProps = {
	theme: Theme;
};

/**
 * Bottom workspace chart strip — chart switching only; **New** is via the left sidebar (`novy`).
 */
export function HoroscopeContextTabs({ theme }: HoroscopeContextTabsProps) {
	const { charts, selectedChartId, setSelectedChartId } = useWorkspaceCharts();
	const ft = useMemo(() => getAppFormFieldTheme(theme), [theme]);

	return (
		<div className={ft.contextRail}>
			<Breadcrumb className="min-w-0">
				<BreadcrumbList
					className={cn('flex-nowrap items-center gap-0.5 sm:gap-1', ft.muted)}
				>
					{charts.map((chart, i) => {
						const isActive = selectedChartId === chart.id;
						return (
							<Fragment key={chart.id}>
								{i > 0 && (
									<BreadcrumbSeparator
										className={cn('[&>svg]:size-3.5', ft.contextSeparator)}
									/>
								)}
								<BreadcrumbItem className="max-w-[min(12rem,40vw)] shrink-0">
									{isActive ? (
										<BreadcrumbPage className={ft.contextTabActive}>
											{chart.name}
										</BreadcrumbPage>
									) : (
										<BreadcrumbLink asChild>
											<Button
												type="button"
												variant="ghost"
												size="sm"
												className={ft.contextTabGhost}
												onClick={() => setSelectedChartId(chart.id)}
											>
												{chart.name}
											</Button>
										</BreadcrumbLink>
									)}
								</BreadcrumbItem>
							</Fragment>
						);
					})}
				</BreadcrumbList>
			</Breadcrumb>
		</div>
	);
}
