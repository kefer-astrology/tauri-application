import { useTranslation } from 'react-i18next';
import { DetailSidePanel } from '@/app/views/data/detail-side-panel';
import { AspectDetailPanel } from '@/app/views/domain/aspect-detail-panel';
import { HoroscopeWheel } from '@/app/views/domain/horoscope-wheel/horoscope-wheel';
import { ObjectDetailPanel } from '@/app/views/domain/object-detail-panel';
import type { ElementColors } from '@/lib/astrology/elementColors';
import type { WheelOrientationId, WheelStyleId } from '@/lib/astrology/wheelStyle';
import { useWidgetWorkspace } from '@/app/providers/widget-workspace';
import { regionInstances, withoutOrphans } from '@/lib/widgets/profiles';
import type { HoroskopRegion } from '@/lib/widgets/types';
import { ChartWorkspaceLayout } from './chart-workspace-layout';
import { HoroskopProvider, useHoroskop, type HoroskopOptions } from './horoskop-context';
import { useWheelDetails } from './use-wheel-details';
import { HOROSKOP_WIDGETS } from './widgets';
import { WorkspaceToolbar } from '../workspace/workspace-toolbar';

interface HoroskopViewProps extends HoroskopOptions {
	wheelStyle?: WheelStyleId;
	wheelOrientation?: WheelOrientationId;
	elementColors: ElementColors;
	lightPlanetFill: string;
}

const KNOWN_WIDGETS = new Set(Object.keys(HOROSKOP_WIDGETS));

/** The Horoskop module: the protected wheel in the centre and the active profile's widgets in
 *  the regions around it, with the profile choice and the widget catalog in its toolbar. */
export function HoroskopView({
	wheelStyle,
	wheelOrientation,
	elementColors,
	lightPlanetFill,
	...options
}: HoroskopViewProps) {
	return (
		<HoroskopProvider {...options}>
			<HoroskopLayout
				wheelStyle={wheelStyle}
				wheelOrientation={wheelOrientation}
				elementColors={elementColors}
				lightPlanetFill={lightPlanetFill}
			/>
		</HoroskopProvider>
	);
}

function HoroskopLayout({
	wheelStyle,
	wheelOrientation = 'ascendant',
	elementColors,
	lightPlanetFill
}: Omit<HoroskopViewProps, keyof HoroskopOptions>) {
	const { t } = useTranslation();
	const horoskop = useHoroskop();
	const { workspaceDefaults, data, chart } = horoskop;
	const profile = withoutOrphans(useWidgetWorkspace().profile, KNOWN_WIDGETS);
	const details = useWheelDetails();

	// The compact layout moves the left region into the right panel itself.
	const region = (name: HoroskopRegion) =>
		regionInstances(profile, 'desktop', name).map((instance) => {
			const { Component } = HOROSKOP_WIDGETS[instance.widgetId]!;
			return <Component key={instance.instanceId} instance={instance} />;
		});

	return (
		<>
			<ChartWorkspaceLayout
				left={<div className="flex min-h-0 min-w-0 flex-col gap-4">{region('left')}</div>}
				right={<div className="h-full min-h-0 min-w-0">{region('right')}</div>}
				leftLabel={t('details')}
				rightLabel={t('right_panel')}
				actions={<WorkspaceToolbar module="horoskop" widgets={HOROSKOP_WIDGETS} />}
			>
				<div
					className="flex min-h-0 min-w-0 items-center justify-center overflow-hidden"
					data-tour="radix-wheel"
				>
					<div className="aspect-square h-full max-h-full w-full max-w-full">
						<HoroscopeWheel
							wheelStyle={wheelStyle}
							elementColors={elementColors}
							lightPlanetFill={lightPlanetFill}
							bodyLongitudes={data.wheelBodyLongitudes}
							bodyOrder={data.wheelBodyOrder}
							transitBodyLongitudes={data.transitBodyLongitudes}
							transitBodyOrder={data.transitBodyOrder}
							axisLongitudes={data.axisLongitudes}
							houseCusps={chart?.computed?.houseCusps}
							leftEdgeLongitude={wheelOrientation === 'ascendant' ? data.ascLongitude : 0}
							useFallbackData={false}
							showPlanetGlyphs
							showAxisLines={data.showAxisLines}
							radixAspects={data.radixAspects}
							aspectOrbsForRadix={workspaceDefaults.defaultAspectOrbs}
							aspectColorsForRadix={workspaceDefaults.defaultAspectColors}
							bodyColors={workspaceDefaults.bodyColors}
							aspectLineTierStyle={workspaceDefaults.aspectLineTierStyle}
							selectedObject={horoskop.selectedObject}
							selectedAspectIndex={horoskop.selectedAspect?.index}
							highlightAspectIndices={horoskop.highlightAspectIndices}
							highlightBodies={horoskop.highlightBodies}
							dimNonHighlighted={horoskop.highlightBodies.size > 0}
							onObjectClick={horoskop.selectObject}
							onAspectClick={horoskop.selectAspect}
							onWheelBackgroundClick={horoskop.clearSelection}
						/>
					</div>
				</div>
			</ChartWorkspaceLayout>

			{/* A first click on a body or aspect highlights it; the second opens these details. */}
			<DetailSidePanel
				open={horoskop.detailKind !== null}
				modal={false}
				onInteractOutside={(event) => {
					const target = event.target;
					if (
						target instanceof Element &&
						target.closest('[data-wheel-object], [data-wheel-aspect]')
					) {
						event.preventDefault();
					}
				}}
				onOpenChange={(open) => {
					if (!open) horoskop.closeDetail();
				}}
				title={details.title}
				description={details.description}
				bodyClassName="overflow-y-auto"
			>
				{horoskop.detailKind === 'object' && details.object ? (
					<ObjectDetailPanel data={details.object} />
				) : horoskop.detailKind === 'aspect' && details.aspect ? (
					<AspectDetailPanel
						aspect={details.aspect.aspect}
						fromObject={details.aspect.fromObject}
						toObject={details.aspect.toObject}
					/>
				) : null}
			</DetailSidePanel>
		</>
	);
}
