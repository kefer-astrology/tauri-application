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
			hemisphereOverlay: 'asc-dsc-east',
			showPlanetGlyphs: true,
			showAxisLines: true
		});
		expect(html).toContain('<svg');
		expect(html).toContain('<line');
	});
});
