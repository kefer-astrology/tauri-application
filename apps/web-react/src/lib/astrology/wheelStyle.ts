export type WheelStyleId = 'minimalist' | 'technical';

export const WHEEL_STYLE_KEY = 'wheel_style';

export interface WheelStyleOption {
	id: WheelStyleId;
	label: string;
	description: string;
}

export const WHEEL_STYLE_OPTIONS: WheelStyleOption[] = [
	{
		id: 'minimalist',
		label: 'Minimalist',
		description: 'Sign ring with 12 divider lines only, no degree scale.'
	},
	{
		id: 'technical',
		label: 'Technical',
		description: 'Sign ring plus a full 360° degree tick scale.'
	}
];

function isWheelStyleId(value: string): value is WheelStyleId {
	return value === 'minimalist' || value === 'technical';
}

export function readStoredWheelStyle(): WheelStyleId {
	try {
		const value = localStorage.getItem(WHEEL_STYLE_KEY);
		if (value && isWheelStyleId(value)) return value;
	} catch {
		/* ignore */
	}
	return 'technical';
}

export function persistWheelStyle(value: WheelStyleId) {
	try {
		localStorage.setItem(WHEEL_STYLE_KEY, value);
	} catch {
		/* ignore */
	}
}
