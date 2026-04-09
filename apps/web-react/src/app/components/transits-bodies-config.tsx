import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from './ui/utils';
import { getAppFormFieldTheme } from './form-field-theme';
import type { Theme } from './astrology-sidebar';

type TransitsBodiesConfigProps = {
	theme: Theme;
	titleKey: 'transits_heading_transiting' | 'transits_heading_transited';
	subtitleKey: 'transits_subtitle_transiting' | 'transits_subtitle_transited';
};

export function TransitsBodiesConfig({ theme, titleKey, subtitleKey }: TransitsBodiesConfigProps) {
	const { t } = useTranslation();
	const ft = useMemo(() => getAppFormFieldTheme(theme), [theme]);

	return (
		<div className="h-full min-h-0 w-full overflow-y-auto">
			<div
				className={cn('mx-auto w-full max-w-6xl rounded-xl border p-8 shadow-lg', ft.settingsCard)}
			>
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
									className="h-4 w-4 shrink-0 rounded text-indigo-600 focus:ring-indigo-500"
								/>
								<span className={cn('text-sm font-semibold', ft.label)}>
									{t('transits_group_luminaries')}
								</span>
							</label>
							<div className="ml-6 flex flex-col gap-2">
								<label className="flex h-5 cursor-pointer items-center space-x-2">
									<input
										type="checkbox"
										className="h-4 w-4 shrink-0 rounded text-indigo-600 focus:ring-indigo-500"
									/>
									<span className={cn('text-sm', ft.bodyText)}>☉ {t('planet_sun')}</span>
								</label>
								<label className="flex h-5 cursor-pointer items-center space-x-2">
									<input
										type="checkbox"
										className="h-4 w-4 shrink-0 rounded text-indigo-600 focus:ring-indigo-500"
									/>
									<span className={cn('text-sm', ft.bodyText)}>☽ {t('planet_moon')}</span>
								</label>
							</div>
						</div>

						<div className="min-h-[88px]">
							<label className="mb-3 flex h-5 cursor-pointer items-center space-x-2">
								<input
									type="checkbox"
									className="h-4 w-4 shrink-0 rounded text-indigo-600 focus:ring-indigo-500"
								/>
								<span className={cn('text-sm font-semibold', ft.label)}>
									{t('transits_group_lunar_nodes')}
								</span>
							</label>
							<div className="ml-6 flex flex-col gap-2">
								<label className="flex h-5 cursor-pointer items-center space-x-2">
									<input
										type="checkbox"
										className="h-4 w-4 shrink-0 rounded text-indigo-600 focus:ring-indigo-500"
									/>
									<span className={cn('text-sm', ft.bodyText)}>{t('transits_node_mean')}</span>
								</label>
								<label className="flex h-5 cursor-pointer items-center space-x-2">
									<input
										type="checkbox"
										className="h-4 w-4 shrink-0 rounded text-indigo-600 focus:ring-indigo-500"
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
									className="h-4 w-4 shrink-0 rounded text-indigo-600 focus:ring-indigo-500"
								/>
								<span className={cn('text-sm font-semibold', ft.label)}>
									{t('transits_group_personal_planets')}
								</span>
							</label>
							<div className="ml-6 flex flex-col gap-2">
								<label className="flex h-5 cursor-pointer items-center space-x-2">
									<input
										type="checkbox"
										className="h-4 w-4 shrink-0 rounded text-indigo-600 focus:ring-indigo-500"
									/>
									<span className={cn('text-sm', ft.bodyText)}>☿ {t('planet_mercury')}</span>
								</label>
								<label className="flex h-5 cursor-pointer items-center space-x-2">
									<input
										type="checkbox"
										className="h-4 w-4 shrink-0 rounded text-indigo-600 focus:ring-indigo-500"
									/>
									<span className={cn('text-sm', ft.bodyText)}>♀ {t('planet_venus')}</span>
								</label>
								<label className="flex h-5 cursor-pointer items-center space-x-2">
									<input
										type="checkbox"
										className="h-4 w-4 shrink-0 rounded text-indigo-600 focus:ring-indigo-500"
									/>
									<span className={cn('text-sm', ft.bodyText)}>♂ {t('planet_mars')}</span>
								</label>
							</div>
						</div>

						<div className="min-h-[88px]">
							<label className="mb-3 flex h-5 cursor-pointer items-center space-x-2">
								<input
									type="checkbox"
									className="h-4 w-4 shrink-0 rounded text-indigo-600 focus:ring-indigo-500"
								/>
								<span className={cn('text-sm font-semibold', ft.label)}>
									{t('transits_group_lunar_apsides')}
								</span>
							</label>
							<div className="ml-6 flex flex-col gap-2">
								<label className="flex h-5 cursor-pointer items-center space-x-2">
									<input
										type="checkbox"
										className="h-4 w-4 shrink-0 rounded text-indigo-600 focus:ring-indigo-500"
									/>
									<span className={cn('text-sm', ft.bodyText)}>
										{t('transits_black_moon_mean')}
									</span>
								</label>
								<label className="flex h-5 cursor-pointer items-center space-x-2">
									<input
										type="checkbox"
										className="h-4 w-4 shrink-0 rounded text-indigo-600 focus:ring-indigo-500"
									/>
									<span className={cn('text-sm', ft.bodyText)}>
										{t('transits_black_moon_natural')}
									</span>
								</label>
								<label className="flex h-5 cursor-pointer items-center space-x-2">
									<input
										type="checkbox"
										className="h-4 w-4 shrink-0 rounded text-indigo-600 focus:ring-indigo-500"
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
									className="h-4 w-4 shrink-0 rounded text-indigo-600 focus:ring-indigo-500"
								/>
								<span className={cn('text-sm font-semibold', ft.label)}>
									{t('transits_group_social')}
								</span>
							</label>
							<div className="ml-6 flex flex-col gap-2">
								<label className="flex h-5 cursor-pointer items-center space-x-2">
									<input
										type="checkbox"
										className="h-4 w-4 shrink-0 rounded text-indigo-600 focus:ring-indigo-500"
									/>
									<span className={cn('text-sm', ft.bodyText)}>♃ {t('planet_jupiter')}</span>
								</label>
								<label className="flex h-5 cursor-pointer items-center space-x-2">
									<input
										type="checkbox"
										className="h-4 w-4 shrink-0 rounded text-indigo-600 focus:ring-indigo-500"
									/>
									<span className={cn('text-sm', ft.bodyText)}>♄ {t('planet_saturn')}</span>
								</label>
							</div>
						</div>

						<div className="min-h-[88px]">
							<label className="mb-3 flex h-5 cursor-pointer items-center space-x-2">
								<input
									type="checkbox"
									className="h-4 w-4 shrink-0 rounded text-indigo-600 focus:ring-indigo-500"
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
											className="h-4 w-4 shrink-0 rounded text-indigo-600 focus:ring-indigo-500"
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
									className="h-4 w-4 shrink-0 rounded text-indigo-600 focus:ring-indigo-500"
								/>
								<span className={cn('text-sm font-semibold', ft.label)}>
									{t('transits_group_transpersonal')}
								</span>
							</label>
							<div className="ml-6 flex flex-col gap-2">
								<label className="flex h-5 cursor-pointer items-center space-x-2">
									<input
										type="checkbox"
										className="h-4 w-4 shrink-0 rounded text-indigo-600 focus:ring-indigo-500"
									/>
									<span className={cn('text-sm', ft.bodyText)}>♅ {t('planet_uranus')}</span>
								</label>
								<label className="flex h-5 cursor-pointer items-center space-x-2">
									<input
										type="checkbox"
										className="h-4 w-4 shrink-0 rounded text-indigo-600 focus:ring-indigo-500"
									/>
									<span className={cn('text-sm', ft.bodyText)}>♆ {t('planet_neptune')}</span>
								</label>
								<label className="flex h-5 cursor-pointer items-center space-x-2">
									<input
										type="checkbox"
										className="h-4 w-4 shrink-0 rounded text-indigo-600 focus:ring-indigo-500"
									/>
									<span className={cn('text-sm', ft.bodyText)}>♇ {t('planet_pluto')}</span>
								</label>
							</div>
						</div>

						<div className="min-h-[88px]">
							<label className="mb-3 flex h-5 cursor-pointer items-center space-x-2">
								<input
									type="checkbox"
									className="h-4 w-4 shrink-0 rounded text-indigo-600 focus:ring-indigo-500"
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
												className="h-4 w-4 shrink-0 rounded text-indigo-600 focus:ring-indigo-500"
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
								className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
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
										className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
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
								className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
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
										className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
									/>
									<span className={cn('text-sm', ft.bodyText)}>{label}</span>
								</label>
							))}
						</div>
					</div>
				</div>

				<div
					className={cn('flex items-center justify-center gap-4 border-t pt-6', ft.footerBorder)}
				>
					<button type="button" className={cn(ft.footerCancel, '!flex-none text-sm')}>
						{t('button_close')}
					</button>
					<button type="button" className={cn(ft.footerPrimary, '!flex-none text-sm')}>
						{t('button_ok')}
					</button>
				</div>
			</div>
		</div>
	);
}
