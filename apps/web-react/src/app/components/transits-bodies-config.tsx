import { useTranslation } from 'react-i18next';
import type { AstrologyGlyphSetId } from '@/lib/astrology/glyphs';
import { AstrologyGlyph } from '@/ui/astrology-glyph';
import { Card, CardContent } from './ui/card';
import { cn } from './ui/utils';
import { useAppFormFieldTheme } from './form-field-theme';
import type { Theme } from './astrology-sidebar';

const PLANET_GLYPH_FALLBACK: Record<string, string> = {
	sun: '☉',
	moon: '☽',
	mercury: '☿',
	venus: '♀',
	mars: '♂',
	jupiter: '♃',
	saturn: '♄',
	uranus: '♅',
	neptune: '♆',
	pluto: '♇'
};

type TransitsBodiesConfigProps = {
	theme: Theme;
	glyphSet: AstrologyGlyphSetId;
	titleKey: 'transits_heading_transiting' | 'transits_heading_transited';
	subtitleKey: 'transits_subtitle_transiting' | 'transits_subtitle_transited';
};

export function TransitsBodiesConfig({ theme, glyphSet, titleKey, subtitleKey }: TransitsBodiesConfigProps) {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme(theme);

	return (
		<Card variant="ghost" className="w-full rounded-xl">
			<CardContent className="p-6 md:p-8">
				<div className="mb-8">
					<h1 className={cn('mb-2 text-2xl font-semibold', ft.title)}>{t(titleKey)}</h1>
					<p className={cn('text-sm', ft.muted)}>{t(subtitleKey)}</p>
				</div>

				<div className="mb-8 grid grid-cols-4 gap-8">
					<div className="flex flex-col gap-6">
						<div className="min-h-[116px]">
							<label className="mb-3 flex h-5 cursor-pointer items-center space-x-2">
								<input
									type="checkbox"
									className={cn('h-4 w-4 shrink-0 rounded', ft.checkboxAccent)}
								/>
								<span className={cn('text-sm font-semibold', ft.label)}>
									{t('transits_group_luminaries')}
								</span>
							</label>
							<div className="ml-6 flex flex-col gap-2">
								<label className="flex h-5 cursor-pointer items-center space-x-2">
									<input
										type="checkbox"
										className={cn('h-4 w-4 shrink-0 rounded', ft.checkboxAccent)}
									/>
									<span className={cn('inline-flex items-center gap-1.5 text-sm', ft.bodyText)}>
										<AstrologyGlyph
											glyphId="sun"
											glyphSet={glyphSet}
											fallback={PLANET_GLYPH_FALLBACK.sun}
											size={16}
											className="shrink-0"
										/>
										{t('planet_sun')}
									</span>
								</label>
								<label className="flex h-5 cursor-pointer items-center space-x-2">
									<input
										type="checkbox"
										className={cn('h-4 w-4 shrink-0 rounded', ft.checkboxAccent)}
									/>
									<span className={cn('inline-flex items-center gap-1.5 text-sm', ft.bodyText)}>
										<AstrologyGlyph
											glyphId="moon"
											glyphSet={glyphSet}
											fallback={PLANET_GLYPH_FALLBACK.moon}
											size={16}
											className="shrink-0"
										/>
										{t('planet_moon')}
									</span>
								</label>
							</div>
						</div>

						<div className="min-h-[88px]">
							<label className="mb-3 flex h-5 cursor-pointer items-center space-x-2">
								<input
									type="checkbox"
									className={cn('h-4 w-4 shrink-0 rounded', ft.checkboxAccent)}
								/>
								<span className={cn('text-sm font-semibold', ft.label)}>
									{t('transits_group_lunar_nodes')}
								</span>
							</label>
							<div className="ml-6 flex flex-col gap-2">
								<label className="flex h-5 cursor-pointer items-center space-x-2">
									<input
										type="checkbox"
										className={cn('h-4 w-4 shrink-0 rounded', ft.checkboxAccent)}
									/>
									<span className={cn('text-sm', ft.bodyText)}>{t('transits_node_mean')}</span>
								</label>
								<label className="flex h-5 cursor-pointer items-center space-x-2">
									<input
										type="checkbox"
										className={cn('h-4 w-4 shrink-0 rounded', ft.checkboxAccent)}
									/>
									<span className={cn('text-sm', ft.bodyText)}>{t('transits_node_true')}</span>
								</label>
							</div>
						</div>
					</div>

					<div className="flex flex-col gap-6">
						<div className="min-h-[116px]">
							<label className="mb-3 flex h-5 cursor-pointer items-center space-x-2">
								<input
									type="checkbox"
									className={cn('h-4 w-4 shrink-0 rounded', ft.checkboxAccent)}
								/>
								<span className={cn('text-sm font-semibold', ft.label)}>
									{t('transits_group_personal_planets')}
								</span>
							</label>
							<div className="ml-6 flex flex-col gap-2">
								<label className="flex h-5 cursor-pointer items-center space-x-2">
									<input
										type="checkbox"
										className={cn('h-4 w-4 shrink-0 rounded', ft.checkboxAccent)}
									/>
									<span className={cn('inline-flex items-center gap-1.5 text-sm', ft.bodyText)}>
										<AstrologyGlyph
											glyphId="mercury"
											glyphSet={glyphSet}
											fallback={PLANET_GLYPH_FALLBACK.mercury}
											size={16}
											className="shrink-0"
										/>
										{t('planet_mercury')}
									</span>
								</label>
								<label className="flex h-5 cursor-pointer items-center space-x-2">
									<input
										type="checkbox"
										className={cn('h-4 w-4 shrink-0 rounded', ft.checkboxAccent)}
									/>
									<span className={cn('inline-flex items-center gap-1.5 text-sm', ft.bodyText)}>
										<AstrologyGlyph
											glyphId="venus"
											glyphSet={glyphSet}
											fallback={PLANET_GLYPH_FALLBACK.venus}
											size={16}
											className="shrink-0"
										/>
										{t('planet_venus')}
									</span>
								</label>
								<label className="flex h-5 cursor-pointer items-center space-x-2">
									<input
										type="checkbox"
										className={cn('h-4 w-4 shrink-0 rounded', ft.checkboxAccent)}
									/>
									<span className={cn('inline-flex items-center gap-1.5 text-sm', ft.bodyText)}>
										<AstrologyGlyph
											glyphId="mars"
											glyphSet={glyphSet}
											fallback={PLANET_GLYPH_FALLBACK.mars}
											size={16}
											className="shrink-0"
										/>
										{t('planet_mars')}
									</span>
								</label>
							</div>
						</div>

						<div className="min-h-[88px]">
							<label className="mb-3 flex h-5 cursor-pointer items-center space-x-2">
								<input
									type="checkbox"
									className={cn('h-4 w-4 shrink-0 rounded', ft.checkboxAccent)}
								/>
								<span className={cn('text-sm font-semibold', ft.label)}>
									{t('transits_group_lunar_apsides')}
								</span>
							</label>
							<div className="ml-6 flex flex-col gap-2">
								<label className="flex h-5 cursor-pointer items-center space-x-2">
									<input
										type="checkbox"
										className={cn('h-4 w-4 shrink-0 rounded', ft.checkboxAccent)}
									/>
									<span className={cn('text-sm', ft.bodyText)}>
										{t('transits_black_moon_mean')}
									</span>
								</label>
								<label className="flex h-5 cursor-pointer items-center space-x-2">
									<input
										type="checkbox"
										className={cn('h-4 w-4 shrink-0 rounded', ft.checkboxAccent)}
									/>
									<span className={cn('text-sm', ft.bodyText)}>
										{t('transits_black_moon_natural')}
									</span>
								</label>
								<label className="flex h-5 cursor-pointer items-center space-x-2">
									<input
										type="checkbox"
										className={cn('h-4 w-4 shrink-0 rounded', ft.checkboxAccent)}
									/>
									<span className={cn('text-sm', ft.bodyText)}>{t('transits_black_moon_osc')}</span>
								</label>
							</div>
						</div>
					</div>

					<div className="flex flex-col gap-6">
						<div className="min-h-[116px]">
							<label className="mb-3 flex h-5 cursor-pointer items-center space-x-2">
								<input
									type="checkbox"
									className={cn('h-4 w-4 shrink-0 rounded', ft.checkboxAccent)}
								/>
								<span className={cn('text-sm font-semibold', ft.label)}>
									{t('transits_group_social')}
								</span>
							</label>
							<div className="ml-6 flex flex-col gap-2">
								<label className="flex h-5 cursor-pointer items-center space-x-2">
									<input
										type="checkbox"
										className={cn('h-4 w-4 shrink-0 rounded', ft.checkboxAccent)}
									/>
									<span className={cn('inline-flex items-center gap-1.5 text-sm', ft.bodyText)}>
										<AstrologyGlyph
											glyphId="jupiter"
											glyphSet={glyphSet}
											fallback={PLANET_GLYPH_FALLBACK.jupiter}
											size={16}
											className="shrink-0"
										/>
										{t('planet_jupiter')}
									</span>
								</label>
								<label className="flex h-5 cursor-pointer items-center space-x-2">
									<input
										type="checkbox"
										className={cn('h-4 w-4 shrink-0 rounded', ft.checkboxAccent)}
									/>
									<span className={cn('inline-flex items-center gap-1.5 text-sm', ft.bodyText)}>
										<AstrologyGlyph
											glyphId="saturn"
											glyphSet={glyphSet}
											fallback={PLANET_GLYPH_FALLBACK.saturn}
											size={16}
											className="shrink-0"
										/>
										{t('planet_saturn')}
									</span>
								</label>
							</div>
						</div>

						<div className="min-h-[88px]">
							<label className="mb-3 flex h-5 cursor-pointer items-center space-x-2">
								<input
									type="checkbox"
									className={cn('h-4 w-4 shrink-0 rounded', ft.checkboxAccent)}
								/>
								<span className={cn('text-sm font-semibold', ft.label)}>
									{t('transits_group_tno')}
								</span>
							</label>
							<div className="ml-6 flex flex-col gap-2">
								{[
									'⯰ Eris',
									'⯲ Sedna',
									'⯳ Haumea',
									'⯴ Makemake',
									'⯵ Quaoar',
									'⯶ Orcus',
									'⯷ Varuna'
								].map((label) => (
									<label key={label} className="flex h-5 cursor-pointer items-center space-x-2">
										<input
											type="checkbox"
											className={cn('h-4 w-4 shrink-0 rounded', ft.checkboxAccent)}
										/>
										<span className={cn('text-sm', ft.bodyText)}>{label}</span>
									</label>
								))}
							</div>
						</div>
					</div>

					<div className="flex flex-col gap-6">
						<div className="min-h-[116px]">
							<label className="mb-3 flex h-5 cursor-pointer items-center space-x-2">
								<input
									type="checkbox"
									className={cn('h-4 w-4 shrink-0 rounded', ft.checkboxAccent)}
								/>
								<span className={cn('text-sm font-semibold', ft.label)}>
									{t('transits_group_transpersonal')}
								</span>
							</label>
							<div className="ml-6 flex flex-col gap-2">
								<label className="flex h-5 cursor-pointer items-center space-x-2">
									<input
										type="checkbox"
										className={cn('h-4 w-4 shrink-0 rounded', ft.checkboxAccent)}
									/>
									<span className={cn('inline-flex items-center gap-1.5 text-sm', ft.bodyText)}>
										<AstrologyGlyph
											glyphId="uranus"
											glyphSet={glyphSet}
											fallback={PLANET_GLYPH_FALLBACK.uranus}
											size={16}
											className="shrink-0"
										/>
										{t('planet_uranus')}
									</span>
								</label>
								<label className="flex h-5 cursor-pointer items-center space-x-2">
									<input
										type="checkbox"
										className={cn('h-4 w-4 shrink-0 rounded', ft.checkboxAccent)}
									/>
									<span className={cn('inline-flex items-center gap-1.5 text-sm', ft.bodyText)}>
										<AstrologyGlyph
											glyphId="neptune"
											glyphSet={glyphSet}
											fallback={PLANET_GLYPH_FALLBACK.neptune}
											size={16}
											className="shrink-0"
										/>
										{t('planet_neptune')}
									</span>
								</label>
								<label className="flex h-5 cursor-pointer items-center space-x-2">
									<input
										type="checkbox"
										className={cn('h-4 w-4 shrink-0 rounded', ft.checkboxAccent)}
									/>
									<span className={cn('inline-flex items-center gap-1.5 text-sm', ft.bodyText)}>
										<AstrologyGlyph
											glyphId="pluto"
											glyphSet={glyphSet}
											fallback={PLANET_GLYPH_FALLBACK.pluto}
											size={16}
											className="shrink-0"
										/>
										{t('planet_pluto')}
									</span>
								</label>
							</div>
						</div>

						<div className="min-h-[88px]">
							<label className="mb-3 flex h-5 cursor-pointer items-center space-x-2">
								<input
									type="checkbox"
									className={cn('h-4 w-4 shrink-0 rounded', ft.checkboxAccent)}
								/>
								<span className={cn('text-sm font-semibold', ft.label)}>
									{t('transits_group_asteroids')}
								</span>
							</label>
							<div className="ml-6 flex flex-col gap-2">
								{['⚳ Ceres', '⚴ Pallas', '⚵ Juno', '⚶ Vesta', '⚷ Chiron', '⯛ Pholus'].map(
									(label) => (
										<label key={label} className="flex h-5 cursor-pointer items-center space-x-2">
											<input
												type="checkbox"
												className={cn('h-4 w-4 shrink-0 rounded', ft.checkboxAccent)}
											/>
											<span className={cn('text-sm', ft.bodyText)}>{label}</span>
										</label>
									)
								)}
							</div>
						</div>
					</div>
				</div>

				<div className="mb-8 grid grid-cols-2 gap-8">
					<div>
						<label className="mb-3 flex cursor-pointer items-center space-x-2">
							<input
								type="checkbox"
								className={cn('h-4 w-4 rounded', ft.checkboxAccent)}
							/>
							<span className={cn('text-sm font-semibold', ft.label)}>
								{t('transits_group_geo_nodes')}
							</span>
						</label>
						<div className="ml-6 grid grid-cols-2 gap-x-8 gap-y-2">
							{(
								[
									'transits_geo_mercury',
									'transits_geo_saturn',
									'transits_geo_venus',
									'transits_geo_uranus',
									'transits_geo_mars',
									'transits_geo_neptune',
									'transits_geo_jupiter',
									'transits_geo_pluto'
								] as const
							).map((key) => (
								<label key={key} className="flex cursor-pointer items-center space-x-2">
									<input
										type="checkbox"
										className={cn('h-4 w-4 rounded', ft.checkboxAccent)}
									/>
									<span className={cn('text-sm', ft.bodyText)}>{t(key)}</span>
								</label>
							))}
						</div>
					</div>

					<div>
						<label className="mb-3 flex cursor-pointer items-center space-x-2">
							<input
								type="checkbox"
								className={cn('h-4 w-4 rounded', ft.checkboxAccent)}
							/>
							<span className={cn('text-sm font-semibold', ft.label)}>
								{t('transits_group_hypotheticals')}
							</span>
						</label>
						<div className="ml-6 grid grid-cols-2 gap-x-8 gap-y-2">
							{[
								'⚻ Cupido',
								'⯛ Apollon',
								'⯚ Hades',
								'⯰ Admetos',
								'⯙ Zeus',
								'⯲ Vulcanus',
								'⯘ Kronos',
								'⯰ Poseidon'
							].map((label) => (
								<label key={label} className="flex cursor-pointer items-center space-x-2">
									<input
										type="checkbox"
										className={cn('h-4 w-4 rounded', ft.checkboxAccent)}
									/>
									<span className={cn('text-sm', ft.bodyText)}>{label}</span>
								</label>
							))}
						</div>
					</div>
				</div>

				<div className="flex items-center justify-center gap-4 pt-6">
					<button type="button" className={cn(ft.footerCancel, '!flex-none text-sm')}>
						{t('button_close')}
					</button>
					<button type="button" className={cn(ft.footerPrimary, '!flex-none text-sm')}>
						{t('button_ok')}
					</button>
				</div>
			</CardContent>
		</Card>
	);
}
