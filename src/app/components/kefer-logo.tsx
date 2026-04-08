import React from 'react';

interface KeferLogoProps {
	size?: number;
	className?: string;
	theme?: 'sunrise' | 'noon' | 'twilight' | 'midnight';
}

export function KeferIcon({ size = 32, className = '', theme = 'noon' }: KeferLogoProps) {
	// Kruh má stejnou barvu jako text "Kefer" v sidebaru
	// Text v kruhu má opačnou barvu pro kontrast
	const getColors = () => {
		switch (theme) {
			case 'sunrise':
				return { circle: '#1f2937', text: '#FFFFFF' }; // dark circle, white text
			case 'noon':
				return { circle: '#374151', text: '#FFFFFF' }; // dark circle, white text
			case 'twilight':
				return { circle: '#312e81', text: '#FFFFFF' }; // dark circle, white text
			case 'midnight':
				return { circle: '#e2e8f0', text: '#000000' }; // light circle, black text
			default:
				return { circle: '#374151', text: '#FFFFFF' };
		}
	};

	const { circle: circleColor, text: textColor } = getColors();

	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 100 100"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className={className}
		>
			<circle cx="50" cy="50" r="50" fill={circleColor} />
			<text
				x="50"
				y="68"
				fontFamily="system-ui, -apple-system, sans-serif"
				fontSize="60"
				fontWeight="500"
				fill={textColor}
				textAnchor="middle"
			>
				k
			</text>
		</svg>
	);
}

interface KeferLogoFullProps {
	iconSize?: number;
	className?: string;
	theme?: 'sunrise' | 'noon' | 'twilight' | 'midnight';
}

export function KeferLogoFull({
	iconSize = 32,
	className = '',
	theme = 'noon'
}: KeferLogoFullProps) {
	return (
		<div className={`flex items-center gap-3 ${className}`}>
			<KeferIcon size={iconSize} theme={theme} />
			<span
				className="text-xl font-medium tracking-tight"
				style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
			>
				Kefer
			</span>
		</div>
	);
}
