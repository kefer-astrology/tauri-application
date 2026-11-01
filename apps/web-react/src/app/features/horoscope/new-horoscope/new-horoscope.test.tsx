import { renderToString } from 'react-dom/server';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n/i18n';
import { AppThemeProvider } from '@/app/providers/app-theme';
import { DEFAULT_WORKSPACE_DEFAULTS, type AppChart } from '@/lib/tauri/chartPayload';
import { NewHoroscope } from './new-horoscope';

vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn(() => Promise.reject(new Error('no backend'))),
	isTauri: () => false
}));

const chart = (overrides: Partial<AppChart> = {}): AppChart => ({
	id: 'jan',
	name: 'Jan Novák',
	chartType: 'EVENT',
	dateTime: '1984-07-14T13:30:00Z',
	location: 'Prague, Czech Republic',
	latitude: 50.0875,
	longitude: 14.4214,
	timezone: 'Europe/Prague',
	timeRegime: 'auto',
	locationRegime: 'auto',
	tags: ['family'],
	...overrides
});

// Server rendering runs the form hook and every section synchronously.
function render(initialValues?: AppChart) {
	return renderToString(
		<AppThemeProvider theme="noon" glyphSet="default">
			<NewHoroscope
				presentation={initialValues ? 'panel' : 'page'}
				workspaceDefaults={DEFAULT_WORKSPACE_DEFAULTS}
				workspaceTags={[{ name: 'family', color: '#123456' }]}
				existingChartIds={new Set()}
				initialValues={initialValues}
			/>
		</AppThemeProvider>
	);
}

describe('NewHoroscope', () => {
	beforeAll(() => i18n.changeLanguage('en'));

	it('renders the create form', () => {
		const html = render();
		expect(html).toContain('Create chart');
		expect(html).not.toContain('Back');
		expect(html).toContain('id="new-chart-date"');
		expect(html).toContain('id="new-chart-time"');
		expect(html).toContain('id="location"');
	});

	it('renders the edit form at local time of the event place', () => {
		const html = render(chart());
		expect(html).toContain('Save chart');
		expect(html).toContain('Back');
		expect(html).toContain('value="Jan Novák"');
		expect(html).toContain('value="15:30:00"');
		expect(html).toContain('aria-label="Remove family"');
	});

	it('renders the Julian Day and Julian calendar entries', () => {
		const julianDay = render(chart({ timeSystem: 'julian_day' }));
		expect(julianDay).toContain('Julian Day');
		expect(julianDay).toContain('value="2445896.06250000"');
		const julianCalendar = render(chart({ timeSystem: 'julian_calendar' }));
		expect(julianCalendar).toContain('value="1984-07-01"');
	});

	it('shows the manual coordinates of a manually placed chart', () => {
		const html = render(chart({ locationRegime: 'manual', latitude: -33.8688 }));
		expect(html).toContain('id="manual-location"');
		expect(html).toContain('value="33.8688"');
	});
});
