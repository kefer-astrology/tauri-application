import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppThemeProvider } from '@/app/providers/app-theme';
import { HoroscopeWheel } from './horoscope-wheel';

const render = (props: Parameters<typeof HoroscopeWheel>[0]) =>
	renderToString(
		<AppThemeProvider theme="noon" glyphSet="default">
			<HoroscopeWheel {...props} />
		</AppThemeProvider>
	);

describe('HoroscopeWheel', () => {
	it('renders the demo radix without data', () => {
		const html = render({});
		expect(html).toContain('<svg');
		expect(html).toContain('Layer_AspectLines');
	});

	it('renders computed positions, axes, aspects, a transit ring and a hemisphere overlay', () => {
		const html = render({
			useFallbackData: false,
			bodyLongitudes: { sun: 10, moon: 12, mars: 200 },
			bodyOrder: ['sun', 'moon', 'mars'],
			transitBodyLongitudes: { saturn: 100 },
			transitBodyOrder: ['saturn'],
			axisLongitudes: { asc: 100, dsc: 280, mc: 10, ic: 190 },
			houseCusps: Array.from({ length: 12 }, (_, i) => 100 + i * 30),
			radixAspects: [{ from: 'sun', to: 'mars', type: 'opposition', orb: 2 }],
			hemisphereOverlay: 'lower',
			showPlanetGlyphs: true,
			showAxisLines: true
		});
		expect(html).toContain('<svg');
		expect(html).toContain('<line');
	});

	it('keeps bodies in the overlay half bright, named as in the chart facts', () => {
		// ASC 100°: Moon at 150° is in houses 1–6 (lower), Sun at 50° in houses 7–12 (upper).
		// MC 10°: Moon at 150° is in houses 10–3 (east); Mars at 250° in houses 4–9 (west).
		const opacityOf = (html: string, body: string) =>
			new RegExp(`data-handoff="Planet_${body}" opacity="([0-9.]+)"`).exec(html)?.[1];
		const wheel = (overlay: 'upper' | 'lower' | 'east' | 'west') =>
			render({
				useFallbackData: false,
				bodyLongitudes: { sun: 50, moon: 150, mars: 250 },
				bodyOrder: ['sun', 'moon', 'mars'],
				axisLongitudes: { asc: 100, dsc: 280, mc: 10, ic: 190 },
				hemisphereOverlay: overlay,
				showPlanetGlyphs: true,
				showAxisLines: true
			});
		expect(opacityOf(wheel('upper'), 'sun')).toBe('1');
		expect(opacityOf(wheel('upper'), 'moon')).toBe('0.42');
		expect(opacityOf(wheel('lower'), 'moon')).toBe('1');
		expect(opacityOf(wheel('east'), 'moon')).toBe('1');
		expect(opacityOf(wheel('east'), 'mars')).toBe('0.42');
		expect(opacityOf(wheel('west'), 'mars')).toBe('1');
		expect(wheel('east')).toContain('token-wheel-overlay-secondary');
		expect(wheel('upper')).toContain('token-wheel-overlay-primary');
	});
});
