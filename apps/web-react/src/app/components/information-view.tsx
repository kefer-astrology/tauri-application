import React from 'react';
import { useTranslation } from 'react-i18next';
import { Theme } from './astrology-sidebar';
import { cn } from './ui/utils';

interface InformationViewProps {
	theme: Theme;
}

const zodiacSigns = [
	{ name: 'Aries', icon: '♈', angle: 0 },
	{ name: 'Taurus', icon: '♉', angle: 30 },
	{ name: 'Gemini', icon: '♊', angle: 60 },
	{ name: 'Cancer', icon: '♋', angle: 90 },
	{ name: 'Leo', icon: '♌', angle: 120 },
	{ name: 'Virgo', icon: '♍', angle: 150 },
	{ name: 'Libra', icon: '♎', angle: 180 },
	{ name: 'Scorpio', icon: '♏', angle: 210 },
	{ name: 'Sagittarius', icon: '♐', angle: 240 },
	{ name: 'Capricorn', icon: '♑', angle: 270 },
	{ name: 'Aquarius', icon: '♒', angle: 300 },
	{ name: 'Pisces', icon: '♓', angle: 330 }
];

function HoroscopeWheel({ theme }: { theme: Theme }) {
	const isDark = theme === 'midnight' || theme === 'twilight';
	const wheelSize = 800;
	const center = wheelSize / 2;
	const outerRadius = 320;
	const innerRadius = 270;
	const innerCenterRing = 184;
	const innerCenterCore = 152;

	// Zodiac signs with their exact positions and colors matching image
	const zodiacWithColors = [
		{ ...zodiacSigns[0], color: '#ef4444' }, // Aries - red
		{ ...zodiacSigns[1], color: '#000000' }, // Taurus - black
		{ ...zodiacSigns[2], color: '#22c55e' }, // Gemini - green
		{ ...zodiacSigns[3], color: '#3b82f6' }, // Cancer - blue
		{ ...zodiacSigns[4], color: '#ef4444' }, // Leo - red
		{ ...zodiacSigns[5], color: '#000000' }, // Virgo - black
		{ ...zodiacSigns[6], color: '#22c55e' }, // Libra - green
		{ ...zodiacSigns[7], color: '#3b82f6' }, // Scorpio - blue
		{ ...zodiacSigns[8], color: '#ef4444' }, // Sagittarius - red
		{ ...zodiacSigns[9], color: '#000000' }, // Capricorn - black
		{ ...zodiacSigns[10], color: '#22c55e' }, // Aquarius - green
		{ ...zodiacSigns[11], color: '#3b82f6' } // Pisces - blue
	];

	return (
		<svg
			width="100%"
			height="100%"
			viewBox={`0 0 ${wheelSize} ${wheelSize}`}
			className="max-h-full max-w-full"
			preserveAspectRatio="xMidYMid meet"
		>
			{/* White background */}
			<circle
				cx={center}
				cy={center}
				r={outerRadius + 60}
				fill={isDark ? 'rgba(255,255,255,0.03)' : '#ffffff'}
			/>

			{/* Outer Circle */}
			<circle
				cx={center}
				cy={center}
				r={outerRadius}
				fill="none"
				stroke={isDark ? 'rgba(255,255,255,0.5)' : '#000000'}
				strokeWidth="1.5"
			/>

			{/* Inner Circle (main ring inner boundary) */}
			<circle
				cx={center}
				cy={center}
				r={innerRadius}
				fill="none"
				stroke={isDark ? 'rgba(255,255,255,0.5)' : '#000000'}
				strokeWidth="1.5"
			/>

			{/* House Cusps - 12 radial lines dividing the wheel */}
			{zodiacSigns.map((sign, idx) => {
				const angle = sign.angle - 90;
				const rad = (angle * Math.PI) / 180;

				const x1 = center + innerRadius * Math.cos(rad);
				const y1 = center + innerRadius * Math.sin(rad);
				const x2 = center + outerRadius * Math.cos(rad);
				const y2 = center + outerRadius * Math.sin(rad);

				return (
					<line
						key={`cusp-${idx}`}
						x1={x1}
						y1={y1}
						x2={x2}
						y2={y2}
						stroke={isDark ? 'rgba(255,255,255,0.4)' : '#000000'}
						strokeWidth="1.5"
					/>
				);
			})}

			{/* Degree ticks on INNER circumference */}
			<g>
				{Array.from({ length: 360 }, (_, i) => {
					const angle = i - 90;
					const rad = (angle * Math.PI) / 180;

					const is10Degree = i % 10 === 0;
					const is5Degree = i % 5 === 0;

					let tickLength;
					let tickWidth;

					if (is10Degree) {
						tickLength = 20;
						tickWidth = 1.5;
					} else if (is5Degree) {
						tickLength = 12;
						tickWidth = 1.2;
					} else {
						tickLength = 8;
						tickWidth = 0.5;
					}

					const x1 = center + innerRadius * Math.cos(rad);
					const y1 = center + innerRadius * Math.sin(rad);
					const x2 = center + (innerRadius + tickLength) * Math.cos(rad);
					const y2 = center + (innerRadius + tickLength) * Math.sin(rad);

					return (
						<line
							key={`inner-tick-${i}`}
							x1={x1}
							y1={y1}
							x2={x2}
							y2={y2}
							stroke={isDark ? 'rgba(255,255,255,0.4)' : '#000000'}
							strokeWidth={tickWidth}
						/>
					);
				})}
			</g>

			{/* Zodiac Signs - INSIDE the main ring */}
			{zodiacWithColors.map((sign) => {
				const angle = sign.angle - 90 + 15;
				const rad = (angle * Math.PI) / 180;

				const zodiacRadius = (innerRadius + outerRadius) / 2;
				const x = center + zodiacRadius * Math.cos(rad);
				const y = center + zodiacRadius * Math.sin(rad);

				let finalColor = sign.color;
				if (isDark && sign.color !== '#000000') {
					finalColor = sign.color + 'dd';
				} else if (isDark && sign.color === '#000000') {
					finalColor = '#ffffff';
				}

				return (
					<text
						key={sign.name}
						x={x}
						y={y}
						textAnchor="middle"
						dominantBaseline="middle"
						fontSize="20"
						fontWeight="500"
						fill={finalColor}
					>
						{sign.icon}
					</text>
				);
			})}

			{/* Inner nested circles (empty center) */}
			<circle
				cx={center}
				cy={center}
				r={innerCenterRing}
				fill="none"
				stroke={isDark ? 'rgba(255,255,255,0.4)' : '#000000'}
				strokeWidth="1.5"
			/>

			<circle
				cx={center}
				cy={center}
				r={innerCenterCore}
				fill="none"
				stroke={isDark ? 'rgba(255,255,255,0.4)' : '#000000'}
				strokeWidth="1.5"
			/>
		</svg>
	);
}

