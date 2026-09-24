import { useTranslation } from 'react-i18next';
import { AstrologyGlyph } from '@/ui/astrology-glyph';
import { ASPECT_GLYPHS } from '@/lib/astrology/aspects';
import {
	aspectLabel,
	configurationLabel,
	objectIcon,
	objectLabel,
	shapeLabel
} from '@/lib/astrology/objectLabels';
import type { ObjectDetailViewModel } from '@/lib/astrology/objectDetail';
import type { AstrologyGlyphSetId } from '@/lib/astrology/glyphs';
import type { Theme } from './astrology-sidebar';
import { useAppFormFieldTheme } from './form-field-theme';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { Badge } from './ui/badge';
import { cn } from './ui/utils';

interface ObjectDetailSectionsProps {
	theme: Theme;
	glyphSet: AstrologyGlyphSetId;
	data: ObjectDetailViewModel;
	/** `single`+`collapsible` (nested inside an aspect's accordion item, where space is tight)
	 *  or `multiple` (the object is the whole panel, so several sections open at once reads better). */
	variant?: 'standalone' | 'nested';
}

/** The reusable core shown for one body wherever it appears: the radix wheel's own planet-click
 *  panel, and — nested inside an aspect's own detail — each side of the aspect. Four expandable
 *  sections: position facts, symbolic-degree systems (Sabian today, room for more), the chart's
 *  shapes/configurations, and the aspects touching this body. */
