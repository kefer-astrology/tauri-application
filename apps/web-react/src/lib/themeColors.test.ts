import { describe, expect, it } from 'vitest';
import { formatThemeColor, parseThemeColor } from './themeColors';

describe('theme colors', () => {
	it('parses hex, hex with alpha and rgba', () => {
		expect(parseThemeColor('#336699')).toEqual({ hex: '#336699', alpha: 1 });
		expect(parseThemeColor('#33669980').alpha).toBeCloseTo(0.5, 2);
		expect(parseThemeColor('rgba(51, 102, 153, 0.25)')).toEqual({ hex: '#336699', alpha: 0.25 });
		expect(parseThemeColor('nonsense')).toEqual({ hex: '#000000', alpha: 1 });
	});

	it('formats opaque as hex and translucent as rgba', () => {
		expect(formatThemeColor('#336699', 1)).toBe('#336699');
		expect(formatThemeColor('#336699', 0.333)).toBe('rgba(51,102,153,0.33)');
	});
});
