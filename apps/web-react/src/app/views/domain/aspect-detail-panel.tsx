import { Text, Heading } from '@/app/components/ui/typography';
import { useTranslation } from 'react-i18next';
import { AstrologyGlyph } from '@/ui/astrology-glyph';
import { ASPECT_GLYPHS } from '@/lib/astrology/aspects';
import { aspectLabel } from '@/lib/astrology/objectLabels';
import type { ParsedAspect } from '@/lib/astrology/aspectParsing';
import type { ObjectDetailViewModel } from '@/lib/astrology/objectDetail';
import { useAppFormFieldTheme } from '@/app/components/form-field-theme';
import { ObjectDetailSections } from '@/app/views/domain/object-detail-panel';
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger
} from '@/app/components/ui/accordion';
import { cn } from '@/app/components/ui/utils';

function formatDegrees(value: number | undefined, digits = 2) {
	return Number.isFinite(value) ? `${value!.toFixed(digits)}°` : null;
}

interface AspectDetailPanelProps {
	aspect: ParsedAspect;
	fromObject: ObjectDetailViewModel;
	toObject: ObjectDetailViewModel;
}

/** Shown for a clicked aspect line (radix wheel) or a selected cell/row (aspectarium): the
 *  aspect's own facts, followed by each side's full body detail — the exact same
 *  `ObjectDetailSections` the radix wheel's own planet-click panel uses — each collapsed inside
 *  its own accordion item so the panel doesn't open already fighting three sections for space. */
export function AspectDetailPanel({ aspect, fromObject, toObject }: AspectDetailPanelProps) {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme();
	const textColor = ft.title;
	const mutedColor = ft.muted;

	return (
		<div className="space-y-4">
			<div className="flex items-center gap-3">
				<div className="flex items-center gap-2">
					<AstrologyGlyph glyphId={fromObject.bodyId} fallback={fromObject.icon} size={20} />
					<Text variant="label" as="span" className={textColor}>
						{fromObject.label}
					</Text>
				</div>
				<span className="flex items-center justify-center text-xl leading-none">
					<AstrologyGlyph
						glyphId={aspect.type}
						domain="aspect"
						fallback={ASPECT_GLYPHS[aspect.type] ?? '•'}
						size={22}
					/>
				</span>
				<div className="flex items-center gap-2">
					<AstrologyGlyph glyphId={toObject.bodyId} fallback={toObject.icon} size={20} />
					<Text variant="label" as="span" className={textColor}>
						{toObject.label}
					</Text>
				</div>
			</div>

			<Accordion type="multiple" defaultValue={['aspect-details']}>
				<AccordionItem value="aspect-details" className="border-0">
					<AccordionTrigger className="py-2 hover:no-underline">
						<Heading variant="panelTitle" level={4} className={textColor}>
							{t('details')}
						</Heading>
					</AccordionTrigger>
					<AccordionContent className="pt-1">
						<div className="space-y-2 text-sm">
							<div className="flex items-center justify-between gap-3">
								<span className={mutedColor}>{t('transits_label_type')}</span>
								<span className={textColor}>{aspectLabel(aspect.type, t)}</span>
							</div>
							<div className="flex items-center justify-between gap-3">
								<span className={mutedColor}>{t('label_orb')}</span>
								<span className={cn('font-mono tabular-nums', textColor)}>
									{formatDegrees(Math.abs(aspect.orb), 4)}
								</span>
							</div>
							{aspect.angle !== undefined && (
								<div className="flex items-center justify-between gap-3">
									<span className={mutedColor}>{t('aspectarium_angle')}</span>
									<span className={cn('font-mono tabular-nums', textColor)}>
										{formatDegrees(aspect.angle)}
									</span>
								</div>
							)}
							{aspect.exactAngle !== undefined && (
								<div className="flex items-center justify-between gap-3">
									<span className={mutedColor}>{t('aspectarium_exact_angle')}</span>
									<span className={cn('font-mono tabular-nums', textColor)}>
										{formatDegrees(aspect.exactAngle)}
									</span>
								</div>
							)}
							{aspect.applying !== undefined && (
								<div className="flex items-center justify-between gap-3">
									<span className={mutedColor}>{t('aspectarium_applying')}</span>
									<span className={textColor}>{aspect.applying ? t('selected') : '—'}</span>
								</div>
							)}
							{aspect.separating !== undefined && (
								<div className="flex items-center justify-between gap-3">
									<span className={mutedColor}>{t('aspectarium_separating')}</span>
									<span className={textColor}>{aspect.separating ? t('selected') : '—'}</span>
								</div>
							)}
						</div>
					</AccordionContent>
				</AccordionItem>

				<AccordionItem value="from-object" className="border-0">
					<AccordionTrigger className="py-2 hover:no-underline">
						<div className="flex items-center gap-2">
							<AstrologyGlyph glyphId={fromObject.bodyId} fallback={fromObject.icon} size={18} />
							<Heading variant="panelTitle" level={4} className={textColor}>
								{fromObject.label}
							</Heading>
							<Text variant="caption" as="span" className={mutedColor}>
								{fromObject.layerLabel}
							</Text>
						</div>
					</AccordionTrigger>
					<AccordionContent className="pt-1">
						<ObjectDetailSections data={fromObject} />
					</AccordionContent>
				</AccordionItem>

				<AccordionItem value="to-object" className="border-0">
					<AccordionTrigger className="py-2 hover:no-underline">
						<div className="flex items-center gap-2">
							<AstrologyGlyph glyphId={toObject.bodyId} fallback={toObject.icon} size={18} />
							<Heading variant="panelTitle" level={4} className={textColor}>
								{toObject.label}
							</Heading>
							<Text variant="caption" as="span" className={mutedColor}>
								{toObject.layerLabel}
							</Text>
						</div>
					</AccordionTrigger>
					<AccordionContent className="pt-1">
						<ObjectDetailSections data={toObject} />
					</AccordionContent>
				</AccordionItem>
			</Accordion>
		</div>
	);
}
