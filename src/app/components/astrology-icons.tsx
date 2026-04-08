import React from 'react';

interface HoroskopeIconProps {
	className?: string;
	strokeWidth?: number;
}

export function HoroskopeIcon({ className = '', strokeWidth = 1.5 }: HoroskopeIconProps) {
	return (
		<svg
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className={className}
		>
			<circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={strokeWidth} />
			{/* Horizontal line through center */}
			<line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth={strokeWidth} />
			{/* Line at 120 degrees from horizontal, through center */}
			<line
				x1="7.5"
				y1="4.206"
				x2="16.5"
				y2="19.794"
				stroke="currentColor"
				strokeWidth={strokeWidth}
			/>
		</svg>
	);
}

interface TranzityIconProps {
	className?: string;
	strokeWidth?: number;
}

export function TranzityIcon({ className = '', strokeWidth = 1.5 }: TranzityIconProps) {
	return (
		<svg
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className={className}
		>
			<circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={strokeWidth} />
			<circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth={strokeWidth} />
		</svg>
	);
}
