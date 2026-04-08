import React from 'react';
import { useTranslation } from 'react-i18next';
import { Theme } from './astrology-sidebar';

interface AspectariumProps {
	theme: Theme;
}

const planetSymbols: Record<string, string> = {
	sun: '☉',
	moon: '☽',
	mercury: '☿',
	venus: '♀',
	mars: '♂',
	jupiter: '♃',
	saturn: '♄',
	uranus: '♅',
	neptune: '♆',
	pluto: '♇',
	asc: 'ASC',
	dsc: 'DSC'
};

/** `internal_name` in translations.csv */
const planetLabelKeys: Record<string, string> = {
	sun: 'planet_sun',
	moon: 'planet_moon',
	mercury: 'planet_mercury',
	venus: 'planet_venus',
	mars: 'planet_mars',
	jupiter: 'planet_jupiter',
	saturn: 'planet_saturn',
	uranus: 'planet_uranus',
	neptune: 'planet_neptune',
	pluto: 'planet_pluto',
	asc: 'point_asc',
	dsc: 'point_dsc'
};

const planetRows = [
	['sun'],
	['moon', 'mercury'],
	['venus', 'mars', 'jupiter'],
	['saturn', 'uranus', 'neptune', 'pluto'],
	['asc', 'dsc']
] as const;

export function Aspectarium({ theme }: AspectariumProps) {
	const { t } = useTranslation();

	const themeStyles = {
		sunrise: {
			cardBg: 'bg-white/90',
			border: 'border-sky-200',
			text: 'text-gray-900',
			planetBg: 'bg-gradient-to-br from-sky-100 to-cyan-100',
			planetBorder: 'border-sky-300',
			planetText: 'text-sky-900',
			shadow: 'shadow-sm'
		},
		noon: {
			cardBg: 'bg-white',
			border: 'border-gray-200',
			text: 'text-gray-900',
			planetBg: 'bg-gradient-to-br from-indigo-50 to-purple-50',
			planetBorder: 'border-indigo-200',
			planetText: 'text-indigo-900',
			shadow: 'shadow-sm'
		},
		twilight: {
			cardBg: 'bg-white/10',
			border: 'border-indigo-400/30',
			text: 'text-white',
			planetBg: 'bg-gradient-to-br from-indigo-500/30 to-purple-500/30',
			planetBorder: 'border-indigo-400/50',
			planetText: 'text-white',
			shadow: 'shadow-lg shadow-indigo-900/20'
		},
		midnight: {
			cardBg: 'bg-slate-800/80',
			border: 'border-slate-700/50',
			text: 'text-slate-100',
			planetBg: 'bg-gradient-to-br from-indigo-900/40 to-purple-900/40',
			planetBorder: 'border-indigo-500/40',
			planetText: 'text-slate-100',
			shadow: 'shadow-xl shadow-black/40'
		}
	};

	const currentTheme = themeStyles[theme];

	return (
		<div className="flex h-full items-center justify-center p-8">
			<div className="w-full max-w-5xl">
				<div className="mb-12 text-center">
					<h1 className={`mb-3 text-3xl font-light ${currentTheme.text}`}>{t('aspects_aspects')}</h1>
					<p className={`text-sm opacity-70 ${currentTheme.text}`}>{t('aspectarium_subtitle')}</p>
				</div>

				<div className="flex flex-col items-center gap-8">
					{planetRows.map((row, rowIndex) => (
						<div
							key={rowIndex}
							className="flex items-center justify-center gap-6"
							style={{
								paddingLeft: rowIndex === 4 ? '0' : `${rowIndex * 40}px`
							}}
						>
							{row.map((planetKey) => (
								<div
									key={planetKey}
									className={`flex h-24 w-24 flex-col items-center justify-center rounded-2xl ${currentTheme.planetBg} ${currentTheme.shadow} border ${currentTheme.planetBorder} backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:shadow-lg`}
								>
									<div className={`mb-1 text-3xl ${currentTheme.planetText}`}>
										{planetSymbols[planetKey]}
									</div>
									<div className={`text-xs font-medium ${currentTheme.planetText} opacity-80`}>
										{t(planetLabelKeys[planetKey] ?? planetKey)}
									</div>
								</div>
							))}
						</div>
					))}
				</div>

				<div className="mt-12 text-center">
					<p className={`text-xs opacity-50 ${currentTheme.text}`}>{t('aspectarium_footer_note')}</p>
				</div>
			</div>
		</div>
	);
}