function BarBlock({
	label,
	value,
	maxValue,
	color,
	isDark
}: {
	label: string;
	value: number;
	maxValue: number;
	color: string;
	isDark: boolean;
}) {
	return (
		<div className="flex items-center gap-4">
			<span
				className={cn(
					'w-28 flex-shrink-0 text-sm font-medium sm:w-32',
					isDark ? 'text-slate-200' : 'text-gray-700'
				)}
			>
				{label}
			</span>
			<div
				className={cn(
					'relative h-10 flex-1 overflow-hidden rounded-full',
					isDark ? 'bg-slate-800' : 'bg-gray-100'
				)}
			>
				<div
					className={`h-full bg-gradient-to-r ${color} flex items-center justify-end rounded-full pr-3 shadow-lg transition-all duration-700 ease-out`}
					style={{ width: `${(value / maxValue) * 100}%` }}
				>
					<span className="text-xs font-semibold text-white drop-shadow-sm">{value}</span>
				</div>
			</div>
		</div>
	);
}

export function InformationView({ theme }: InformationViewProps) {
	const { t } = useTranslation();
	const isDark = theme === 'midnight' || theme === 'twilight';

	const modeRows = [
		{ labelKey: 'sign_mode_cardinal', value: 6, color: 'from-red-500 to-orange-500' },
		{ labelKey: 'sign_mode_fixed', value: 3, color: 'from-blue-600 to-blue-400' },
		{ labelKey: 'sign_mode_mutable', value: 1, color: 'from-green-500 to-emerald-400' }
	] as const;

	const aspectRows = [
		{ labelKey: 'aspect_conjunction', value: 2, color: 'from-red-500 to-orange-500' },
		{ labelKey: 'aspect_sextile', value: 3, color: 'from-blue-600 to-blue-400' },
		{ labelKey: 'aspect_square', value: 5, color: 'from-green-500 to-emerald-400' },
		{ labelKey: 'aspect_trine', value: 3, color: 'from-yellow-500 to-amber-500' },
		{ labelKey: 'aspect_opposition', value: 5, color: 'from-purple-600 to-purple-400' }
	] as const;

	const elementRows = [
		{ labelKey: 'element_fire', value: 3, color: 'from-red-500 to-orange-500' },
		{ labelKey: 'element_earth', value: 2, color: 'from-yellow-500 to-amber-500' },
		{ labelKey: 'element_air', value: 4, color: 'from-green-500 to-emerald-400' },
		{ labelKey: 'element_water', value: 1, color: 'from-blue-600 to-blue-400' }
	] as const;

	const houseRows = [
		{ labelKey: 'house_type_angular', value: 2, color: 'from-red-500 to-orange-500' },
		{ labelKey: 'house_type_succedent', value: 3, color: 'from-blue-600 to-blue-400' },
		{ labelKey: 'house_type_cadent', value: 5, color: 'from-green-500 to-emerald-400' }
	] as const;

	const maxValue = 10;

	const pageClass = cn(
		'flex h-screen flex-col overflow-hidden transition-colors duration-300',
		isDark && 'bg-slate-950 text-white',
		!isDark &&
			theme === 'sunrise' &&
			'bg-gradient-to-br from-sky-50 via-cyan-50 to-sky-100 text-gray-900',
		!isDark && theme !== 'sunrise' && 'bg-gray-50 text-gray-900'
	);

	const cardClass = cn(
		'rounded-2xl border p-6 shadow-sm',
		isDark ? 'border-white/10 bg-slate-900/80 backdrop-blur-sm' : 'border-gray-200 bg-white'
	);

	const h2Class = cn('mb-6 text-lg font-semibold', isDark ? 'text-white' : 'text-gray-900');

	const centerWrapClass = cn(
		'flex h-full max-h-full w-full max-w-4xl items-center justify-center rounded-2xl border p-8 shadow-sm',
		isDark ? 'border-white/10 bg-slate-900/80 backdrop-blur-sm' : 'border-gray-200 bg-white'
	);

	const footerClass = cn(
		'flex h-[56px] flex-shrink-0 items-center border-t px-6',
		isDark
			? 'border-white/10 bg-slate-900/90 text-slate-400'
			: 'border-gray-200 bg-white text-gray-400'
	);

	return (
		<div className={pageClass}>
			<div className="flex flex-1 gap-6 overflow-hidden p-6">
				<div className="w-[400px] flex-shrink-0 space-y-6 overflow-y-auto pr-2">
					<div className={cardClass}>
						<h2 className={h2Class}>{t('info_dominance_mode_quality')}</h2>
						<div className="space-y-5">
							{modeRows.map((item) => (
								<BarBlock
									key={item.labelKey}
									label={t(item.labelKey)}
									value={item.value}
									maxValue={maxValue}
									color={item.color}
									isDark={isDark}
								/>
							))}
						</div>
					</div>

					<div className={cardClass}>
						<h2 className={h2Class}>{t('info_dominance_aspects')}</h2>
						<div className="space-y-5">
							{aspectRows.map((item) => (
								<BarBlock
									key={item.labelKey}
									label={t(item.labelKey)}
									value={item.value}
									maxValue={maxValue}
									color={item.color}
									isDark={isDark}
								/>
							))}
						</div>
					</div>

					<div className={cardClass}>
						<h2 className={h2Class}>{t('info_dominance_element')}</h2>
						<div className="space-y-5">
							{elementRows.map((item) => (
								<BarBlock
									key={item.labelKey}
									label={t(item.labelKey)}
									value={item.value}
									maxValue={maxValue}
									color={item.color}
									isDark={isDark}
								/>
							))}
						</div>
					</div>

					<div className={cardClass}>
						<h2 className={h2Class}>{t('info_dominance_houses')}</h2>
						<div className="space-y-5">
							{houseRows.map((item) => (
								<BarBlock
									key={item.labelKey}
									label={t(item.labelKey)}
									value={item.value}
									maxValue={maxValue}
									color={item.color}
									isDark={isDark}
								/>
							))}
						</div>
					</div>
				</div>

				<div className="flex flex-1 items-center justify-center overflow-hidden">
					<div className={centerWrapClass}>
						<HoroscopeWheel theme={theme} />
					</div>
				</div>
			</div>

			<div className={footerClass}>
				<div className="text-sm italic">{t('info_chips_placeholder')}</div>
			</div>
		</div>
	);
}