export function ObjectDetailSections({
	theme,
	glyphSet,
	data,
	variant = 'standalone'
}: ObjectDetailSectionsProps) {
	const { t, i18n } = useTranslation();
	const ft = useAppFormFieldTheme(theme);
	const textColor = ft.title;
	const mutedColor = ft.muted;
	const exists = (key: string) => i18n.exists(key);

	const hasShapesOrConfigurations =
		data.chartShapeIds.length > 0 || data.chartConfigurationIds.length > 0;

	return (
		<Accordion
			type="multiple"
			defaultValue={
				variant === 'standalone' ? ['details', 'symbols', 'shapes', 'aspects'] : ['details']
			}
		>
			<AccordionItem value="details" className="border-0">
				<AccordionTrigger className="py-2 hover:no-underline">
					<h4 className={cn('text-sm font-semibold', textColor)}>{t('details')}</h4>
				</AccordionTrigger>
				<AccordionContent className="pt-1">
					<div className="space-y-2 text-sm">
						<div className="flex items-center justify-between gap-3">
							<span className={mutedColor}>{t('aspectarium_position')}</span>
							<span className={cn('flex items-center gap-1 font-mono tabular-nums', textColor)}>
								{data.degrees}°
								<AstrologyGlyph
									glyphId={data.signZodiacId}
									glyphSet={glyphSet}
									domain="zodiac"
									fallback={data.signGlyphFallback}
									size={18}
								/>
								{data.minutes}' {data.seconds}"
							</span>
						</div>
						<div className="flex items-center justify-between gap-3">
							<span className={mutedColor}>{t('open_filter_sign')}</span>
							<span className={cn('flex items-center gap-1.5', textColor)}>
								<AstrologyGlyph
									glyphId={data.signZodiacId}
									glyphSet={glyphSet}
									domain="zodiac"
									fallback={data.signGlyphFallback}
									size={16}
								/>
								{t(`open_sign_${data.signZodiacId}`)}
							</span>
						</div>
						<div className="flex items-center justify-between gap-3">
							<span className={mutedColor}>{t('detail_element')}</span>
							<span className={textColor}>{t(`open_element_${data.element}`)}</span>
						</div>
						{data.houseNumber != null && (
							<div className="flex items-center justify-between gap-3">
								<span className={mutedColor}>{t('open_filter_house')}</span>
								<span className={cn('font-mono tabular-nums', textColor)}>{data.houseNumber}</span>
							</div>
						)}
						<div className="flex items-center justify-between gap-3">
							<span className={mutedColor}>{t('aspectarium_absolute_longitude')}</span>
							<span className={cn('font-mono tabular-nums', textColor)}>
								{data.longitude.toFixed(4)}°
							</span>
						</div>
						<div className="flex items-center justify-between gap-3">
							<span className={mutedColor}>{t('open_filter_motion')}</span>
							<span className={textColor}>{t(`open_motion_${data.motionState}`)}</span>
						</div>
						{data.speed !== undefined && (
							<div className="flex items-center justify-between gap-3">
								<span className={mutedColor}>{t('detail_speed')}</span>
								<span className={cn('font-mono tabular-nums', textColor)}>
									{data.speed.toFixed(4)}°/{t('open_date_day').toLowerCase()}
								</span>
							</div>
						)}
						{data.rightAscension !== undefined && (
							<div className="flex items-center justify-between gap-3">
								<span className={mutedColor}>{t('detail_right_ascension')}</span>
								<span className={cn('font-mono tabular-nums', textColor)}>
									{data.rightAscension.toFixed(4)}°
								</span>
							</div>
						)}
						{data.declination !== undefined && (
							<div className="flex items-center justify-between gap-3">
								<span className={mutedColor}>{t('detail_declination')}</span>
								<span className={cn('font-mono tabular-nums', textColor)}>
									{data.declination.toFixed(4)}°
								</span>
							</div>
						)}
						{data.azimuth !== undefined && (
							<div className="flex items-center justify-between gap-3">
								<span className={mutedColor}>{t('detail_azimuth')}</span>
								<span className={cn('font-mono tabular-nums', textColor)}>
									{data.azimuth.toFixed(4)}°
								</span>
							</div>
						)}
						{data.altitude !== undefined && (
							<div className="flex items-center justify-between gap-3">
								<span className={mutedColor}>{t('detail_altitude')}</span>
								<span className={cn('font-mono tabular-nums', textColor)}>
									{data.altitude.toFixed(4)}°
								</span>
							</div>
						)}
					</div>
				</AccordionContent>
			</AccordionItem>

			{data.symbols.length > 0 && (
				<AccordionItem value="symbols" className="border-0">
					<AccordionTrigger className="py-2 hover:no-underline">
						<h4 className={cn('text-sm font-semibold', textColor)}>{t('detail_symbols')}</h4>
					</AccordionTrigger>
					<AccordionContent className="space-y-3 pt-1">
						{data.symbols.map((symbol) => (
							<div key={symbol.systemId} className="space-y-1">
								<p className={cn('text-xs font-semibold tracking-wide uppercase', mutedColor)}>
									{symbol.label}
								</p>
								<p className={cn('text-sm italic', textColor)}>{symbol.text}</p>
							</div>
						))}
					</AccordionContent>
				</AccordionItem>
			)}

			{hasShapesOrConfigurations && (
				<AccordionItem value="shapes" className="border-0">
					<AccordionTrigger className="py-2 hover:no-underline">
						<h4 className={cn('text-sm font-semibold', textColor)}>{t('detail_shapes')}</h4>
					</AccordionTrigger>
					<AccordionContent className="space-y-3 pt-1">
						{data.chartShapeIds.length > 0 && (
							<div className="space-y-1.5">
								<p className={cn('text-xs font-semibold tracking-wide uppercase', mutedColor)}>
									{t('open_filter_chart_shape')}
								</p>
								<div className="flex flex-wrap gap-1.5">
									{data.chartShapeIds.map((id) => (
										<Badge key={id} variant="outline" className="px-2 py-1 text-xs">
											{shapeLabel(id, t, exists)}
										</Badge>
									))}
								</div>
							</div>
						)}
						{data.chartConfigurationIds.length > 0 && (
							<div className="space-y-1.5">
								<p className={cn('text-xs font-semibold tracking-wide uppercase', mutedColor)}>
									{t('info_planetary_configuration')}
								</p>
								<div className="flex flex-wrap gap-1.5">
									{data.chartConfigurationIds.map((id) => (
										<Badge key={id} variant="outline" className="px-2 py-1 text-xs">
											{configurationLabel(id, t, exists)}
										</Badge>
									))}
								</div>
							</div>
						)}
					</AccordionContent>
				</AccordionItem>
			)}

			<AccordionItem value="aspects" className="border-0">
				<AccordionTrigger className="py-2 hover:no-underline">
					<h4 className={cn('text-sm font-semibold', textColor)}>
						{t('aspects')} ({data.aspects.length})
					</h4>
				</AccordionTrigger>
				<AccordionContent className="pt-1">
					{data.aspects.length > 0 ? (
						<div className="space-y-2">
							{data.aspects.map((aspect, index) => {
								const otherId = aspect.from === data.bodyId ? aspect.to : aspect.from;
								return (
									<div
										key={`${aspect.from}-${aspect.to}-${aspect.type}-${index}`}
										className="rounded-lg bg-[color:var(--theme-soft-bg)] px-3 py-2"
									>
										<div className="flex items-center justify-between gap-3 text-sm">
											<span className={cn('flex items-center gap-1.5', textColor)}>
												{objectLabel(otherId, t)}
												<AstrologyGlyph
													glyphId={otherId}
													glyphSet={glyphSet}
													fallback={objectIcon(otherId)}
													size={16}
												/>
											</span>
											<span className={cn('flex items-center gap-1.5', mutedColor)}>
												<AstrologyGlyph
													glyphId={aspect.type}
													glyphSet={glyphSet}
													domain="aspect"
													fallback={ASPECT_GLYPHS[aspect.type] ?? '•'}
													size={16}
												/>
												{aspectLabel(aspect.type, t)}
											</span>
										</div>
										<div className={cn('mt-1 text-right font-mono text-xs tabular-nums', mutedColor)}>
											{t('label_orb')}: {aspect.orb.toFixed(2)}°
										</div>
									</div>
								);
							})}
						</div>
					) : (
						<p className={cn('text-sm', mutedColor)}>{t('aspectarium_no_aspects')}</p>
					)}
				</AccordionContent>
			</AccordionItem>
		</Accordion>
	);
}

interface ObjectDetailPanelProps {
	theme: Theme;
	glyphSet: AstrologyGlyphSetId;
	data: ObjectDetailViewModel;
}

/** Standalone use (the radix wheel's own planet-click panel): a glyph header above the shared
 *  `ObjectDetailSections`. When nesting this body's details inside an aspect's own panel instead,
 *  use `ObjectDetailSections` directly — the accordion item that holds it is already the header. */
export function ObjectDetailPanel({ theme, glyphSet, data }: ObjectDetailPanelProps) {
	const ft = useAppFormFieldTheme(theme);

	return (
		<div className="space-y-3">
			<div className="flex items-center gap-3">
				<AstrologyGlyph
					glyphId={data.bodyId}
					glyphSet={glyphSet}
					fallback={data.icon}
					size={28}
					title={data.label}
				/>
				<div className={cn('text-base font-semibold', ft.title)}>{data.label}</div>
			</div>
			<ObjectDetailSections theme={theme} glyphSet={glyphSet} data={data} variant="standalone" />
		</div>
	);
}
