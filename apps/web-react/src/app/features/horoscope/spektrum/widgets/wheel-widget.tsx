import { useTranslation } from 'react-i18next';
import { Badge } from '@/app/components/ui/badge';
import { Text } from '@/app/components/ui/typography';
import { WidgetFrame } from '@/app/views/data/widget-frame';
import { HoroscopeWheel } from '@/app/views/domain/horoscope-wheel/horoscope-wheel';
import { ObjectGlyph } from '@/app/views/domain/object-glyph';
import { shapeLabel } from '@/lib/astrology/objectLabels';
import type { WidgetInstance } from '@/lib/widgets/types';
import { useWidgetChrome } from '../../workspace/use-widget-chrome';
import { useSpektrum } from '../spektrum-context';
import { FocusRow } from './focus-row';

/** The selected chart's wheel, showing what the cards focus (bodies, a chart half), with the
 *  lunar phase, the lights' horizon and the synodic roles of Mercury and Venus above it and the
 *  chart's shape below. */
export function SpektrumWheelWidget({ instance }: { instance: WidgetInstance }) {
	const { t, i18n } = useTranslation();
	const {
		chart,
		facts,
		wheel,
		focus,
		workspaceDefaults,
		wheelStyle,
		elementColors,
		lightPlanetFill
	} = useSpektrum();
	const title = t('widget_spektrum_wheel', { defaultValue: 'Chart wheel' });
	const chrome = useWidgetChrome(instance, title);
	const highlighted = new Set(focus?.bodies ?? []);
	const shapes = chart?.computed?.shapes ?? [];
	const horizon =
		facts?.sun_horizon && facts.moon_horizon
			? facts.sun_horizon === facts.moon_horizon
				? `both_${facts.sun_horizon}`
				: `sun_${facts.sun_horizon}_moon_${facts.moon_horizon}`
			: null;

	return (
		<WidgetFrame {...chrome} title={title} bodyClassName="flex flex-col gap-2">
			{facts ? (
				<div className="flex flex-wrap justify-end gap-1.5" data-handoff="MicroBadges">
					{facts.lunar_cycle_phase ? (
						<FocusRow id="badge:lunar" focus={{ bodies: ['sun', 'moon'] }} className="w-auto">
							<Badge
								variant="outline"
								className="pointer-events-none px-2 py-1 text-xs font-normal"
								data-handoff="MicroBadge_LunarPhase"
							>
								{t('info_lunar_phases')}: {t(`open_phase_${facts.lunar_cycle_phase}`)}
							</Badge>
						</FocusRow>
					) : null}
					{horizon ? (
						<FocusRow id="badge:lights" focus={{ bodies: ['sun', 'moon'] }} className="w-auto">
							<Badge
								variant="outline"
								className="pointer-events-none px-2 py-1 text-xs font-normal"
								data-handoff="MicroBadge_LightsHorizon"
							>
								{t(`open_horizon_${horizon}`)}
							</Badge>
						</FocusRow>
					) : null}
					{facts.mercury_phase || facts.venus_phase ? (
						<FocusRow
							id="badge:synodic"
							focus={{ bodies: ['mercury', 'venus'] }}
							className="w-auto"
						>
							<Badge
								variant="outline"
								className="pointer-events-none gap-1 px-2 py-1 text-xs font-normal"
								data-handoff="MicroBadge_SynodicRoles"
							>
								{facts.mercury_phase ? (
									<>
										<ObjectGlyph id="mercury" size={12} />
										{t(`open_mercury_${facts.mercury_phase}`)}
									</>
								) : null}
								{facts.venus_phase ? (
									<>
										<ObjectGlyph id="venus" size={12} />
										{t(`open_venus_${facts.venus_phase}`)}
									</>
								) : null}
							</Badge>
						</FocusRow>
					) : null}
				</div>
			) : null}
			<div className="flex min-h-[18rem] items-center justify-center" data-tour="spektrum-wheel">
				<div className="aspect-square h-full max-h-[40rem] w-full max-w-[40rem]">
					<HoroscopeWheel
						wheelStyle={wheelStyle}
						elementColors={elementColors}
						lightPlanetFill={lightPlanetFill}
						bodyLongitudes={wheel.wheelBodyLongitudes}
						bodyOrder={wheel.wheelBodyOrder}
						axisLongitudes={wheel.axisLongitudes}
						houseCusps={chart?.computed?.houseCusps}
						leftEdgeLongitude={wheel.ascLongitude}
						useFallbackData={false}
						showPlanetGlyphs
						showAxisLines
						radixAspects={wheel.radixAspects}
						aspectOrbsForRadix={workspaceDefaults.defaultAspectOrbs}
						aspectColorsForRadix={workspaceDefaults.defaultAspectColors}
						bodyColors={workspaceDefaults.bodyColors}
						aspectLineTierStyle={workspaceDefaults.aspectLineTierStyle}
						highlightBodies={highlighted}
						dimNonHighlighted={highlighted.size > 0}
						hemisphereOverlay={focus?.half ?? 'off'}
					/>
				</div>
			</div>
			<div data-handoff="Card_ShapeDiagram">
				<Text variant="compactLabel" tone="primary">
					{t('info_horoscope_shape_diagram')}
				</Text>
				<Text variant="caption" tone="muted">
					{shapes.length > 0
						? shapes.map((id) => shapeLabel(id, t, (key) => i18n.exists(key))).join(', ')
						: t('info_none')}
				</Text>
			</div>
		</WidgetFrame>
	);
}
